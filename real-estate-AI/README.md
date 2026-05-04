# 🤖 Real Estate AI Stack — RAG Chatbot

AI infrastructure stack cho hệ thống chatbot bất động sản, bao gồm **Ollama** (LLM runtime) và **Qdrant** (vector database).

## 📐 Kiến trúc

```
Frontend (React)
    │
    ▼ POST /api/ai/chat
NestJS Backend (ai module)
    │
    ├──► Qdrant (vector search)     ← Tìm BĐS liên quan qua embedding
    │       :6333
    └──► Ollama (LLM inference)     ← Sinh câu trả lời tự nhiên
            :11434
```

> **Lưu ý**: Chatbot chính chạy qua NestJS → Gemini API (mặc định). Ollama là fallback khi cần chạy offline hoặc tiết kiệm chi phí API.

## Services

| Service | Port | Mô tả |
|---------|------|-------|
| **Ollama** | 11434 | Local LLM runtime (Qwen 2.5, Llama, etc.) |
| **Qdrant** | 6333 | Vector database cho semantic search |

## 🚀 Quick Start

### 1. Khởi chạy main stack trước (từ root)

```bash
cd Real-estate
docker compose up -d
```

### 2. Cấu hình AI env

```bash
cd real-estate-AI
cp .env.example .env
```

### 3. Khởi chạy AI stack

```bash
docker compose --env-file .env up -d
```

### 4. Tải model AI

```bash
# Model chat (khuyến nghị)
docker exec -it real-estate-ollama ollama pull qwen2.5:7b

# Model embedding (bắt buộc cho RAG)
docker exec -it real-estate-ollama ollama pull nomic-embed-text
```

### 5. Index dữ liệu BĐS vào Qdrant

```bash
# Gọi API index từ backend
curl -X POST http://localhost:5000/api/ai/index?limit=80
```

## 💬 Chatbot API

Backend (NestJS) cung cấp 2 endpoint chính:

| Method | Path | Mô tả |
|--------|------|-------|
| POST | `/api/ai/chat` | RAG chatbot hỏi đáp BĐS |
| POST | `/api/ai/index?limit=80` | Index data từ DB vào Qdrant |

**Request body** cho chat:
```json
{
  "sessionId": "user-001",
  "question": "Tôi có 6 tỷ thì nên mua khu nào?"
}
```

**LLM Provider** (cấu hình qua env `LLM_PROVIDER`):
- `gemini` (mặc định) — Google Gemini API, nhanh, chất lượng cao
- `ollama` — Local LLM, miễn phí, cần GPU

## 🔧 Useful Commands

```bash
# Xem logs
docker compose logs -f ollama
docker compose logs -f qdrant

# Stop AI stack
docker compose down

# Reset toàn bộ (xoá vectors + models)
docker compose down -v

# Kiểm tra Ollama models đã tải
docker exec -it real-estate-ollama ollama list

# Tải model mạnh hơn (cần GPU/RAM lớn)
docker exec -it real-estate-ollama ollama pull qwen2.5:14b
```

## ⚙️ Cấu hình

Các biến môi trường liên quan (trong `.env` root):

| Biến | Mặc định | Mô tả |
|------|----------|-------|
| `LLM_PROVIDER` | `gemini` | `gemini` hoặc `ollama` |
| `OLLAMA_URL` | `http://host.docker.internal:11434` | Ollama endpoint |
| `QDRANT_URL` | `http://host.docker.internal:6333` | Qdrant endpoint |
| `CHAT_MODEL` | `qwen2.5:7b` | Model Ollama cho chat |
| `EMBED_MODEL` | `nomic-embed-text` | Model embedding |
| `RAG_COLLECTION` | `real_estate_rag` | Tên collection Qdrant |
| `RAG_TOP_K` | `5` | Số kết quả vector search |
| `RAG_MIN_SCORE` | `0.2` | Ngưỡng điểm tối thiểu |

## 💡 Lưu ý

- Network `real-estate-shared` là external, trỏ tới `real-estate_default`. Nếu main compose dùng network khác → cập nhật `REAL_ESTATE_SHARED_NETWORK` trong `.env`.
- **Yêu cầu phần cứng Ollama**: tối thiểu 8GB RAM cho `qwen2.5:7b`. Có GPU NVIDIA → tốc độ nhanh hơn 5-10x.
- Nếu không có GPU, nên dùng `LLM_PROVIDER=gemini` cho production.
