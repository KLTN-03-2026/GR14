"""
Real Estate AI Valuation — Training Pipeline v2.0
==================================================
Mục đích: Huấn luyện 3 mô hình LightGBM để dự đoán giá bất động sản Việt Nam.

Kiến trúc 3 mô hình:
  - model_median  : Dự đoán giá trung vị (alpha=0.5) — đây là giá chính trả về FE
  - model_low     : Dự đoán cận dưới 10th percentile (alpha=0.1) — giá thấp nhất hợp lý
  - model_high    : Dự đoán cận trên 90th percentile (alpha=0.9) — giá cao nhất hợp lý

Kỹ thuật chính:
  - Dataset: 3.5 triệu tin rao từ HuggingFace (tinixai/vietnam-real-estates)
  - Target: log(giá/m²) thay vì giá tuyệt đối — xử lý phân phối lệch của giá BĐS
  - Encoding: TargetEncoder cho categorical features (tỉnh, quận, loại BĐS, hướng)
  - Quantile Regression: Tạo khoảng tin cậy thực thụ thay vì ±% cố định
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
# Đường dẫn lưu 3 file model sau khi train xong
MODEL_PATH      = os.path.join(MODEL_DIR, "model_median.joblib")
MODEL_LOW_PATH  = os.path.join(MODEL_DIR, "model_low.joblib")
MODEL_HIGH_PATH = os.path.join(MODEL_DIR, "model_high.joblib")

# Chỉ load 10 cột cần thiết từ HuggingFace thay vì toàn bộ dataset
# → tiết kiệm ~60% RAM, tránh OOM khi xử lý 3.5M rows
HF_COLUMNS = [
    "province_name", "district_name", "property_type_name",
    "house_direction", "price", "area",
    "bedroom_count", "bathroom_count", "floor_count", "frontage_width",
]

# Features phân loại (chuỗi) → sẽ được TargetEncoder chuyển thành số
CATEGORICAL_FEATURES = ["province_name", "district_name", "property_type_name", "direction", "legal_status"]

# Features số → sẽ được StandardScaler chuẩn hóa về cùng scale
NUMERIC_FEATURES = ["area", "bedroom_count", "bathroom_count", "floors", "front_width"]

# Tổng 10 features đầu vào của mô hình
ALL_FEATURES = CATEGORICAL_FEATURES + NUMERIC_FEATURES


# ─── Bước 1: Load HuggingFace dataset ────────────────────────────
def load_data() -> pd.DataFrame:
    """
    Load dataset BĐS Việt Nam từ HuggingFace Hub.

    - Mặc định load toàn bộ 3.5M rows (có thể giới hạn bằng env HF_SAMPLE_SIZE)
    - Chỉ chuyển 10 cột cần thiết sang pandas để tiết kiệm RAM
    - Rename cột cho nhất quán với phần còn lại của code
    - Tối ưu dtype: dùng category và float32 thay vì object và float64
    """
    from datasets import load_dataset

    # Cho phép chạy thử với số lượng rows nhỏ hơn qua biến môi trường
    sample = int(os.environ.get("HF_SAMPLE_SIZE", "0"))
    if sample > 0:
        print(f"Loading HuggingFace dataset ({sample:,} rows)...")
        ds = load_dataset("tinixai/vietnam-real-estates", split=f"train[:{sample}]")
    else:
        print("Loading HuggingFace dataset (FULL 3.5M rows)...")
        ds = load_dataset("tinixai/vietnam-real-estates", split="train")

    # Chỉ lấy 10 cột cần thiết trước khi chuyển sang pandas
    # → Tránh load toàn bộ ~100+ cột không cần dùng
    print("  Converting to pandas (selected columns only)...")
    df = ds.select_columns(HF_COLUMNS).to_pandas()

    # Xóa dataset HuggingFace khỏi RAM ngay sau khi đã chuyển xong
    del ds
    gc.collect()

    print(f"  Loaded {len(df):,} rows, memory: {df.memory_usage(deep=True).sum() / 1e6:.0f} MB")

    # Đổi tên cột cho nhất quán với tên feature trong model
    df = df.rename(columns={
        "floor_count":    "floors",       # số tầng
        "frontage_width": "front_width",  # chiều rộng mặt tiền (m)
        "house_direction": "direction",   # hướng nhà
    })
    # Dataset HuggingFace không có cột legal_status → điền mặc định "Không rõ"
    df["legal_status"] = "Không rõ"

    # Tối ưu dtype để giảm RAM:
    # - categorical: lưu như bảng enum thay vì string lặp lại
    # - float32: đủ độ chính xác cho BĐS, nhẹ hơn float64 2x
    for col in ["province_name", "district_name", "property_type_name", "direction", "legal_status"]:
        df[col] = df[col].fillna("Không rõ").astype("category")
    for col in ["bedroom_count", "bathroom_count", "floors", "front_width"]:
        df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0).astype("float32")
    df["price"] = pd.to_numeric(df["price"], errors='coerce')
    df["area"]  = pd.to_numeric(df["area"],  errors='coerce').astype("float32")

    print(f"  After dtype optimization: {df.memory_usage(deep=True).sum() / 1e6:.0f} MB")
    return df


# ─── Bước 2: Tiền xử lý & tạo target ─────────────────────────────
def preprocess(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series]:
    """
    Làm sạch dữ liệu và tạo target variable cho model.

    Lý do dùng log(giá/m²) thay vì giá tuyệt đối:
      - Giá BĐS có phân phối lệch phải (một số căn giá rất cao kéo mean lên)
      - log() kéo phân phối về dạng gần normal → model học tốt hơn
      - Tính trên giá/m² (thay vì tổng giá) → so sánh công bằng giữa diện tích khác nhau
    """
    print("\nPreprocessing...")

    # Loại bỏ các dòng thiếu thông tin bắt buộc
    df = df.dropna(subset=["province_name", "district_name", "property_type_name", "area", "price"])

    # Lọc outlier: loại tin rao bất thường (giá rác, diện tích sai)
    df = df[(df["price"] > 1e7) & (df["area"] > 5) & (df["area"] < 10000)]

    # Tính giá/m² → đây là đơn vị so sánh chuẩn trong BĐS
    df["price_per_m2"] = df["price"].astype(float) / df["area"].astype(float)

    # Lọc giá/m² bất thường:
    #   - < 100K VNĐ/m²: quá rẻ, nhiều khả năng là sai dữ liệu
    #   - > 5 tỷ VNĐ/m²: quá đắt, thường là lỗi nhập liệu
    df = df[(df["price_per_m2"] > 100000) & (df["price_per_m2"] < 5e9)]

    # TARGET VARIABLE: log1p(giá/m²) = log(giá/m² + 1)
    # log1p() an toàn hơn log() vì tránh log(0) = -∞
    # Khi predict xong sẽ chuyển ngược bằng expm1()
    df["log_price_per_m2"] = np.log1p(df["price_per_m2"])

    # Chuyển categorical về string cho TargetEncoder (không nhận dtype category)
    for col in CATEGORICAL_FEATURES:
        df[col] = df[col].astype(str).fillna("Không rõ")
    for col in NUMERIC_FEATURES:
        df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0).astype(float)

    # Tách X (features) và y (target)
    X = df[ALL_FEATURES].copy()
    y = df["log_price_per_m2"].copy()

    # Loại bỏ các dòng có giá trị vô hạn hoặc NaN trong target
    valid_mask = np.isfinite(y) & ~y.isna()
    X = X[valid_mask].reset_index(drop=True)
    y = y[valid_mask].reset_index(drop=True)

    # Giải phóng RAM sau khi đã tách xong
    del df
    gc.collect()

    print(f"  Final dataset: {len(X):,} rows, {len(ALL_FEATURES)} features")
    print(f"  Price/m² range: {np.expm1(y.min()):,.0f} → {np.expm1(y.max()):,.0f} VNĐ/m²")
    return X, y


# ─── Bước 3: Xây dựng Pipeline ────────────────────────────────────
def build_pipeline(alpha: float = 0.5) -> Pipeline:
    """
    Tạo sklearn Pipeline gồm 2 bước:
      1. Preprocessor (ColumnTransformer):
         - TargetEncoder: chuyển categorical features → số dựa trên trung bình giá
           (smoothing=10 để tránh overfitting với category ít mẫu)
         - StandardScaler: chuẩn hóa numeric features về mean=0, std=1
      2. Regressor (LGBMRegressor):
         - alpha=0.5 → LightGBM standard (tối ưu MSE) → cho model_median
         - alpha=0.1 → Quantile Regression percentile 10 → cho model_low
         - alpha=0.9 → Quantile Regression percentile 90 → cho model_high

    Tại sao dùng Quantile Regression?
      - Thay vì dự đoán 1 con số + manual ±15%, model tự học phân phối thực tế
      - Khoảng tin cậy (min-max) phản ánh đúng độ biến động giá ở từng khu vực
    """
    # Preprocessor xử lý 2 nhóm features khác nhau
    preprocessor = ColumnTransformer(
        transformers=[
            # TargetEncoder: thay thế tên tỉnh/quận bằng giá trung bình của khu vực đó
            # smoothing=10: cân bằng giữa giá trung bình local và global, tránh overfit
            ("cat", TargetEncoder(cols=CATEGORICAL_FEATURES, smoothing=10), CATEGORICAL_FEATURES),
            # StandardScaler: đưa diện tích, số phòng, v.v. về cùng scale với encoded features
            ("num", StandardScaler(), NUMERIC_FEATURES),
        ],
        remainder="drop"  # Bỏ các cột không nằm trong 2 nhóm trên
    )

    if alpha == 0.5:
        # Model chính: tối ưu MSE để dự đoán giá trung vị chính xác nhất
        regressor = lgb.LGBMRegressor(
            n_estimators=200,        # Số cây trong forest — nhiều hơn để model chính chính xác hơn
            learning_rate=0.05,      # Học chậm để tránh overfit
            max_depth=7,             # Độ sâu cây — đủ để capture pattern phức tạp
            num_leaves=50,           # Số lá — LightGBM dùng leaf-wise growth
            min_child_samples=20,    # Tối thiểu 20 mẫu mỗi lá — tránh overfit
            subsample=0.8,           # Chỉ dùng 80% data mỗi lần build cây — tránh overfit
            colsample_bytree=0.8,    # Chỉ dùng 80% features mỗi cây — tránh overfit
            reg_alpha=0.1,           # L1 regularization
            reg_lambda=1.0,          # L2 regularization (mạnh hơn để penalty outlier)
            random_state=42,
            n_jobs=1,                # 1 thread để tránh conflict với HuggingFace dataloader
            verbose=-1,              # Tắt log của LightGBM
        )
    else:
        # Model quantile: tối ưu pinball loss thay vì MSE
        # alpha=0.1 → dự đoán giá mà 10% tin rao thực tế thấp hơn mức này
        # alpha=0.9 → dự đoán giá mà 90% tin rao thực tế thấp hơn mức này
        regressor = lgb.LGBMRegressor(
            objective="quantile",    # Chuyển sang Quantile Regression
            alpha=alpha,             # Percentile cần dự đoán (0.1 hoặc 0.9)
            n_estimators=150,        # Ít cây hơn model chính vì quantile ít phức tạp hơn
            learning_rate=0.05,
            max_depth=6,
            num_leaves=31,           # Ít lá hơn để đơn giản hóa (quantile không cần quá phức tạp)
            min_child_samples=30,    # Nhiều mẫu hơn để đảm bảo quantile ổn định
            subsample=0.8,
            colsample_bytree=0.8,
            random_state=42,
            n_jobs=1,
            verbose=-1,
        )

    # Gói preprocessor + regressor vào Pipeline sklearn
    # → Khi gọi predict(), tự động chạy qua preprocessor trước rồi mới predict
    # → Đảm bảo transform nhất quán giữa train và inference
    return Pipeline([
        ("preprocessor", preprocessor),
        ("regressor", regressor),
    ])


# ─── Bước 4: Hàm train chính ──────────────────────────────────────
def train():
    """
    Orchestrate toàn bộ quá trình huấn luyện:
      1. Load dữ liệu từ HuggingFace
      2. Tiền xử lý & tạo target
      3. Split train/test (80/20)
      4. Train model_median → đánh giá R² và MAE
      5. Train model_low (quantile 10%)
      6. Train model_high (quantile 90%)
      7. Lưu 3 file .joblib
      8. Sanity check với 3 ví dụ thực tế
    """
    print("=" * 60)
    print("Real Estate AI Valuation — Training Pipeline v2.0")
    print("=" * 60)

    # 1. Load dữ liệu
    df = load_data()

    # 2. Tiền xử lý — tạo X (features) và y (log giá/m²)
    X, y = preprocess(df)
    del df  # Giải phóng RAM ngay sau khi xử lý xong
    gc.collect()

    # Kiểm tra đủ dữ liệu tối thiểu để train
    if len(X) < 100:
        print("ERROR: Not enough data after preprocessing.")
        sys.exit(1)

    # 3. Split 80/20: 80% để train, 20% để đánh giá (không dùng trong train)
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    print(f"\n  Train: {len(X_train):,}, Test: {len(X_test):,}")

    # 4. Train model MEDIAN — đây là model chính, tối ưu MSE (alpha=0.5)
    print("\n── Training MEDIAN model (LightGBM) ──")
    model_median = build_pipeline(alpha=0.5)
    model_median.fit(X_train, y_train)

    # Đánh giá: R² = 1.0 là hoàn hảo, > 0.8 là tốt cho BĐS
    r2 = model_median.score(X_test, y_test)
    print(f"  R² Score: {r2:.4f}")

    # MAE: chuyển từ log scale về giá thực để dễ diễn giải
    # expm1() là nghịch của log1p() → chuyển log(giá/m²) về giá/m² thực
    y_pred_test = model_median.predict(X_test)
    mae = np.mean(np.abs(np.expm1(y_test) - np.expm1(y_pred_test)))
    print(f"  MAE (price/m²): {mae:,.0f} VNĐ/m²")

    # 5. Train model quantile để tạo khoảng tin cậy
    print("\n── Training LOWER bound model (10th percentile) ──")
    model_low = build_pipeline(alpha=0.1)
    model_low.fit(X_train, y_train)
    print("  Done.")

    print("\n── Training UPPER bound model (90th percentile) ──")
    model_high = build_pipeline(alpha=0.9)
    model_high.fit(X_train, y_train)
    print("  Done.")

    # 6. Lưu cả 3 model vào file .joblib
    # joblib.dump() lưu toàn bộ Pipeline (encoder + scaler + model) vào 1 file
    # → Khi load lại chỉ cần joblib.load() là dùng được ngay
    joblib.dump(model_median, MODEL_PATH)
    joblib.dump(model_low,    MODEL_LOW_PATH)
    joblib.dump(model_high,   MODEL_HIGH_PATH)
    print(f"\nModels saved:")
    print(f"  Median: {MODEL_PATH}")
    print(f"  Lower:  {MODEL_LOW_PATH}")
    print(f"  Upper:  {MODEL_HIGH_PATH}")

    # 7. Sanity check: thử predict 3 ví dụ thực tế để xác nhận model hoạt động đúng
    print("\n── Sanity Check ──")
    test_cases = [
        # Nhà Quận 1 HCM — kỳ vọng giá cao nhất (~80-150 Tr/m²)
        {"province_name": "Hồ Chí Minh", "district_name": "Quận 1", "property_type_name": "Nhà", "area": 50, "bedroom_count": 3, "bathroom_count": 2, "floors": 3, "direction": "Đông Nam", "legal_status": "Không rõ", "front_width": 4.0},
        # Đất Hải Châu Đà Nẵng — giá trung bình
        {"province_name": "Đà Nẵng", "district_name": "Hải Châu", "property_type_name": "Đất", "area": 100, "bedroom_count": 0, "bathroom_count": 0, "floors": 0, "direction": "Không rõ", "legal_status": "Không rõ", "front_width": 5.0},
        # Căn hộ Cầu Giấy Hà Nội — giá trung bình cao
        {"province_name": "Hà Nội", "district_name": "Cầu Giấy", "property_type_name": "Căn hộ chung cư", "area": 70, "bedroom_count": 2, "bathroom_count": 2, "floors": 1, "direction": "Đông Nam", "legal_status": "Không rõ", "front_width": 0},
    ]
    for tc in test_cases:
        test_df = pd.DataFrame([tc])

        # Predict ở log scale rồi chuyển về giá thực bằng expm1()
        pred_log      = model_median.predict(test_df)[0]
        pred_low_log  = model_low.predict(test_df)[0]
        pred_high_log = model_high.predict(test_df)[0]

        price_m2 = np.expm1(pred_log)      # Giá trung vị (VNĐ/m²)
        low_m2   = np.expm1(pred_low_log)  # Cận dưới (VNĐ/m²)
        high_m2  = np.expm1(pred_high_log) # Cận trên (VNĐ/m²)
        total    = price_m2 * tc["area"]   # Tổng giá = giá/m² × diện tích

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
