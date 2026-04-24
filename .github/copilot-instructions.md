# Copilot instructions for Real-estate repository

Purpose: provide concise, actionable instructions for future Copilot sessions so assistants can quickly run, test, and modify this monorepo.

1) Build, test, and lint commands

- Full-stack (recommended via Docker Compose):
  - docker compose up --build
  - docker compose down

- Root workspace helpers:
  - npm run install:all      # installs backend + frontend deps
  - npm run install:api      # installs backend deps (real-estate-api)
  - npm run install:web      # installs frontend deps (real-estate-frontend)

- Backend (real-estate-api):
  - Start dev: cd real-estate-api && npm run start:dev
  - Build:     cd real-estate-api && npm run build
  - Lint:      cd real-estate-api && npm run lint
  - Tests:     cd real-estate-api && npm run test
    - Run a single Jest test file:
      cd real-estate-api && npx jest <relative/path/to/test-file.spec.ts>
    - Run a single named test (by title pattern):
      cd real-estate-api && npx jest -t "should create user" 
  - Prisma:
    - cd real-estate-api && npm run prisma:generate
    - cd real-estate-api && npm run prisma:migrate
    - cd real-estate-api && npm run prisma:seed

- Frontend (real-estate-frontend):
  - Dev server: cd real-estate-frontend && npm run dev
  - Build:      cd real-estate-frontend && npm run build
  - Lint:       cd real-estate-frontend && npm run lint
  - Typecheck:  cd real-estate-frontend && npm run typecheck

Notes on running tests: prefer running tests from inside the package folder (real-estate-api or real-estate-frontend). Use npx jest <path> to run a single backend test file.

2) High-level architecture (big picture)

- Monorepo containing three main projects:
  - real-estate-api: NestJS 11 backend (TypeScript) — hybrid app: HTTP server (port 5000) + RabbitMQ consumers
  - real-estate-frontend: React 19 + Vite frontend (port 3000)
  - real-estate-AI: optional RAG stack (Ollama, Qdrant, n8n) used by the ai module

- Orchestration: root docker-compose.yml starts MySQL, Redis, RabbitMQ, backend, frontend, Adminer and wires envs & volumes. The AI stack has its own docker-compose in real-estate-AI/.

- Database & ORM: Prisma v5 with MySQL. Prisma client is generated in real-estate-api; migrations and seed scripts live under real-estate-api/prisma.

- Messaging & background work: RabbitMQ queues used for async tasks (example queues: mail_queue, appointment_auto_assign_queue). Backend connects over AMQP using connection manager.

- AI & RAG: Backend ai module can talk to Gemini (cloud) or Ollama (local) depending on LLM_PROVIDER. Real-estate-AI/ contains the optional vector/LLM stack and helper compose files.

3) Key repository conventions and patterns (non-obvious)

- Hybrid NestJS app: main.ts bootstraps HTTP and RabbitMQ microservices — changes that touch bootstrap should preserve both transports.

- Prisma workflow: after any schema change run `prisma:generate` before starting. Migrations are applied by Docker entrypoint in compose flows.

- Environment layout:
  - Root `.env` drives docker-compose for all services.
  - Backend reads real-estate-api/.env for DATABASE_URL and service-specific overrides.
  - Frontend reads VITE_* variables from real-estate-frontend/.env when running locally.

- Soft deletes: models use a `status` field (0 = inactive, 1 = active) rather than hard deletes in many tables.

- Auth & roles:
  - JWT access + refresh tokens; refresh tokens are persisted in DB.
  - Role-based guards use `@Roles()` decorator and `RolesGuard`. Common roles: ADMIN, EMPLOYEE, CUSTOMER.

- Image storage & uploads: Cloudinary is used via a shared CloudinaryModule; house and land modules rely on that.

- Tests: Backend uses Jest with ts-jest. Unit tests live under src and follow `*.spec.ts` naming. For debugging, test scripts include `test:debug` and `test:watch`.

- Docker volumes & dev UX: frontend uses a named volume frontend_node_modules to avoid host/node_module mismatch. When node_modules mismatch occurs, run: `docker compose run --rm frontend npm ci`.

- AI network note: real-estate-AI uses an external network variable REAL_ESTATE_SHARED_NETWORK; if the main compose file uses different network names, update the AI .env accordingly.

4) Existing AI/assistant configs to incorporate

- CLAUDE.md present at repo root — includes architecture, access ports, env names, and helpful quick-starts. Copilot should prefer README.md/CLAUDE.md content for operational details.

5) Useful quick checks for Copilot sessions

- Is Docker up? `docker compose ps` and `docker compose logs -f backend`
- Is Prisma client up-to-date? `cd real-estate-api && npx prisma generate`
- Secrets present? Confirm `.env` exists (copy from .env.example if missing).

6) Where to look for implementation details

- Backend: real-estate-api/src/modules/ (feature modules), real-estate-api/src/common (shared modules), real-estate-api/prisma (schema & seed)
- Frontend: real-estate-frontend/src/pages, src/components, src/api, src/stores
- AI: real-estate-AI/ for Ollama/Qdrant/n8n compose and README for model suggestions

---

If updates are required (add more commands, CI details, or code conventions), request edits and they will be merged into this file.
