# Real Estate AI Stack (RAG)

This folder contains a separate AI container stack for your project.

## Services

- Ollama: local/free LLM runtime
- Qdrant: vector database for embeddings and retrieval
- n8n (optional): only needed for workflow automation/demo webhooks

## Architecture

- Main chatbot path in this project: Frontend -> NestJS `/api/ai/chat` -> Qdrant/Ollama
- n8n is not required for the production chatbot path above.

## Quick Start

1. Start your main project stack first from repository root:

```bash
docker compose up -d
```

2. Configure AI env:

```bash
cd real-estate-AI
cp .env.example .env
```

3. Start AI stack:

```bash
docker compose --env-file .env up -d
```

4. Pull a free strong model into Ollama (recommended):

```bash
docker exec -it real-estate-ollama ollama pull qwen2.5:7b
```

5. (Optional) Open n8n UI only if you need workflow automation:

- URL: http://localhost:5678
- Login: from `.env` (`N8N_BASIC_AUTH_USER` / `N8N_BASIC_AUTH_PASSWORD`)

## Useful commands

```bash
# View AI logs
docker compose logs -f ollama
docker compose logs -f qdrant

# Stop AI stack
docker compose down

# Remove AI volumes (reset vectors/models/workflows)
docker compose down -v
```

## Chatbot API (current integration)

Backend API (NestJS):

- `POST http://localhost:5000/api/ai/index?limit=80` to index data from DB to vector store
- `POST http://localhost:5000/api/ai/chat` for direct RAG chat

Request body:

```json
{
  "sessionId": "user-001",
  "question": "Toi co 6 ty thi nen mua khu nao?"
}
```

## Notes

- `real-estate-shared` network is external and points to `real-estate_default` by default.
- If your main compose project uses another network name, update `REAL_ESTATE_SHARED_NETWORK` in `.env`.
- For stronger quality with modest hardware, try `qwen2.5:7b` first. If GPU/RAM allows, use a larger model (for example `qwen2.5:14b`).
