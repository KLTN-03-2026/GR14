FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

# Copy source (will be overridden by volume mount in dev)
COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "--host"]
