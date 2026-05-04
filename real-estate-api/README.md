# 🔧 Real Estate API — NestJS Backend

Backend RESTful API cho nền tảng bất động sản, xây dựng bằng **NestJS 11** + **TypeScript** + **Prisma ORM**.

## 📐 Kiến trúc

```
src/
├── main.ts                       # Bootstrap + Swagger + Helmet + CORS
├── app.module.ts                 # Root module
├── prisma/                       # PrismaService (global)
├── common/                       # Shared infrastructure
│   ├── cloudinary/               #   Image upload CDN
│   ├── mail/                     #   Email via Resend API + RabbitMQ consumer
│   ├── redis/                    #   Redis cache (ioredis)
│   └── utils/                    #   Shared helpers
└── modules/                      # 22 feature modules
    ├── auth/                     #   JWT + Google OAuth + OTP + Refresh Token
    ├── user/                     #   User CRUD + role assignment
    ├── customer/                 #   Customer profiles
    ├── employee/                 #   Staff management + SLA tracking
    ├── role/                     #   RBAC roles
    ├── profile/                  #   User profile management
    ├── house/                    #   House CRUD + Cloudinary images
    ├── land/                     #   Land CRUD + Cloudinary images
    ├── property-category/        #   Property categories (HOUSE/LAND)
    ├── favorite/                 #   Bookmark houses/lands
    ├── featured/                 #   Featured properties for homepage
    ├── appointment/              #   Scheduling + auto-assign via RabbitMQ + SLA
    ├── deposit/                  #   Property deposit management
    ├── post/                     #   News/listings + approval workflow + VIP
    ├── payment/                  #   VNPay + MoMo integration
    ├── vip-package/              #   VIP packages + subscriptions
    ├── notification/             #   In-app notifications
    ├── ai/                       #   RAG Chatbot (Gemini/Ollama + Qdrant)
    ├── recommendation/           #   Hybrid AI property suggestions
    ├── fengshui/                 #   Feng shui analysis (bát trạch, mệnh cung)
    ├── valuation/                #   Proxy to ML valuation service
    └── analytics/                #   Admin KPI dashboards (7 report types)
```

## 🚀 Khởi chạy

### Qua Docker (khuyến nghị)

Xem [README gốc](../README.md) — backend chạy tự động cùng Docker Compose.

### Chạy local (development)

```bash
# 1. Cài đặt dependencies
npm install

# 2. Cấu hình .env
cp .env.example .env
# → Sửa DATABASE_URL, JWT_SECRET, CLOUDINARY_*, MAIL_*, etc.

# 3. Generate Prisma client + migrate
npx prisma generate
npx prisma migrate dev

# 4. Seed dữ liệu mẫu
npx prisma db seed

# 5. Chạy dev server (watch mode)
npm run start:dev
```

API chạy tại `http://localhost:5000/api`

## 📚 API Endpoints chính

### Authentication (`/api/auth`)
| Method | Path | Mô tả |
|--------|------|-------|
| POST | `/auth/login` | Đăng nhập (JWT access + refresh) |
| POST | `/auth/register` | Đăng ký + gửi OTP email |
| POST | `/auth/verify-otp` | Xác thực OTP |
| POST | `/auth/google` | Đăng nhập Google OAuth |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/forgot-password` | Gửi OTP reset password |
| POST | `/auth/reset-password` | Đặt mật khẩu mới |

### Properties (`/api/houses`, `/api/lands`)
| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/houses` | Danh sách nhà (filter, paginate, sort) |
| GET | `/houses/:id` | Chi tiết nhà |
| POST | `/houses` | Tạo nhà mới (Admin/Employee) |
| PUT | `/houses/:id` | Cập nhật nhà |
| DELETE | `/houses/:id` | Xoá nhà |
| GET | `/lands` | Danh sách đất |
| GET | `/lands/:id` | Chi tiết đất |

### AI & Recommendation (`/api/ai`, `/api/recommendations`)
| Method | Path | Mô tả |
|--------|------|-------|
| POST | `/ai/chat` | RAG chatbot hỏi đáp |
| POST | `/ai/index` | Index data vào Qdrant |
| GET | `/recommendations/ai` | Hybrid AI gợi ý BĐS |
| GET | `/recommendations/houses` | Gợi ý nhà (rule-based) |
| GET | `/recommendations/lands` | Gợi ý đất (rule-based) |
| POST | `/recommendations/track` | Ghi nhận hành vi user |

### Appointments (`/api/appointments`)
| Method | Path | Mô tả |
|--------|------|-------|
| POST | `/appointments` | Đặt lịch hẹn → auto-assign NV |
| GET | `/appointments` | Danh sách lịch hẹn |
| PUT | `/appointments/:id` | Cập nhật trạng thái |

### Payment (`/api/payment`)
| Method | Path | Mô tả |
|--------|------|-------|
| POST | `/payment/create` | Tạo thanh toán VNPay/MoMo |
| GET | `/payment/vnpay/callback` | VNPay callback |
| POST | `/payment/momo/callback` | MoMo callback |
| GET | `/payment/packages` | Danh sách gói VIP |

### Analytics (`/api/analytics`) — Admin only
| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/analytics/overview` | Tổng quan dashboard |
| GET | `/analytics/users` | Thống kê người dùng |
| GET | `/analytics/revenue` | Thống kê doanh thu |
| GET | `/analytics/appointments` | Thống kê lịch hẹn |
| GET | `/analytics/behavior` | Phân tích hành vi |
| GET | `/analytics/employees` | KPI nhân viên |

## 🗄️ Database Schema

**18 models** Prisma — MySQL 8.0:

| Model | Mô tả |
|-------|-------|
| `User` | Người dùng hệ thống |
| `Role`, `UserRole` | RBAC (ADMIN, EMPLOYEE, CUSTOMER) |
| `Customer`, `Employee` | Profile theo role |
| `House`, `HouseImage` | BĐS nhà + ảnh |
| `Land`, `LandImage` | BĐS đất + ảnh |
| `PropertyCategory` | Danh mục BĐS (HOUSE/LAND) |
| `Appointment` | Lịch hẹn xem BĐS + SLA tracking |
| `PropertyDeposit` | Đặt cọc BĐS |
| `Favorite` | Yêu thích BĐS |
| `Post`, `PostImage` | Bài đăng tin/mua bán |
| `UserBehavior` | Tracking click/save cho recommendation |
| `VipPackage`, `VipSubscription` | Gói VIP + đăng ký |
| `Payment`, `PaymentTransaction` | Thanh toán VNPay/MoMo |
| `Notification` | Thông báo in-app |
| `RefreshToken` | JWT refresh tokens |
| `PasswordReset` | OTP reset mật khẩu |

### Status Conventions
| Model | Giá trị | Ý nghĩa |
|-------|---------|---------|
| User/House/Land | 0=inactive, 1=active | Soft delete |
| Post | 1=pending, 2=approved, 3=rejected | Duyệt bài |
| Appointment | 0=pending, 1=approved, 2=rejected | Duyệt lịch hẹn |
| SLA | 0=on_track, 1=at_risk, 2=breached | SLA tracking |
| Payment | 0=pending, 1=success, 2=failed | Thanh toán |

## 🔧 Message Queues (RabbitMQ)

| Queue | Consumer | Chức năng |
|-------|----------|-----------|
| `mail_queue` | MailConsumer | Gửi email async (OTP, thông báo lịch hẹn, thanh toán) |
| `appointment_auto_assign_queue` | AppointmentConsumer | Tự động phân công NV theo khu vực + workload |

## 📦 Scripts

```bash
npm run start:dev      # Dev server (watch mode)
npm run start:prod     # Production
npm run build          # Build production bundle
npm run lint           # ESLint fix
npm run format         # Prettier format
npm run test           # Unit tests
npm run test:e2e       # E2E tests

# Prisma
npm run prisma:generate  # Generate Prisma client
npm run prisma:migrate   # Run migrations
npm run prisma:seed      # Seed database
npm run prisma:studio    # GUI database browser
```

## 🔗 Dependencies chính

| Package | Vai trò |
|---------|---------|
| `@nestjs/core` 11.x | Framework |
| `@prisma/client` 5.22 | Database ORM |
| `@nestjs/passport` + `passport-jwt` | JWT authentication |
| `@nestjs/throttler` | Rate limiting |
| `@nestjs/schedule` | Cron jobs |
| `@nestjs/microservices` | RabbitMQ integration |
| `amqp-connection-manager` | RabbitMQ client |
| `ioredis` | Redis client |
| `cloudinary` | Image upload |
| `axios` | HTTP client (Qdrant, Ollama, Gemini, VNPay, MoMo) |
| `bcrypt` | Password hashing |
| `helmet` | Security headers |
| `compression` | Gzip responses |
| `class-validator` | DTO validation |
