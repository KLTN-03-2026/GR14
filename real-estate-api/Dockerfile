FROM node:20-alpine

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Copy prisma schema for generate
COPY prisma ./prisma
RUN npx prisma generate

# Copy source (will be overridden by volume mount in dev)
COPY . .

EXPOSE 5000

CMD ["sh", "-c", "npx prisma generate && npx prisma migrate deploy && npx prisma db seed && npm run start:dev"]
