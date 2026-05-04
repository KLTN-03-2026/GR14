# 📊 Real Estate AI Valuation Service

Service **Python FastAPI** độc lập dùng để dự đoán giá bất động sản bằng Machine Learning.

## 📐 Kiến trúc

```
NestJS Backend (valuation module)
    │
    ▼ POST /predict
FastAPI Server (:8000)
    │
    ├── model_low.joblib      ← GradientBoosting → Giá sàn
    ├── model_median.joblib   ← GradientBoosting → Giá kỳ vọng
    └── model_high.joblib     ← GradientBoosting → Giá trần
```

## Mô hình ML

| Model | File | Mô tả |
|-------|------|-------|
| Giá sàn | `model_low.joblib` | Quantile regression (lower bound) |
| Giá kỳ vọng | `model_median.joblib` | Median prediction |
| Giá trần | `model_high.joblib` | Quantile regression (upper bound) |

**Thuật toán**: GradientBoosting Regressor (scikit-learn)
**Training data**: 3.5M+ giao dịch thực tế từ dataset `tinixai/vietnam-real-estates`

### Input Features
| Feature | Kiểu | Mô tả |
|---------|------|-------|
| `province` | string | Tỉnh/Thành phố |
| `district` | string | Quận/Huyện |
| `propertyType` | string | Loại BĐS (căn hộ, nhà riêng, biệt thự, nhà mặt phố, đất) |
| `area` | float | Diện tích (m²) |
| `bedrooms` | int | Số phòng ngủ |
| `bathrooms` | int | Số phòng tắm |
| `floors` | int | Số tầng |
| `frontWidth` | float | Mặt tiền (m) |
| `direction` | string | Hướng nhà |
| `legalStatus` | string | Pháp lý |

## 🚀 Cài đặt

### Qua Docker (khuyến nghị)

Service chạy tự động trong Docker Compose (port 8000). Xem [README gốc](../README.md).

### Chạy local

**Yêu cầu**: Python 3.9+

```bash
# 1. Mở terminal tại thư mục này
cd real-estate-ai-valuation

# 2. Tạo môi trường ảo
python -m venv venv
.\venv\Scripts\activate        # Windows
# source venv/bin/activate     # Linux/Mac

# 3. Cài đặt thư viện
pip install -r requirements.txt
```

## 🎓 Huấn luyện mô hình

```bash
python train.py
```

Script sẽ:
1. Tải dataset `tinixai/vietnam-real-estates` từ Hugging Face
2. Tiền xử lý: Label Encoding cho categorical features
3. Train 3 GradientBoosting models (low/median/high)
4. Lưu thành `model_low.joblib`, `model_median.joblib`, `model_high.joblib`

## 🖥️ Chạy Server

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

| URL | Mô tả |
|-----|-------|
| http://localhost:8000 | API server |
| http://localhost:8000/docs | Swagger UI (tài liệu API tương tác) |
| http://localhost:8000/health | Health check |

## 📚 API Endpoints

| Method | Path | Mô tả |
|--------|------|-------|
| POST | `/predict` | Dự đoán giá BĐS (trả về min/expected/max) |
| GET | `/health` | Health check |

**Request example:**
```json
{
  "province": "Hồ Chí Minh",
  "district": "Quận 7",
  "propertyType": "Nhà riêng",
  "area": 80,
  "bedrooms": 3,
  "bathrooms": 2,
  "floors": 3,
  "frontWidth": 5,
  "direction": "Đông Nam",
  "legalStatus": "Sổ hồng"
}
```

**Response:**
```json
{
  "currentValue": 5200000000,
  "pricePerM2": 65000000,
  "range": {
    "min": 4500000000,
    "expected": 5200000000,
    "max": 6100000000
  }
}
```
