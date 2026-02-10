"""
ScoutAI Prediction Server
FastAPI server that loads trained XGBoost models and serves match predictions.
Run: uvicorn predict_server:app --host 0.0.0.0 --port 8000
"""

import os
import time
from pathlib import Path
from functools import lru_cache
from typing import Optional

import numpy as np
import requests
import joblib
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

MODEL_DIR = Path(__file__).parent / "models"
STATBOTICS_BASE = "https://api.statbotics.io/v3"
PORT = int(os.environ.get("PORT", 8000))

# --- Load models on startup ---
try:
    clf = joblib.load(MODEL_DIR / "winner_classifier.joblib")
    red_reg = joblib.load(MODEL_DIR / "red_score_regressor.joblib")
    blue_reg = joblib.load(MODEL_DIR / "blue_score_regressor.joblib")
    scaler = joblib.load(MODEL_DIR / "feature_scaler.joblib")
    feature_cols = joblib.load(MODEL_DIR / "feature_columns.joblib")
    MODELS_LOADED = True
    print(f"Models loaded from {MODEL_DIR}")
except Exception as e:
    MODELS_LOADED = False
    print(f"WARNING: Could not load models: {e}")
    print("Server will start but predictions will fail.")
    clf = red_reg = blue_reg = scaler = feature_cols = None

# --- EPA cache (TTL: 10 minutes) ---
_epa_cache: dict[str, tuple[Optional[dict], float]] = {}
EPA_CACHE_TTL = 600


def get_team_epa_cached(team_num: int, event_key: str) -> Optional[dict]:
    """Fetch EPA from Statbotics with in-memory caching."""
    cache_key = f"{team_num}-{event_key}"
    now = time.time()

    if cache_key in _epa_cache:
        data, ts = _epa_cache[cache_key]
        if now - ts < EPA_CACHE_TTL:
            return data

    try:
        resp = requests.get(
            f"{STATBOTICS_BASE}/team_event/{team_num}/{event_key}", timeout=10
        )
        if resp.status_code == 200:
            data = resp.json()
            epa = data.get("epa", {})
            breakdown = epa.get("breakdown", {})
            result = {
                "total": breakdown.get("total_points", {}).get("mean", 0),
                "auto": breakdown.get("auto_points", {}).get("mean", 0),
                "teleop": breakdown.get("teleop_points", {}).get("mean", 0),
                "endgame": breakdown.get("endgame_points", {}).get("mean", 0),
            }
            _epa_cache[cache_key] = (result, now)
            return result
    except requests.RequestException:
        pass

    _epa_cache[cache_key] = (None, now)
    return None


def build_features(
    red_teams: list[int], blue_teams: list[int], event_key: str,
    comp_level: int = 0, event_week: int = 0
) -> Optional[np.ndarray]:
    """Build feature vector matching training format."""
    red_epas = [get_team_epa_cached(t, event_key) for t in red_teams]
    blue_epas = [get_team_epa_cached(t, event_key) for t in blue_teams]

    red_valid = [e for e in red_epas if e is not None]
    blue_valid = [e for e in blue_epas if e is not None]

    if not red_valid or not blue_valid:
        return None

    def avg_or_zero(epas: list[dict], key: str) -> float:
        return float(np.mean([e[key] for e in epas])) if epas else 0

    def sum_or_zero(epas: list[dict], key: str) -> float:
        return float(sum(e[key] for e in epas)) if epas else 0

    def max_or_zero(epas: list[dict], key: str) -> float:
        return float(max(e[key] for e in epas)) if epas else 0

    features = {
        "red_avg_epa": avg_or_zero(red_valid, "total"),
        "red_avg_auto": avg_or_zero(red_valid, "auto"),
        "red_avg_teleop": avg_or_zero(red_valid, "teleop"),
        "red_avg_endgame": avg_or_zero(red_valid, "endgame"),
        "red_sum_epa": sum_or_zero(red_valid, "total"),
        "red_max_epa": max_or_zero(red_valid, "total"),
        "blue_avg_epa": avg_or_zero(blue_valid, "total"),
        "blue_avg_auto": avg_or_zero(blue_valid, "auto"),
        "blue_avg_teleop": avg_or_zero(blue_valid, "teleop"),
        "blue_avg_endgame": avg_or_zero(blue_valid, "endgame"),
        "blue_sum_epa": sum_or_zero(blue_valid, "total"),
        "blue_max_epa": max_or_zero(blue_valid, "total"),
        "comp_level": comp_level,
        "event_week": event_week,
        "epa_diff": sum_or_zero(red_valid, "total") - sum_or_zero(blue_valid, "total"),
        "avg_epa_diff": avg_or_zero(red_valid, "total") - avg_or_zero(blue_valid, "total"),
    }

    return np.array([[features[col] for col in feature_cols]])


# --- FastAPI app ---
app = FastAPI(title="ScoutAI Prediction Server", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class PredictRequest(BaseModel):
    red_teams: list[int]
    blue_teams: list[int]
    event_key: str
    comp_level: int = 0
    event_week: int = 0


class PredictResponse(BaseModel):
    winner: str
    win_probability: float
    red_score: int
    blue_score: int
    margin: int


@app.get("/health")
def health():
    return {"status": "ok", "models_loaded": MODELS_LOADED}


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    if not MODELS_LOADED:
        raise HTTPException(503, "Models not loaded. Train models first.")

    if len(req.red_teams) != 3 or len(req.blue_teams) != 3:
        raise HTTPException(400, "Each alliance must have exactly 3 teams.")

    X = build_features(
        req.red_teams, req.blue_teams, req.event_key,
        req.comp_level, req.event_week
    )

    if X is None:
        raise HTTPException(
            422, "Could not fetch EPA data for teams. Check team numbers and event key."
        )

    X_scaled = scaler.transform(X)

    # Predict
    win_prob = float(clf.predict_proba(X_scaled)[0, 1])  # P(red wins)
    red_score = max(0, int(round(red_reg.predict(X_scaled)[0])))
    blue_score = max(0, int(round(blue_reg.predict(X_scaled)[0])))

    winner = "red" if win_prob > 0.5 else "blue"

    return PredictResponse(
        winner=winner,
        win_probability=round(win_prob if winner == "red" else 1 - win_prob, 3),
        red_score=red_score,
        blue_score=blue_score,
        margin=abs(red_score - blue_score),
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=PORT)
