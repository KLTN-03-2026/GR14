"""
Real Estate AI Valuation — Training Pipeline v2.0
==================================================
- Full 3.5M HuggingFace dataset (tinixai/vietnam-real-estates)
- LightGBM with log-transform price/m²
- Target encoding for categorical features
- Quantile regression for real confidence intervals
- Memory-optimized: only loads needed columns, uses efficient dtypes
"""
import os
import sys
import gc
import warnings
import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler
from category_encoders import TargetEncoder
import lightgbm as lgb

warnings.filterwarnings('ignore')

# ─── Config ────────────────────────────────────────────────────────
MODEL_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(MODEL_DIR, "model_median.joblib")
MODEL_LOW_PATH = os.path.join(MODEL_DIR, "model_low.joblib")
MODEL_HIGH_PATH = os.path.join(MODEL_DIR, "model_high.joblib")

# Columns we actually need from HuggingFace (ignore the rest to save memory)
HF_COLUMNS = [
    "province_name", "district_name", "property_type_name",
    "house_direction", "price", "area",
    "bedroom_count", "bathroom_count", "floor_count", "frontage_width",
]

# Model features
CATEGORICAL_FEATURES = ["province_name", "district_name", "property_type_name", "direction", "legal_status"]
NUMERIC_FEATURES = ["area", "bedroom_count", "bathroom_count", "floors", "front_width"]
ALL_FEATURES = CATEGORICAL_FEATURES + NUMERIC_FEATURES


# ─── Load HuggingFace dataset (memory-optimized) ──────────────────
def load_data() -> pd.DataFrame:
    """Load full HuggingFace dataset, keeping only needed columns."""
    from datasets import load_dataset

    sample = int(os.environ.get("HF_SAMPLE_SIZE", "0"))
    if sample > 0:
        print(f"Loading HuggingFace dataset ({sample:,} rows)...")
        ds = load_dataset("tinixai/vietnam-real-estates", split=f"train[:{sample}]")
    else:
        print("Loading HuggingFace dataset (FULL 3.5M rows)...")
        ds = load_dataset("tinixai/vietnam-real-estates", split="train")

    # Only convert needed columns to pandas (saves ~60% memory)
    print("  Converting to pandas (selected columns only)...")
    df = ds.select_columns(HF_COLUMNS).to_pandas()
    del ds
    gc.collect()

    print(f"  Loaded {len(df):,} rows, memory: {df.memory_usage(deep=True).sum() / 1e6:.0f} MB")

    # Rename to standard names
    df = df.rename(columns={
        "floor_count": "floors",
        "frontage_width": "front_width",
        "house_direction": "direction",
    })
    df["legal_status"] = "Không rõ"

    # Optimize dtypes to save memory
    for col in ["province_name", "district_name", "property_type_name", "direction", "legal_status"]:
        df[col] = df[col].fillna("Không rõ").astype("category")
    for col in ["bedroom_count", "bathroom_count", "floors", "front_width"]:
        df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0).astype("float32")
    df["price"] = pd.to_numeric(df["price"], errors='coerce')
    df["area"] = pd.to_numeric(df["area"], errors='coerce').astype("float32")

    print(f"  After dtype optimization: {df.memory_usage(deep=True).sum() / 1e6:.0f} MB")
    return df


# ─── Preprocessing ─────────────────────────────────────────────────
def preprocess(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series]:
    """Clean data and prepare target (log price per m²)."""
    print("\nPreprocessing...")

    # Drop rows without price or area
    df = df.dropna(subset=["province_name", "district_name", "property_type_name", "area", "price"])

    # Filter outliers
    df = df[(df["price"] > 1e7) & (df["area"] > 5) & (df["area"] < 10000)]
    df["price_per_m2"] = df["price"].astype(float) / df["area"].astype(float)
    df = df[(df["price_per_m2"] > 100000) & (df["price_per_m2"] < 5e9)]

    # Target = log(price_per_m2)
    df["log_price_per_m2"] = np.log1p(df["price_per_m2"])

    # Convert categories back to string for TargetEncoder
    for col in CATEGORICAL_FEATURES:
        df[col] = df[col].astype(str).fillna("Không rõ")
    for col in NUMERIC_FEATURES:
        df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0).astype(float)

    X = df[ALL_FEATURES].copy()
    y = df["log_price_per_m2"].copy()

    # Remove infinite / NaN
    valid_mask = np.isfinite(y) & ~y.isna()
    X = X[valid_mask].reset_index(drop=True)
    y = y[valid_mask].reset_index(drop=True)

    # Free memory
    del df
    gc.collect()

    print(f"  Final dataset: {len(X):,} rows, {len(ALL_FEATURES)} features")
    print(f"  Price/m² range: {np.expm1(y.min()):,.0f} → {np.expm1(y.max()):,.0f} VNĐ/m²")
    return X, y


# ─── Build Model Pipeline ─────────────────────────────────────────
def build_pipeline(alpha: float = 0.5) -> Pipeline:
    preprocessor = ColumnTransformer(
        transformers=[
            ("cat", TargetEncoder(cols=CATEGORICAL_FEATURES, smoothing=10), CATEGORICAL_FEATURES),
            ("num", StandardScaler(), NUMERIC_FEATURES),
        ],
        remainder="drop"
    )

    if alpha == 0.5:
        regressor = lgb.LGBMRegressor(
            n_estimators=200,
            learning_rate=0.05,
            max_depth=7,
            num_leaves=50,
            min_child_samples=20,
            subsample=0.8,
            colsample_bytree=0.8,
            reg_alpha=0.1,
            reg_lambda=1.0,
            random_state=42,
            n_jobs=1,
            verbose=-1,
        )
    else:
        regressor = lgb.LGBMRegressor(
            objective="quantile",
            alpha=alpha,
            n_estimators=150,
            learning_rate=0.05,
            max_depth=6,
            num_leaves=31,
            min_child_samples=30,
            subsample=0.8,
            colsample_bytree=0.8,
            random_state=42,
            n_jobs=1,
            verbose=-1,
        )

    return Pipeline([
        ("preprocessor", preprocessor),
        ("regressor", regressor),
    ])


# ─── Training ─────────────────────────────────────────────────────
def train():
    print("=" * 60)
    print("Real Estate AI Valuation — Training Pipeline v2.0")
    print("=" * 60)

    # 1. Load data (HuggingFace only)
    df = load_data()

    # 2. Preprocess
    X, y = preprocess(df)
    del df
    gc.collect()

    if len(X) < 100:
        print("ERROR: Not enough data after preprocessing.")
        sys.exit(1)

    # 3. Split
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    print(f"\n  Train: {len(X_train):,}, Test: {len(X_test):,}")

    # 4. Train median model (main)
    print("\n── Training MEDIAN model (LightGBM) ──")
    model_median = build_pipeline(alpha=0.5)
    model_median.fit(X_train, y_train)

    r2 = model_median.score(X_test, y_test)
    print(f"  R² Score: {r2:.4f}")

    # MAE in original scale
    y_pred_test = model_median.predict(X_test)
    mae = np.mean(np.abs(np.expm1(y_test) - np.expm1(y_pred_test)))
    print(f"  MAE (price/m²): {mae:,.0f} VNĐ/m²")

    # 5. Train quantile models
    print("\n── Training LOWER bound model (10th percentile) ──")
    model_low = build_pipeline(alpha=0.1)
    model_low.fit(X_train, y_train)
    print("  Done.")

    print("\n── Training UPPER bound model (90th percentile) ──")
    model_high = build_pipeline(alpha=0.9)
    model_high.fit(X_train, y_train)
    print("  Done.")

    # 6. Save all models
    joblib.dump(model_median, MODEL_PATH)
    joblib.dump(model_low, MODEL_LOW_PATH)
    joblib.dump(model_high, MODEL_HIGH_PATH)
    print(f"\nModels saved:")
    print(f"  Median: {MODEL_PATH}")
    print(f"  Lower:  {MODEL_LOW_PATH}")
    print(f"  Upper:  {MODEL_HIGH_PATH}")

    # 7. Sanity check
    print("\n── Sanity Check ──")
    test_cases = [
        {"province_name": "Hồ Chí Minh", "district_name": "Quận 1", "property_type_name": "Nhà", "area": 50, "bedroom_count": 3, "bathroom_count": 2, "floors": 3, "direction": "Đông Nam", "legal_status": "Không rõ", "front_width": 4.0},
        {"province_name": "Đà Nẵng", "district_name": "Hải Châu", "property_type_name": "Đất", "area": 100, "bedroom_count": 0, "bathroom_count": 0, "floors": 0, "direction": "Không rõ", "legal_status": "Không rõ", "front_width": 5.0},
        {"province_name": "Hà Nội", "district_name": "Cầu Giấy", "property_type_name": "Căn hộ chung cư", "area": 70, "bedroom_count": 2, "bathroom_count": 2, "floors": 1, "direction": "Đông Nam", "legal_status": "Không rõ", "front_width": 0},
    ]
    for tc in test_cases:
        test_df = pd.DataFrame([tc])
        pred_log = model_median.predict(test_df)[0]
        pred_low_log = model_low.predict(test_df)[0]
        pred_high_log = model_high.predict(test_df)[0]

        price_m2 = np.expm1(pred_log)
        low_m2 = np.expm1(pred_low_log)
        high_m2 = np.expm1(pred_high_log)
        total = price_m2 * tc["area"]

        print(f"  {tc['district_name']}, {tc['province_name']}:")
        print(f"    → {price_m2/1e6:.1f} Tr/m² (range: {low_m2/1e6:.1f} - {high_m2/1e6:.1f})")
        print(f"    → Total: {total/1e9:.2f} Tỷ")

    print("\n" + "=" * 60)
    print("Training complete!")
    print(f"Dataset: 3.5M rows | R² = {r2:.4f} | MAE = {mae:,.0f} VNĐ/m²")
    print("=" * 60)


if __name__ == "__main__":
    import traceback
    try:
        train()
    except Exception as e:
        print(f"\n\nFATAL ERROR: {e}")
        traceback.print_exc()
        sys.exit(1)
