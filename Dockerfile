# Use Debian-based slim image for better compatibility with native modules
FROM node:20-slim

# Install minimal system dependencies (Sharp/Canvas usually have pre-built binaries)
RUN apt-get update && \
    apt-get install -y libvips-dev && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

# Install dependencies
RUN npm ci --omit=dev

COPY . .

# Create storage directory
RUN mkdir -p /app/storage

CMD ["node", "src/bot.js"]
