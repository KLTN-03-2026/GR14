FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm config set registry https://registry.npmjs.org/ \
 && npm ci --no-audit --no-fund \
	--fetch-retries=5 \
	--fetch-retry-mintimeout=20000 \
	--fetch-retry-maxtimeout=120000 \
	--fetch-timeout=300000

# Copy source (will be overridden by volume mount in dev)
COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "--host"]