FROM node:20-slim

# Install system dependencies for Sharp (image processing)
RUN apt-get update && \
    apt-get install -y libvips-dev && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm install --production

# Copy application source
COPY . .

# Create storage directory
RUN mkdir -p /app/storage

# Start the bot
CMD ["node", "src/bot.js"]
