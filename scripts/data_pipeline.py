"""
ScoutAI Data Pipeline
Fetches 3 years of FRC match data from TBA API + EPA stats from Statbotics.
Builds feature vectors for XGBoost model training.
"""

import os
import sys
import time
import json
from typing import Optional, Union
import requests
import pandas as pd
import numpy as np
from datetime import datetime
from pathlib import Path

# Configuration
TBA_API_KEY = "FTds7vugItGGLEy4zYXgqssMDLUGusDHJK76UCbKbeMVIAa8Q2kKc35XAf3Q7GmG"
TBA_BASE = "https://www.thebluealliance.com/api/v3"
STATBOTICS_BASE = "https://api.statbotics.io/v3"
OUTPUT_DIR = Path(__file__).parent / "data"
THROTTLE_MS = 1100  # Statbotics rate limit ~60 req/min


def parse_years() -> list[int]:
    """Parse training years from SCOUTAI_YEARS or default to last 3 seasons."""
    env_years = os.environ.get("SCOUTAI_YEARS")
    if env_years:
        years: list[int] = []
        for raw in env_years.split(","):
            raw = raw.strip()
            if not raw:
                continue
            try:
                years.append(int(raw))
            except ValueError:
                print(f"Invalid year in SCOUTAI_YEARS: '{raw}'")
                sys.exit(1)
        if not years:
            print("SCOUTAI_YEARS provided but empty; please set valid years.")
            sys.exit(1)
        return sorted(set(years))

    current_year = datetime.utcnow().year
    # Default to last 3 *completed* seasons
    return [current_year - 3, current_year - 2, current_year - 1]


def tba_get(endpoint: str) -> Optional[Union[dict, list]]:
    """Fetch from TBA API with auth header."""
    url = f"{TBA_BASE}{endpoint}"
    headers = {"X-TBA-Auth-Key": TBA_API_KEY}
    try:
        resp = requests.get(url, headers=headers, timeout=30)
        if resp.status_code == 200:
            return resp.json()
        print(f"  TBA error {resp.status_code} for {endpoint}")
        return None
    except requests.RequestException as e:
        print(f"  TBA request failed: {e}")
        return None


def statbotics_get(endpoint: str) -> Optional[dict]:
    """Fetch from Statbotics API (no auth needed)."""
    url = f"{STATBOTICS_BASE}{endpoint}"
    try:
        resp = requests.get(url, timeout=30)
        if resp.status_code == 200:
            return resp.json()
        return None
    except requests.RequestException:
        return None


def fetch_events_for_year(year: int) -> list[dict]:
    """Get all events for a year from TBA."""
    print(f"Fetching events for {year}...")
    events = tba_get(f"/events/{year}")
    if not events:
        return []
    # Filter to official events (regionals, districts, championships)
    official = [
        e
        for e in events
        if e.get("event_type") in [0, 1, 2, 3, 4, 5, 6]  # Regional through championship
    ]
    print(f"  Found {len(official)} official events")
    return official


def fetch_matches_for_event(event_key: str) -> list[dict]:
    """Get all matches for an event from TBA."""
    matches = tba_get(f"/event/{event_key}/matches")
    if not matches:
        return []
    # Filter to completed matches with scores
    completed = [
        m
        for m in matches
        if m.get("alliances", {}).get("red", {}).get("score", -1) >= 0
        and m.get("alliances", {}).get("blue", {}).get("score", -1) >= 0
    ]
    return completed


def get_team_epa(team_num: int, event_key: str, epa_cache: dict) -> Optional[dict]:
    """Get EPA stats for a team at an event from Statbotics."""
    cache_key = f"{team_num}-{event_key}"
    if cache_key in epa_cache:
        return epa_cache[cache_key]

    time.sleep(THROTTLE_MS / 1000)
    data = statbotics_get(f"/team_event/{team_num}/{event_key}")

    def safe_mean(value: object) -> float:
        if isinstance(value, dict):
            v = value.get("mean")
            return float(v) if isinstance(v, (int, float)) else 0.0
        if isinstance(value, (int, float)):
            return float(value)
        return 0.0

    if data and "epa" in data:
        epa = data["epa"]
        if isinstance(epa, dict):
            breakdown = epa.get("breakdown")
            if isinstance(breakdown, dict):
                result = {
                    "total": safe_mean(breakdown.get("total_points")),
                    "auto": safe_mean(breakdown.get("auto_points")),
                    "teleop": safe_mean(breakdown.get("teleop_points")),
                    "endgame": safe_mean(breakdown.get("endgame_points")),
                }
            else:
                # Fallback for seasons where breakdown isn't structured
                result = {
                    "total": safe_mean(
                        epa.get("total_points")
                        or epa.get("total")
                        or epa.get("mean")
                        or epa.get("epa")
                    ),
                    "auto": safe_mean(epa.get("auto_points") or epa.get("auto")),
                    "teleop": safe_mean(epa.get("teleop_points") or epa.get("teleop")),
                    "endgame": safe_mean(epa.get("endgame_points") or epa.get("endgame")),
                }
        elif isinstance(epa, (int, float)):
            result = {"total": float(epa), "auto": 0.0, "teleop": 0.0, "endgame": 0.0}
        else:
            result = None

        epa_cache[cache_key] = result
        return result

    epa_cache[cache_key] = None
    return None


def extract_team_numbers(alliance_data: dict) -> list[int]:
    """Extract team numbers from TBA alliance data."""
    keys = alliance_data.get("team_keys", [])
    nums = []
    for key in keys:
        try:
            nums.append(int(key.replace("frc", "")))
        except ValueError:
            continue
    return nums


def build_feature_vector(
    match: dict, event: dict, epa_cache: dict
) -> Optional[dict]:
    """Build a feature vector for a single match."""
    red = match["alliances"]["red"]
    blue = match["alliances"]["blue"]

    red_teams = extract_team_numbers(red)
    blue_teams = extract_team_numbers(blue)

    if len(red_teams) < 3 or len(blue_teams) < 3:
        return None

    red_score = red["score"]
    blue_score = blue["score"]
    event_key = event["key"]

    # Fetch EPA for all 6 teams
    red_epas = [get_team_epa(t, event_key, epa_cache) for t in red_teams[:3]]
    blue_epas = [get_team_epa(t, event_key, epa_cache) for t in blue_teams[:3]]

    # Skip if too many missing EPAs
    red_valid = [e for e in red_epas if e is not None]
    blue_valid = [e for e in blue_epas if e is not None]
    if len(red_valid) < 2 or len(blue_valid) < 2:
        return None

    def alliance_features(epas: list[Optional[dict]], prefix: str) -> dict:
        valid = [e for e in epas if e is not None]
        if not valid:
            return {f"{prefix}_avg_epa": 0, f"{prefix}_avg_auto": 0,
                    f"{prefix}_avg_teleop": 0, f"{prefix}_avg_endgame": 0,
                    f"{prefix}_sum_epa": 0, f"{prefix}_max_epa": 0}
        return {
            f"{prefix}_avg_epa": np.mean([e["total"] for e in valid]),
            f"{prefix}_avg_auto": np.mean([e["auto"] for e in valid]),
            f"{prefix}_avg_teleop": np.mean([e["teleop"] for e in valid]),
            f"{prefix}_avg_endgame": np.mean([e["endgame"] for e in valid]),
            f"{prefix}_sum_epa": sum(e["total"] for e in valid),
            f"{prefix}_max_epa": max(e["total"] for e in valid),
        }

    red_feats = alliance_features(red_epas, "red")
    blue_feats = alliance_features(blue_epas, "blue")

    # Comp level encoding
    comp_level = match.get("comp_level", "qm")
    comp_encoded = {"qm": 0, "ef": 1, "qf": 1, "sf": 2, "f": 3}.get(comp_level, 0)

    # Event week
    event_week = event.get("week", 0) or 0

    # Derived features
    epa_diff = red_feats["red_sum_epa"] - blue_feats["blue_sum_epa"]
    avg_epa_diff = red_feats["red_avg_epa"] - blue_feats["blue_avg_epa"]

    # Winner label
    if red_score > blue_score:
        winner = 1  # Red wins
    elif blue_score > red_score:
        winner = 0  # Blue wins
    else:
        return None  # Skip ties

    return {
        **red_feats,
        **blue_feats,
        "comp_level": comp_encoded,
        "event_week": event_week,
        "epa_diff": epa_diff,
        "avg_epa_diff": avg_epa_diff,
        "winner": winner,
        "red_score": red_score,
        "blue_score": blue_score,
        "score_margin": red_score - blue_score,
    }


def main():
    if not TBA_API_KEY:
        print("ERROR: TBA_API_KEY is not set. Please export it and retry.")
        sys.exit(1)

    years = parse_years()
    OUTPUT_DIR.mkdir(exist_ok=True)
    epa_cache: dict = {}
    all_rows: list[dict] = []

    for year in years:
        events = fetch_events_for_year(year)
        print(f"\nProcessing {len(events)} events for {year}...")

        for i, event in enumerate(events):
            event_key = event["key"]
            print(
                f"  [{i+1}/{len(events)}] {event_key} — {event.get('name', '')}",
                end="",
                flush=True,
            )

            matches = fetch_matches_for_event(event_key)
            if not matches:
                print(" (0 matches, skipped)")
                continue

            event_rows = 0
            for match in matches:
                row = build_feature_vector(match, event, epa_cache)
                if row:
                    row["year"] = year
                    row["event_key"] = event_key
                    all_rows.append(row)
                    event_rows += 1

            print(f" ({event_rows}/{len(matches)} matches)")

        print(f"Year {year} complete. Total rows so far: {len(all_rows)}")

    # Save to CSV
    df = pd.DataFrame(all_rows)
    output_path = OUTPUT_DIR / "match_features.csv"
    df.to_csv(output_path, index=False)
    print(f"\nDataset saved: {output_path}")
    print(f"Total matches: {len(df)}")
    print(f"Features: {len(df.columns)} columns")
    if df.empty or "winner" not in df.columns:
        print("\nNo training data collected. Check network access, API keys, and year range.")
        sys.exit(1)
    print(f"\nLabel distribution:")
    print(f"  Red wins: {(df['winner'] == 1).sum()} ({(df['winner'] == 1).mean():.1%})")
    print(f"  Blue wins: {(df['winner'] == 0).sum()} ({(df['winner'] == 0).mean():.1%})")
    print(f"\nScore stats:")
    print(f"  Red score: mean={df['red_score'].mean():.1f}, std={df['red_score'].std():.1f}")
    print(f"  Blue score: mean={df['blue_score'].mean():.1f}, std={df['blue_score'].std():.1f}")


if __name__ == "__main__":
    main()
