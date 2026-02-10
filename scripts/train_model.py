"""
ScoutAI Model Training
Trains XGBoost models on historical FRC match data to predict:
1. Match winner (red vs blue) — classifier
2. Red alliance score — regressor
3. Blue alliance score — regressor
"""

import sys
from pathlib import Path
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    mean_absolute_error,
    mean_squared_error,
    r2_score,
)
from xgboost import XGBClassifier, XGBRegressor
import joblib

DATA_DIR = Path(__file__).parent / "data"
MODEL_DIR = Path(__file__).parent / "models"

# Feature columns used for prediction
FEATURE_COLS = [
    "red_avg_epa",
    "red_avg_auto",
    "red_avg_teleop",
    "red_avg_endgame",
    "red_sum_epa",
    "red_max_epa",
    "blue_avg_epa",
    "blue_avg_auto",
    "blue_avg_teleop",
    "blue_avg_endgame",
    "blue_sum_epa",
    "blue_max_epa",
    "comp_level",
    "event_week",
    "epa_diff",
    "avg_epa_diff",
]


def load_data() -> pd.DataFrame:
    """Load processed match data."""
    csv_path = DATA_DIR / "match_features.csv"
    if not csv_path.exists():
        print(f"ERROR: {csv_path} not found. Run data_pipeline.py first.")
        sys.exit(1)

    df = pd.read_csv(csv_path)
    print(f"Loaded {len(df)} matches from {csv_path}")

    # Drop rows with NaN in feature columns
    before = len(df)
    df = df.dropna(subset=FEATURE_COLS + ["winner", "red_score", "blue_score"])
    if len(df) < before:
        print(f"Dropped {before - len(df)} rows with missing values")

    return df


def train_winner_classifier(
    X_train: np.ndarray,
    X_test: np.ndarray,
    y_train: np.ndarray,
    y_test: np.ndarray,
) -> XGBClassifier:
    """Train XGBoost classifier for match winner prediction."""
    print("\n" + "=" * 60)
    print("TRAINING: Match Winner Classifier")
    print("=" * 60)

    model = XGBClassifier(
        n_estimators=200,
        max_depth=6,
        learning_rate=0.1,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        eval_metric="logloss",
    )

    model.fit(X_train, y_train)

    # Predictions
    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)[:, 1]

    # Metrics
    acc = accuracy_score(y_test, y_pred)
    prec = precision_score(y_test, y_pred)
    rec = recall_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred)
    auc = roc_auc_score(y_test, y_prob)

    print(f"\n  Accuracy:  {acc:.4f}")
    print(f"  Precision: {prec:.4f}")
    print(f"  Recall:    {rec:.4f}")
    print(f"  F1 Score:  {f1:.4f}")
    print(f"  ROC-AUC:   {auc:.4f}")

    # Baseline: always predict higher-EPA alliance
    baseline_pred = (X_test[:, FEATURE_COLS.index("epa_diff")] > 0).astype(int)
    baseline_acc = accuracy_score(y_test, baseline_pred)
    print(f"\n  Baseline (higher EPA wins): {baseline_acc:.4f}")
    print(f"  Improvement over baseline:  +{(acc - baseline_acc):.4f}")

    # Feature importance
    print("\n  Top 5 Feature Importances:")
    importance = sorted(
        zip(FEATURE_COLS, model.feature_importances_),
        key=lambda x: x[1],
        reverse=True,
    )
    for name, imp in importance[:5]:
        print(f"    {name}: {imp:.4f}")

    return model


def train_score_regressor(
    X_train: np.ndarray,
    X_test: np.ndarray,
    y_train: np.ndarray,
    y_test: np.ndarray,
    label_name: str,
) -> XGBRegressor:
    """Train XGBoost regressor for score prediction."""
    print(f"\n{'=' * 60}")
    print(f"TRAINING: {label_name} Score Regressor")
    print("=" * 60)

    model = XGBRegressor(
        n_estimators=200,
        max_depth=6,
        learning_rate=0.1,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
    )

    model.fit(X_train, y_train)

    # Predictions
    y_pred = model.predict(X_test)

    # Metrics
    mae = mean_absolute_error(y_test, y_pred)
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    r2 = r2_score(y_test, y_pred)

    print(f"\n  MAE:  {mae:.2f} points")
    print(f"  RMSE: {rmse:.2f} points")
    print(f"  R²:   {r2:.4f}")

    # Baseline: predict mean
    baseline_mae = mean_absolute_error(y_test, np.full_like(y_test, y_train.mean()))
    print(f"\n  Baseline MAE (predict mean): {baseline_mae:.2f} points")
    print(f"  Improvement over baseline:    -{(baseline_mae - mae):.2f} points")

    return model


def main():
    MODEL_DIR.mkdir(exist_ok=True)

    # Load data
    df = load_data()

    # Prepare features and labels
    X = df[FEATURE_COLS].values
    y_winner = df["winner"].values
    y_red_score = df["red_score"].values
    y_blue_score = df["blue_score"].values

    # Scale features
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # Train/test split (stratified by winner)
    X_train, X_test, y_win_train, y_win_test, y_red_train, y_red_test, y_blue_train, y_blue_test = (
        train_test_split(
            X_scaled,
            y_winner,
            y_red_score,
            y_blue_score,
            test_size=0.2,
            stratify=y_winner,
            random_state=42,
        )
    )

    print(f"\nTrain set: {len(X_train)} matches")
    print(f"Test set:  {len(X_test)} matches")

    # Train models
    clf = train_winner_classifier(X_train, X_test, y_win_train, y_win_test)
    red_reg = train_score_regressor(
        X_train, X_test, y_red_train, y_red_test, "Red Alliance"
    )
    blue_reg = train_score_regressor(
        X_train, X_test, y_blue_train, y_blue_test, "Blue Alliance"
    )

    # Save models
    joblib.dump(clf, MODEL_DIR / "winner_classifier.joblib")
    joblib.dump(red_reg, MODEL_DIR / "red_score_regressor.joblib")
    joblib.dump(blue_reg, MODEL_DIR / "blue_score_regressor.joblib")
    joblib.dump(scaler, MODEL_DIR / "feature_scaler.joblib")

    # Save feature column list for inference
    joblib.dump(FEATURE_COLS, MODEL_DIR / "feature_columns.joblib")

    print(f"\n{'=' * 60}")
    print("MODELS SAVED")
    print("=" * 60)
    print(f"  {MODEL_DIR / 'winner_classifier.joblib'}")
    print(f"  {MODEL_DIR / 'red_score_regressor.joblib'}")
    print(f"  {MODEL_DIR / 'blue_score_regressor.joblib'}")
    print(f"  {MODEL_DIR / 'feature_scaler.joblib'}")
    print(f"  {MODEL_DIR / 'feature_columns.joblib'}")
    print("\nDone! Models are ready for the prediction server.")


if __name__ == "__main__":
    main()
