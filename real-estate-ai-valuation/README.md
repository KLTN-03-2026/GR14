# Real Estate AI Valuation Service

Đây là service độc lập dùng để huấn luyện mô hình Machine Learning và phục vụ dự đoán giá bất động sản.

## Cài đặt (Yêu cầu Python 3.9+)

1. Mở terminal tại thư mục này: `cd real-estate-ai-valuation`
2. Tạo môi trường ảo (khuyến nghị):
   ```bash
   python -m venv venv
   .\venv\Scripts\activate
   ```
3. Cài đặt thư viện:
   ```bash
   pip install -r requirements.txt
   ```

## Huấn luyện mô hình
Chạy file train để tải dataset `tinixai/vietnam-real-estates` và huấn luyện mô hình:
```bash
python train.py
```
Sau khi chạy xong, bạn sẽ thấy file `model.joblib` được sinh ra.

## Chạy Server API (FastAPI)
Để khởi động server phục vụ cho NestJS backend gọi sang:
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
API sẽ chạy tại `http://localhost:8000`. Bạn có thể xem tài liệu API tại `http://localhost:8000/docs`.
