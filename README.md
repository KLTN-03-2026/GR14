# 🏡 Real Estate Platform — Fullstack Application

Nền tảng mua bán bất động sản (nhà, đất) tích hợp **AI Chatbot**, **Định giá ML**, **Gợi ý cá nhân hoá** và **Phong thuỷ**. Xây dựng bằng **NestJS**, **React 19**, **Python FastAPI** và **Docker**.

## 📐 Kiến trúc hệ thống

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Client (Browser)                              │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   React 19 + Vite       │ :3000
                    │   Ant Design + Zustand  │
                    │   TailwindCSS + Recharts│
                    └────────────┬────────────┘
                                 │ REST API
                    ┌────────────▼────────────┐
                    │   NestJS Backend        │ :5000
                    │   Prisma ORM + JWT      │
                    │   22 Business Modules   │
                    └──┬──────┬──────┬──────┬─┘
                       │      │      │      │
           ┌───────────▼┐  ┌──▼───┐ ┌▼────┐ ┌▼──────────────┐
           │  MySQL 8   │  │Redis │ │Rabbit│ │  Cloudinary   │
           │  Prisma ORM│  │Cache │ │MQ    │ │  Image CDN    │
           └────────────┘  └──────┘ └──────┘ └───────────────┘
                       │
         ┌─────────────┼──────────────┐
         │             │              │
   ┌─────▼─────┐ ┌────▼────┐  ┌──────▼──────┐
   │  Ollama   │ │ Qdrant  │  │ AI Valuation│
   │  LLM      │ │ Vector  │  │ FastAPI     │ :8000
   │  RAG Chat │ │ DB      │  │ ML Models   │
   └───────────┘ └─────────┘  └─────────────┘
```

## 🚀 Quick Start

### Yêu cầu
- **Docker** & **Docker Compose** (v2.0+)
- **Git**
- Tối thiểu **8GB RAM** (khuyến nghị 16GB nếu chạy AI stack)

### Cài đặt & Khởi chạy

```bash
# 1. Clone repository
git clone https://github.com/NguyenLe1104/Real-estate.git
cd Real-estate

# 2. Cấu hình environment
cp .env.example .env
# → Sửa .env: MySQL password, JWT secret, Cloudinary, Email SMTP, API keys

# 3. Khởi chạy toàn bộ services
docker compose up --build

# 4. (Tuỳ chọn) Khởi chạy AI Stack — RAG Chatbot
cd real-estate-AI
cp .env.example .env
docker compose --env-file .env up -d
docker exec -it real-estate-ollama ollama pull qwen2.5:7b
docker exec -it real-estate-ollama ollama pull nomic-embed-text
```

### Thời gian khởi động
| Service | Thời gian | Kiểm tra |
|---------|-----------|----------|
| MySQL | ~30-40s | `docker compose logs db` |
| Redis + RabbitMQ | ~10s | Port 6379, 15672 |
| NestJS Backend | ~20-30s | http://localhost:5000/api |
| React Frontend | ~10s | http://localhost:3000 |
| AI Valuation | ~5s | http://localhost:8000/docs |

## 📝 Tài khoản mặc định

| Role | Username | Password |
|------|----------|----------|
| Admin | `admin` | `admin123` |

> ⚠️ **Bắt buộc đổi mật khẩu** khi deploy production!

## 🌐 Truy cập

| Service | URL | Ghi chú |
|---------|-----|---------|
| Frontend | http://localhost:3000 | Giao diện chính |
| Backend API | http://localhost:5000/api | REST API |
| Adminer (DB GUI) | http://localhost:8080 | MySQL management |
| RabbitMQ Management | http://localhost:15672 | Queue monitoring (guest/guest) |
| AI Valuation Docs | http://localhost:8000/docs | Swagger FastAPI |

## 📂 Cấu trúc dự án

```
Real-estate/
├── real-estate-api/              # NestJS Backend (TypeScript)
│   ├── src/
│   │   ├── modules/              # 22 feature modules
│   │   │   ├── ai/               #   RAG Chatbot (Gemini/Ollama + Qdrant)
│   │   │   ├── analytics/        #   Dashboard thống kê KPI
│   │   │   ├── appointment/      #   Lịch hẹn + auto-assign RabbitMQ
│   │   │   ├── auth/             #   JWT + Google OAuth + OTP
│   │   │   ├── deposit/          #   Đặt cọc BĐS
│   │   │   ├── fengshui/         #   Phong thuỷ bát trạch
│   │   │   ├── house/            #   CRUD nhà + Cloudinary
│   │   │   ├── land/             #   CRUD đất + Cloudinary
│   │   │   ├── payment/          #   VNPay + MoMo
│   │   │   ├── post/             #   Bài đăng + duyệt bài
│   │   │   ├── recommendation/   #   Hybrid AI gợi ý BĐS
│   │   │   ├── valuation/        #   Định giá ML
│   │   │   └── ...               #   user, role, favorite, vip, etc.
│   │   ├── common/               # Shared: Mail, Redis, Cloudinary, Utils
│   │   └── prisma/               # Database ORM
│   ├── prisma/
│   │   ├── schema.prisma         # 18 models database schema
│   │   ├── seed.ts               # Dữ liệu mẫu
│   │   └── migrations/           # DB migrations
│   └── Dockerfile
│
├── real-estate-frontend/         # React 19 Frontend (TypeScript)
│   ├── src/
│   │   ├── pages/                # 30+ page components
│   │   │   ├── public/           #   Trang công khai
│   │   │   ├── admin/            #   Quản trị admin
│   │   │   └── employee/         #   Dashboard nhân viên
│   │   ├── components/           # Reusable components
│   │   ├── api/                  # Axios API layer
│   │   ├── stores/               # Zustand state management
│   │   └── types/                # TypeScript interfaces
│   └── Dockerfile
│
├── real-estate-AI/               # AI Stack (Docker Compose riêng)
│   ├── docker-compose.yml        # Ollama + Qdrant
│   └── README.md
│
├── real-estate-ai-valuation/     # ML Valuation Service (Python)
│   ├── main.py                   # FastAPI server
│   ├── train.py                  # Training script
│   ├── model_*.joblib            # 3 pre-trained GradientBoosting models
│   └── Dockerfile
│
├── .github/workflows/            # CI/CD
│   ├── ci.yml                    # Lint + Build check
│   ├── deploy.yml                # Deploy main stack to VPS
│   └── deploy-ai.yml             # Deploy AI stack to VPS
│
├── docker-compose.yml            # Orchestration: DB, Redis, RabbitMQ, API, FE, AI
├── .env.example                  # Template biến môi trường
└── platform-features.md          # Tài liệu nghiệp vụ chi tiết
```

## ⭐ Tính năng chính

### 🏠 Quản lý BĐS
- CRUD nhà / đất với upload ảnh Cloudinary (drag & drop, sắp xếp vị trí)
- Danh sách + bộ lọc nâng cao (giá, diện tích, khu vực, hướng, phòng ngủ)
- Phân trang, sắp xếp, tìm kiếm full-text
- Gallery ảnh kiểu Airbnb + Lightbox fullscreen
- Tích hợp Google Maps theo địa chỉ

### 🤖 AI & Machine Learning
- **RAG Chatbot**: Hỏi đáp thông minh về BĐS sử dụng Gemini/Ollama + Qdrant vector search
- **Hybrid Recommendation**: Gợi ý BĐS cá nhân hoá bằng embedding + rule-based scoring
- **Định giá ML**: 3 mô hình GradientBoosting dự đoán giá sàn/kỳ vọng/trần
- **Phong thuỷ**: Phân tích bát trạch, mệnh cung, ngũ hành, hướng tốt/xấu

### 💰 Thanh toán & VIP
- Tích hợp **VNPay** + **MoMo** payment gateway
- Gói VIP bài đăng + VIP tài khoản (hiển thị ưu tiên, badge)
- Đặt cọc BĐS online

### 📅 Quản lý lịch hẹn
- Đặt lịch xem BĐS với chọn ngày/giờ/thời lượng
- **Auto-assign** nhân viên qua RabbitMQ (theo khu vực + workload)
- **SLA tracking**: on_track → at_risk → breached
- Calendar view (FullCalendar)

### 📊 Analytics Dashboard (Admin)
- 7 tab phân tích: Tổng quan, Người dùng, Bài đăng, Doanh thu, Lịch hẹn, Hành vi, Nhân viên
- Biểu đồ Recharts (area, donut, bar charts)
- Export Excel/PDF

### 🔐 Bảo mật
- JWT access + refresh token
- Google OAuth 2.0
- OTP xác thực email qua RabbitMQ
- Role-based access control (ADMIN, EMPLOYEE, CUSTOMER)
- Helmet + CORS + Compression

## 🛠️ Tech Stack

### Backend
| Công nghệ | Phiên bản | Vai trò |
|-----------|-----------|---------|
| NestJS | 11.x | Framework backend |
| TypeScript | 5.9 | Ngôn ngữ lập trình |
| Prisma | 5.22 | Database ORM |
| MySQL | 8.0 | Cơ sở dữ liệu |
| Redis | 7 | Cache layer |
| RabbitMQ | 3 | Message broker (mail, auto-assign) |
| Passport + JWT | - | Authentication |
| Cloudinary | - | Image CDN |
| Axios | - | HTTP client (Qdrant, Ollama, Gemini) |
| Resend | - | Email delivery API |

### Frontend
| Công nghệ | Phiên bản | Vai trò |
|-----------|-----------|---------|
| React | 19.2 | UI framework |
| TypeScript | 5.9 | Ngôn ngữ lập trình |
| Vite | 7.3 | Build tool |
| Ant Design | 6.3 | UI component library |
| TailwindCSS | 3.4 | Utility CSS |
| Zustand | 5.0 | State management |
| TanStack Query | 5.x | Data fetching & caching |
| Recharts | 3.8 | Biểu đồ analytics |
| React Router | 7.x | Navigation |
| FullCalendar | 6.x | Calendar view |
| CKEditor 5 | - | Rich text editor |

### AI & Infrastructure
| Công nghệ | Vai trò |
|-----------|---------|
| Gemini API | LLM chính cho chatbot |
| Ollama (Qwen 2.5) | LLM fallback local |
| Qdrant | Vector database cho RAG |
| FastAPI (Python) | ML valuation service |
| scikit-learn | GradientBoosting models |
| Docker Compose | Container orchestration |
| GitHub Actions | CI/CD pipeline |
| Nginx | Reverse proxy (production) |

## 🔄 Development Workflow

```bash
# File changes auto-reload (không cần restart container):
# - Frontend: Vite HMR → browser cập nhật ngay
# - Backend: NestJS watch mode → tự compile

# Xem logs
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f db

# Truy cập shell backend
docker exec -it real-estate-backend sh

# Prisma commands (trong container backend)
npx prisma studio        # GUI database browser
npx prisma migrate dev   # Tạo migration mới
npx prisma db seed       # Chạy seed data

# Reset toàn bộ database
docker compose down -v
docker compose up --build
```

## 🚢 CI/CD & Deployment

Dự án sử dụng **GitHub Actions** với 3 workflows:

| Workflow | Trigger | Mô tả |
|----------|---------|-------|
| `ci.yml` | Push/PR → `main` | Lint + Build check |
| `deploy.yml` | Push → `main` | Deploy API + Frontend lên VPS |
| `deploy-ai.yml` | Manual | Deploy AI stack (Ollama + Qdrant) |

### Production environment
- **VPS**: DigitalOcean (Ubuntu)
- **Reverse proxy**: Nginx
- **Domain**: Cấu hình qua Nginx config
- **SSL**: Let's Encrypt (certbot)

## 🔐 Environment Variables

Xem file [.env.example](.env.example) để biết toàn bộ biến cần cấu hình. Các nhóm chính:

| Nhóm | Biến | Ghi chú |
|------|------|---------|
| Database | `MYSQL_ROOT_PASSWORD`, `MYSQL_DATABASE` | MySQL 8.0 |
| JWT | `JWT_SECRET`, `JWT_REFRESH_SECRET` | Access + Refresh token |
| Cloudinary | `CLOUDINARY_*` | Upload ảnh BĐS |
| Email | `MAIL_HOST`, `MAIL_USER`, `MAIL_PASSWORD` | Gmail App Password |
| Google OAuth | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Đăng nhập Google |
| AI | `GEMINI_API_KEY`, `LLM_PROVIDER` | Chatbot AI |
| Payment | `VNPAY_*`, `MOMO_*` | Cổng thanh toán |
| RabbitMQ | `RABBITMQ_URL` | Message broker |

## 🐛 Xử lý sự cố

<details>
<summary><strong>Container bị exit/crash</strong></summary>

```bash
docker compose logs backend    # Xem lỗi backend
docker compose logs db         # Xem lỗi database

# Nguyên nhân phổ biến:
# - Thiếu file .env → cp .env.example .env
# - Port bị chiếm → đổi DB_PORT, BE_PORT, FE_PORT trong .env
# - MySQL chưa sẵn sàng → đợi 30-40s
```
</details>

<details>
<summary><strong>Không kết nối được database</strong></summary>

```bash
docker exec real-estate-db mysql -u root -p -e "SELECT 1;"
docker compose config | grep MYSQL
```
</details>

<details>
<summary><strong>Frontend không gọi được API</strong></summary>

- Kiểm tra backend chạy: `docker ps`
- Kiểm tra `VITE_API_BASE_URL` trong `.env`
- Xem browser console (F12) để debug lỗi CORS
</details>

<details>
<summary><strong>Email OTP không gửi được</strong></summary>

- VPS thường block port 587 → dùng Resend API hoặc port 465 (SSL)
- Gmail yêu cầu **App Password** (16 ký tự), không dùng mật khẩu thường
- Kiểm tra RabbitMQ: http://localhost:15672 → queue `mail_queue`
</details>

## 📄 Tài liệu

| Tài liệu | Đường dẫn | Mô tả |
|-----------|-----------|-------|
| Nghiệp vụ chi tiết | [platform-features.md](platform-features.md) | Mô tả 40+ trang FE + API mapping |
| Backend API | [real-estate-api/README.md](real-estate-api/README.md) | NestJS modules + endpoints |
| AI Chatbot Stack | [real-estate-AI/README.md](real-estate-AI/README.md) | Ollama + Qdrant setup |
| AI Valuation | [real-estate-ai-valuation/README.md](real-estate-ai-valuation/README.md) | ML training + FastAPI |

## 📄 License

This project is private. All rights reserved.
