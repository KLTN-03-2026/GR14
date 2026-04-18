# CLAUDE.md — Real Estate Platform

## Project Overview

Full-stack real estate e-commerce platform (monorepo) with a NestJS backend API, React frontend, and optional AI/RAG stack.

### Key Access Points

| Service | Port | URL |
|---------|------|-----|
| Frontend (React) | 3000 | http://localhost:3000 |
| Backend (NestJS) | 5000 | http://localhost:5000/api |
| Adminer (DB GUI) | 8080 | http://localhost:8080 |
| RabbitMQ UI | 15672 | http://localhost:15672 (guest/guest) |
| MySQL | 3307 | localhost:3307 |
| Redis | 6379 | localhost:6379 |
| Qdrant (AI) | 6333 | http://localhost:6333 |
| Ollama (AI) | 11434 | http://localhost:11434 |

Default admin credentials: `admin` / `admin123`

---

## Repository Structure

```
real-estate/
├── real-estate-api/        # NestJS 11 backend (TypeScript)
├── real-estate-frontend/   # React 19 + Vite frontend (TypeScript)
├── real-estate-AI/         # Optional RAG stack (Ollama + Qdrant + n8n)
├── n8n-workflows/          # Workflow automation templates
├── docker-compose.yml      # Main orchestration (5 services)
├── .env                    # Root environment config
└── .env.example            # Environment template
```

---

## Common Commands

### Docker (recommended for full stack)
```bash
docker compose up --build          # Start all services
docker compose down                # Stop all
docker compose down -v             # Stop + remove volumes
docker compose logs -f backend     # Stream backend logs
docker compose logs -f frontend    # Stream frontend logs
```

### Root workspace
```bash
npm run install:all                # Install all dependencies
npm run install:api                # Install backend deps only
npm run install:web                # Install frontend deps only
```

### Backend (run inside real-estate-api/)
```bash
npm run start:dev                  # Dev server with watch
npm run build                      # Compile TypeScript
npm run lint                       # ESLint with auto-fix
npm run format                     # Prettier formatting
npm run test                       # Jest unit tests
npm run test:e2e                   # End-to-end tests
npm run prisma:generate            # Regenerate Prisma client
npm run prisma:migrate             # Create and apply migrations
npm run prisma:seed                # Seed initial data
npm run prisma:studio              # Open Prisma Studio GUI
```

### Frontend (run inside real-estate-frontend/)
```bash
npm run dev                        # Vite dev server (port 3000)
npm run build                      # Production build
npm run typecheck                  # TypeScript validation
npm run lint                       # ESLint check
npm run preview                    # Preview production build
```

---

## Tech Stack

### Backend
- **Framework:** NestJS 11 (Hybrid — HTTP + RabbitMQ microservices)
- **Language:** TypeScript 5.9, Node.js 20
- **ORM:** Prisma v5 with MySQL 8
- **Auth:** JWT (access + refresh tokens), Passport.js, Google OAuth
- **Cache:** Redis 7 via ioredis
- **Queue:** RabbitMQ 3 via amqplib + amqp-connection-manager
- **Image Storage:** Cloudinary v2
- **Email:** Nodemailer (Gmail SMTP)
- **Security:** Helmet, bcrypt, rate limiting (100 req/60s), global validation pipe
- **API Prefix:** `/api`

### Frontend
- **Framework:** React 19 + Vite 7
- **Routing:** React Router v7
- **State:** Zustand (client), TanStack React Query (server)
- **UI:** Ant Design v6 + Tailwind CSS v3 + MUI v7
- **HTTP:** Axios with centralized service layer
- **Editor:** CKEditor 5
- **Calendar:** FullCalendar v6
- **Charts:** Recharts v3

### Infrastructure
- **Containerization:** Docker + Docker Compose
- **CI/CD:** GitHub Actions (ci.yml for lint/build, deploy.yml)
- **AI Stack (optional):** Ollama + Qdrant + n8n in `real-estate-AI/`

---

## Architecture

### Backend — NestJS Hybrid App

The backend runs as a hybrid application: HTTP server on port 5000 + two RabbitMQ consumers.

**RabbitMQ queues:**
- `mail_queue` — async email delivery
- `appointment_auto_assign_queue` — auto-assign appointments to employees

**Module layout** (`real-estate-api/src/modules/`):

| Module | Purpose |
|--------|---------|
| `auth` | JWT login, register, Google OAuth, password reset |
| `user` | User CRUD + role management |
| `customer` | Customer profiles |
| `employee` | Staff with SLA tracking & auto-assign |
| `house` | House listings + image upload |
| `land` | Land listings + image upload |
| `appointment` | Scheduling with SLA deadlines |
| `post` | News/blog/classified posts |
| `favorite` | Bookmarked properties |
| `payment` | VNPay + MoMo integration |
| `ai` | RAG chatbot + description generation |
| `analytics` | Admin KPI dashboards |
| `recommendation` | ML-based property suggestions |
| `fengshui` | Feng shui analysis |
| `vip-package` | VIP subscription management |
| `featured` | Featured property listings |
| `role` | RBAC roles (ADMIN, EMPLOYEE, CUSTOMER) |

**Shared common modules** (`src/common/`): `CloudinaryModule`, `MailModule`, `RedisModule`, `PrismaModule`

### Frontend Structure

```
real-estate-frontend/src/
├── pages/          # Separated by role: admin/, employee/, public/, auth/
├── components/     # Reusable UI components
├── api/            # Centralized Axios service layer
├── stores/         # Zustand state stores
├── hooks/          # Custom React hooks
├── routes/         # React Router config
└── types/          # TypeScript interfaces
```

### Database (Prisma/MySQL)

Key models: `User`, `Role`, `UserRole`, `RefreshToken`, `PasswordReset`, `Customer`, `Employee`, `House`, `HouseImage`, `Land`, `LandImage`, `Appointment`, `Post`, `Favorite`, `FeaturedProperty`, `Payment`, `VipSubscription`, `UserBehavior`

Common patterns:
- Soft deletes via `status` field (`0` = inactive, `1` = active)
- `createdAt` / `updatedAt` timestamps on all models
- SLA tracking fields on `Appointment` (`slaStatus`, `slaAssignDeadlineAt`, `slaFirstContactDeadlineAt`)
- Schema: `real-estate-api/prisma/schema.prisma`

---

## Environment Variables

Root `.env` drives the Docker Compose setup. Critical variables:

```
# Database
MYSQL_ROOT_PASSWORD, MYSQL_DATABASE, DB_PORT

# Auth
JWT_SECRET, JWT_EXPIRES, JWT_REFRESH_SECRET, JWT_REFRESH_EXPIRES

# External Services
CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASSWORD
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET

# Payment (Vietnamese gateways)
VNPAY_TMN_CODE, VNPAY_HASH_SECRET, VNPAY_URL, VNPAY_RETURN_URL
MOMO_PARTNER_CODE, MOMO_ACCESS_KEY, MOMO_SECRET_KEY, ...

# AI / LLM
GEMINI_API_KEY, LLM_PROVIDER, OLLAMA_URL, QDRANT_URL
CHAT_MODEL, EMBED_MODEL, RAG_COLLECTION, RAG_TOP_K

# Frontend
VITE_API_BASE_URL, VITE_GOOGLE_CLIENT_ID, FE_PORT
```

Backend also reads `real-estate-api/.env` for `DATABASE_URL` and `PORT`.
Frontend reads `real-estate-frontend/.env` for `VITE_*` variables.

---

## Key Implementation Notes

1. **Hybrid NestJS app:** Do not break the dual transport setup in `main.ts` — HTTP and RabbitMQ consumers must both initialize.

2. **Prisma migrations:** Always run `npm run prisma:generate` after schema changes before starting the server. Migrations are applied automatically in Docker via the Dockerfile entrypoint.

3. **Auth flow:** Access tokens are short-lived JWT; refresh tokens are stored in DB (`RefreshToken` model) with max-per-user enforcement and revocation support.

4. **Multi-LLM support:** The `ai` module supports both Gemini (cloud) and Ollama (local) via `LLM_PROVIDER` env var. The AI stack is optional and lives in `real-estate-AI/` with its own `docker-compose.yml`.

5. **Payment callbacks:** VNPay and MoMo use return URLs and notify URLs — ensure these match the environment when testing payment flows.

6. **Image uploads:** All property images go through Cloudinary. The `CloudinaryModule` is a shared module imported by `house` and `land` modules.

7. **Role guard:** Use the `@Roles()` decorator + `RolesGuard` for endpoint protection. Roles: `ADMIN`, `EMPLOYEE`, `CUSTOMER`.

8. **Vite build:** For memory-constrained environments use `npm run build:ram-safe` (sets `NODE_OPTIONS=--max-old-space-size=4096`).

---

## CI/CD

- **ci.yml:** Runs on push/PR to `main` — lints and builds both frontend and backend, runs `prisma generate`
- **deploy.yml:** Deployment workflow
- Current branch convention: feature branches off `main`, PRs merged via GitHub
