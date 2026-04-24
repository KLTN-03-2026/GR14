"""
Real Estate AI Valuation — FastAPI Service v2.0
Uses 3 LightGBM models: median, lower-bound (10%), upper-bound (90%)
"""
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
import joblib
import numpy as np
import pandas as pd
import os

app = FastAPI(title="Real Estate AI Valuation API", version="2.0.0")

# ─── Model paths ──────────────────────────────────────────────────
MODEL_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATHS = {
    "median": os.path.join(MODEL_DIR, "model_median.joblib"),
    "low": os.path.join(MODEL_DIR, "model_low.joblib"),
    "high": os.path.join(MODEL_DIR, "model_high.joblib"),
}
# Fallback to old single model
OLD_MODEL_PATH = os.path.join(MODEL_DIR, "model.joblib")

models = {}

@app.on_event("startup")
def load_models():
    global models
    loaded = 0
    for name, path in MODEL_PATHS.items():
        if os.path.exists(path):
            try:
                models[name] = joblib.load(path)
                print(f"  ✓ Loaded {name} model from {path}")
                loaded += 1
            except Exception as e:
                print(f"  ✗ Error loading {name} model: {e}")

    # Fallback: load old single model as median
    if "median" not in models and os.path.exists(OLD_MODEL_PATH):
        try:
            models["median"] = joblib.load(OLD_MODEL_PATH)
            print(f"  ✓ Loaded legacy model as median from {OLD_MODEL_PATH}")
        except Exception as e:
            print(f"  ✗ Error loading legacy model: {e}")

    if models:
        print(f"\n  {len(models)} model(s) loaded successfully.")
    else:
        print("\n  WARNING: No models loaded! Run train.py first.")


# ─── Schema ───────────────────────────────────────────────────────
class ValuationRequest(BaseModel):
    province_name: str
    district_name: str
    property_type_name: str
    area: float = Field(gt=0)
    bedroom_count: int = 0
    bathroom_count: int = 0
    floors: int = 0
    direction: str = "Không rõ"
    legal_status: str = "Không rõ"
    front_width: float = 0.0

class ValuationResponse(BaseModel):
    estimated_price: float
    price_per_m2: float
    min_price: float
    max_price: float
    min_price_per_m2: float
    max_price_per_m2: float
    confidence: float
    model_version: str = "v2.0-lightgbm"


# ─── Features expected by model ──────────────────────────────────
FEATURES = [
    "province_name", "district_name", "property_type_name",
    "direction", "legal_status",
    "area", "bedroom_count", "bathroom_count", "floors", "front_width"
]


@app.post("/predict", response_model=ValuationResponse)
def predict_price(req: ValuationRequest):
    if "median" not in models:
        raise HTTPException(status_code=503, detail="Model is not loaded. Run train.py first.")

    input_data = pd.DataFrame([{
        "province_name": req.province_name,
        "district_name": req.district_name,
        "property_type_name": req.property_type_name,
        "direction": req.direction or "Không rõ",
        "legal_status": req.legal_status or "Không rõ",
        "area": req.area,
        "bedroom_count": req.bedroom_count,
        "bathroom_count": req.bathroom_count,
        "floors": req.floors,
        "front_width": req.front_width,
    }])

    try:
        # Predict log(price/m²) then convert back
        pred_log = models["median"].predict(input_data)[0]
        price_per_m2 = float(np.expm1(pred_log))

        # Quantile models for confidence interval
        if "low" in models and "high" in models:
            low_log = models["low"].predict(input_data)[0]
            high_log = models["high"].predict(input_data)[0]
            min_price_m2 = float(np.expm1(low_log))
            max_price_m2 = float(np.expm1(high_log))
            # Confidence = 1 - (range / median)
            spread = (max_price_m2 - min_price_m2) / price_per_m2 if price_per_m2 > 0 else 1
            confidence = max(0.5, min(0.98, 1 - spread / 2))
        else:
            # Fallback ±15%
            min_price_m2 = price_per_m2 * 0.85
            max_price_m2 = price_per_m2 * 1.15
            confidence = 0.75

        # Ensure min < median < max
        min_price_m2 = min(min_price_m2, price_per_m2)
        max_price_m2 = max(max_price_m2, price_per_m2)

        # Avoid negative
        price_per_m2 = max(price_per_m2, 100000)
        min_price_m2 = max(min_price_m2, 100000)
        max_price_m2 = max(max_price_m2, 100000)

        estimated_price = price_per_m2 * req.area
        min_price = min_price_m2 * req.area
        max_price = max_price_m2 * req.area

        return ValuationResponse(
            estimated_price=estimated_price,
            price_per_m2=price_per_m2,
            min_price=min_price,
            max_price=max_price,
            min_price_per_m2=min_price_m2,
            max_price_per_m2=max_price_m2,
            confidence=round(confidence, 2),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "models_loaded": list(models.keys()),
        "version": "v2.0-lightgbm",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
