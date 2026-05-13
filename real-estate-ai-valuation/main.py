"""
Real Estate AI Valuation — FastAPI Inference Service v2.0
==========================================================
Mục đích: Serve 3 mô hình LightGBM đã train để dự đoán giá BĐS qua REST API.

Endpoint chính:
  POST /predict  → Nhận thông tin BĐS, trả về giá ước tính + khoảng tin cậy
  GET  /health   → Kiểm tra trạng thái service và danh sách model đã load

Luồng dự đoán:
  1. Nhận request JSON từ NestJS
  2. Normalize tên loại BĐS (FE gửi nhiều dạng khác nhau → map về tên chuẩn trong dataset)
  3. Tạo DataFrame 1 dòng từ input
  4. Predict bằng 3 model → kết quả ở dạng log(giá/m²)
  5. Chuyển ngược bằng expm1() → giá thực (VNĐ/m²)
  6. Tính confidence từ khoảng cách min-max
  7. Trả JSON về NestJS
"""
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
import joblib
import numpy as np
import pandas as pd
import os

app = FastAPI(title="Real Estate AI Valuation API", version="2.0.0")

# ─── Đường dẫn model ──────────────────────────────────────────────
MODEL_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATHS = {
    "median": os.path.join(MODEL_DIR, "model_median.joblib"),  # Model chính — dự đoán giá trung vị
    "low":    os.path.join(MODEL_DIR, "model_low.joblib"),     # Cận dưới 10th percentile
    "high":   os.path.join(MODEL_DIR, "model_high.joblib"),    # Cận trên 90th percentile
}
# Hỗ trợ backward compat với model cũ (nếu có)
OLD_MODEL_PATH = os.path.join(MODEL_DIR, "model.joblib")

# Dict lưu các model đã load — key là "median"/"low"/"high"
models = {}


# ─── Load model khi khởi động service ─────────────────────────────
@app.on_event("startup")
def load_models():
    """
    Load tất cả 3 model .joblib vào RAM khi FastAPI khởi động.

    Tại sao load lúc startup thay vì mỗi request?
      - joblib.load() đọc file ~550KB-1MB mỗi lần → chậm nếu làm mỗi request
      - Load 1 lần vào RAM → các request sau chỉ cần gọi model.predict() ngay lập tức

    Fallback: Nếu không có model mới, thử load model.joblib cũ làm median.
    """
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

    # Fallback: dùng model cũ nếu chưa train model mới
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


# ─── Schema request/response ──────────────────────────────────────
class ValuationRequest(BaseModel):
    """
    Dữ liệu đầu vào từ NestJS — phải khớp với 10 features mà model đã train.
    Pydantic tự động validate kiểu dữ liệu và raise lỗi 422 nếu không hợp lệ.
    """
    province_name: str          # Tỉnh/Thành phố — bắt buộc
    district_name: str          # Quận/Huyện — bắt buộc
    property_type_name: str     # Loại BĐS (Nhà, Đất, Căn hộ, ...) — bắt buộc
    area: float = Field(gt=0)   # Diện tích m² — bắt buộc, phải > 0
    bedroom_count: int = 0      # Số phòng ngủ — mặc định 0 (đất không có)
    bathroom_count: int = 0     # Số phòng tắm — mặc định 0
    floors: int = 0             # Số tầng — mặc định 0
    direction: str = "Không rõ"     # Hướng nhà — mặc định nếu không biết
    legal_status: str = "Không rõ"  # Pháp lý — mặc định nếu không biết
    front_width: float = 0.0    # Mặt tiền (m) — mặc định 0

class ValuationResponse(BaseModel):
    """
    Kết quả trả về NestJS — 6 trường giá + confidence + version.
    NestJS sẽ dùng các giá trị này để tính toán và hiển thị cho FE.
    """
    estimated_price: float      # Tổng giá ước tính (VNĐ) = price_per_m2 × area
    price_per_m2: float         # Giá trung vị/m² (VNĐ/m²)
    min_price: float            # Tổng giá cận dưới (VNĐ)
    max_price: float            # Tổng giá cận trên (VNĐ)
    min_price_per_m2: float     # Giá cận dưới/m² (từ model_low)
    max_price_per_m2: float     # Giá cận trên/m² (từ model_high)
    confidence: float           # Độ tin cậy 0.0-1.0 (khoảng min-max càng hẹp → càng cao)
    model_version: str = "v2.0-lightgbm"  # Phiên bản model để debug/tracking


# ─── Thứ tự features phải khớp với lúc train ──────────────────────
FEATURES = [
    "province_name", "district_name", "property_type_name",
    "direction", "legal_status",
    "area", "bedroom_count", "bathroom_count", "floors", "front_width"
]


# ─── Bảng map tên loại BĐS từ FE → tên trong dataset ─────────────
# Vấn đề: Frontend gửi nhiều dạng tên khác nhau (có "Bán" prefix, viết tắt, ...)
# Nhưng TargetEncoder trong model chỉ nhận đúng tên đã thấy lúc train
# → Nếu không map sẽ bị encode sai → giá dự đoán sai hoàn toàn
PROPERTY_TYPE_MAP = {
    # Tên chuẩn từ FE (viết thường)
    "nhà":                     "Nhà",
    "nhà phố":                 "Nhà phố",
    "biệt thự":                "Biệt thự",
    "căn hộ chung cư":         "Căn hộ chung cư",
    "đất":                     "Đất",
    # Các biến thể / tên cũ
    "nhà ở":                   "Nhà",
    "nhà riêng":               "Nhà",
    "nhà mặt phố":             "Nhà phố",
    "nhà biệt thự":            "Biệt thự",
    "căn hộ":                  "Căn hộ chung cư",
    "chung cư":                "Căn hộ chung cư",
    "đất nền":                 "Đất",
    "đất thổ cư":              "Đất thổ cư",
    "đất nông nghiệp":         "Đất nông nghiệp",
    "văn phòng":               "Văn phòng",
    "mặt bằng":                "Mặt bằng",
    "shophouse":               "Shophouse",
    # FE cũ có prefix "Bán" — đây là cách phân loại theo loại giao dịch
    "bán căn hộ chung cư":     "Căn hộ chung cư",
    "bán nhà riêng":           "Nhà",
    "bán biệt thự, liền kề":   "Biệt thự",
    "bán nhà mặt phố":         "Nhà phố",
    "bán đất":                 "Đất",
}

def normalize_property_type(raw: str) -> str:
    """
    Chuyển tên loại BĐS từ FE về tên chuẩn trong dataset huấn luyện.

    Nếu không tìm thấy trong bảng map → giữ nguyên (tránh crash, model sẽ
    encode thành giá trị global mean — vẫn cho kết quả, nhưng kém chính xác hơn).
    """
    return PROPERTY_TYPE_MAP.get(raw.strip().lower(), raw)


# ─── Endpoint dự đoán chính ───────────────────────────────────────
@app.post("/predict", response_model=ValuationResponse)
def predict_price(req: ValuationRequest):
    """
    Nhận thông tin 1 BĐS → trả về giá ước tính + khoảng tin cậy.

    Luồng xử lý:
      1. Kiểm tra model đã load chưa (503 nếu chưa)
      2. Normalize tên loại BĐS
      3. Tạo DataFrame 1 dòng từ request
      4. Predict log(giá/m²) bằng cả 3 model
      5. Chuyển ngược về giá thực bằng expm1()
      6. Tính confidence từ spread (max-min)/median
      7. Đảm bảo tính logic (min ≤ median ≤ max, không âm)
      8. Tính tổng giá = giá/m² × diện tích
      9. Trả về ValuationResponse
    """
    # Kiểm tra model_median phải tồn tại (model chính)
    if "median" not in models:
        raise HTTPException(status_code=503, detail="Model is not loaded. Run train.py first.")

    # Bước 2: Normalize tên loại BĐS (vd: "bán căn hộ chung cư" → "Căn hộ chung cư")
    property_type = normalize_property_type(req.property_type_name)

    # Bước 3: Tạo DataFrame 1 dòng — sklearn Pipeline cần input dạng DataFrame
    input_data = pd.DataFrame([{
        "province_name":      req.province_name,
        "district_name":      req.district_name,
        "property_type_name": property_type,
        "direction":          req.direction or "Không rõ",
        "legal_status":       req.legal_status or "Không rõ",
        "area":               req.area,
        "bedroom_count":      req.bedroom_count,
        "bathroom_count":     req.bathroom_count,
        "floors":             req.floors,
        "front_width":        req.front_width,
    }])

    try:
        # Bước 4 & 5: Predict bằng model_median → convert từ log về giá thực
        # predict() tự chạy qua TargetEncoder + StandardScaler rồi mới đưa vào LightGBM
        pred_log    = models["median"].predict(input_data)[0]
        price_per_m2 = float(np.expm1(pred_log))  # VD: log(30,150,000) → 30,150,000 VNĐ/m²

        # Bước 4 & 5 (quantile): Tính cận dưới và cận trên nếu có model low/high
        if "low" in models and "high" in models:
            low_log  = models["low"].predict(input_data)[0]
            high_log = models["high"].predict(input_data)[0]
            min_price_m2 = float(np.expm1(low_log))   # Cận dưới 10th percentile
            max_price_m2 = float(np.expm1(high_log))  # Cận trên 90th percentile

            # Bước 6: Tính confidence (độ tin cậy)
            # spread = (max - min) / median → đo độ biến động tương đối
            # Khu vực giá ổn định → spread nhỏ → confidence cao (gần 1.0)
            # Khu vực giá biến động mạnh → spread lớn → confidence thấp
            # Giới hạn: tối thiểu 0.5 (luôn có ý nghĩa), tối đa 0.98 (không bao giờ chắc chắn 100%)
            spread     = (max_price_m2 - min_price_m2) / price_per_m2 if price_per_m2 > 0 else 1
            confidence = max(0.5, min(0.98, 1 - spread / 2))
        else:
            # Fallback ±15% nếu không có model quantile (chạy với model cũ)
            min_price_m2 = price_per_m2 * 0.85
            max_price_m2 = price_per_m2 * 1.15
            confidence   = 0.75

        # Bước 7: Đảm bảo tính logic của kết quả
        # min ≤ median ≤ max (đôi khi quantile model có thể cho kết quả đảo lộn)
        min_price_m2 = min(min_price_m2, price_per_m2)
        max_price_m2 = max(max_price_m2, price_per_m2)

        # Không cho giá về âm hoặc cực nhỏ (100,000 VNĐ/m² là mức sàn hợp lý)
        price_per_m2 = max(price_per_m2, 100000)
        min_price_m2 = max(min_price_m2, 100000)
        max_price_m2 = max(max_price_m2, 100000)

        # Bước 8: Tính tổng giá = giá/m² × diện tích
        estimated_price = price_per_m2 * req.area
        min_price       = min_price_m2 * req.area
        max_price       = max_price_m2 * req.area

        # Bước 9: Trả về response
        return ValuationResponse(
            estimated_price  = estimated_price,
            price_per_m2     = price_per_m2,
            min_price        = min_price,
            max_price        = max_price,
            min_price_per_m2 = min_price_m2,
            max_price_per_m2 = max_price_m2,
            confidence       = round(confidence, 2),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")


# ─── Health check ─────────────────────────────────────────────────
@app.get("/health")
def health_check():
    """
    Endpoint kiểm tra trạng thái service.
    NestJS hoặc Kubernetes dùng endpoint này để biết service còn sống không.
    Trả về danh sách model đã load — nếu thiếu "median" thì /predict sẽ fail.
    """
    return {
        "status":        "ok",
        "models_loaded": list(models.keys()),  # ["median", "low", "high"] nếu đủ
        "version":       "v2.0-lightgbm",
    }


if __name__ == "__main__":
    import uvicorn
    # Chạy trực tiếp: python main.py → http://localhost:8000
    uvicorn.run(app, host="0.0.0.0", port=8000)
