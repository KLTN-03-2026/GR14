#!/bin/bash
# Kịch bản setup AI Server (Ollama + Qdrant) trên Ubuntu

# Màu sắc cho log
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== Bắt đầu cài đặt AI Server (Ollama & Qdrant) ===${NC}"

# 1. Cài đặt Docker
if ! command -v docker &> /dev/null; then
    echo -e "${BLUE}[1/5] Cài đặt Docker...${NC}"
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
else
    echo -e "${GREEN}[1/5] Docker đã được cài đặt, bỏ qua.${NC}"
fi

# 2. Tạo thư mục và file cấu hình
echo -e "${BLUE}[2/5] Tạo thư mục và cấu hình docker-compose...${NC}"
mkdir -p ~/real-estate-ai && cd ~/real-estate-ai

cat > docker-compose.yml << 'EOF'
services:
  ollama:
    image: ollama/ollama:latest
    container_name: real-estate-ollama
    restart: unless-stopped
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    networks:
      - ai-network

  qdrant:
    image: qdrant/qdrant:v1.13.4
    container_name: real-estate-qdrant
    restart: unless-stopped
    ports:
      - "6333:6333"
      - "6334:6334"
    volumes:
      - qdrant_data:/qdrant/storage
    networks:
      - ai-network

volumes:
  ollama_data:
  qdrant_data:

networks:
  ai-network:
    name: real-estate-ai-network
EOF

# 3. Khởi động các services
echo -e "${BLUE}[3/5] Khởi động Docker containers...${NC}"
docker compose up -d

# 4. Tải các model cho Ollama
echo -e "${BLUE}[4/5] Tải models cho Ollama (qwen2.5:7b và nomic-embed-text)...${NC}"
echo "Đợi Ollama khởi động (10s)..."
sleep 10

echo "Pulling nomic-embed-text..."
docker exec real-estate-ollama ollama pull nomic-embed-text

echo "Pulling qwen2.5:7b (Có thể mất vài phút tùy tốc độ mạng)..."
docker exec real-estate-ollama ollama pull qwen2.5:7b

# 5. Hoàn tất
echo -e "${GREEN}[5/5] Hoàn tất! AI Server đã sẵn sàng.${NC}"
echo -e "Bạn có thể kiểm tra:"
echo -e "- Ollama: http://<IP_SERVER>:11434"
echo -e "- Qdrant: http://<IP_SERVER>:6333"
