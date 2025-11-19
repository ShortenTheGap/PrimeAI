FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including native modules like better-sqlite3)
RUN apk add --no-cache python3 make g++ && \
    npm ci --only=production && \
    apk del python3 make g++

# Copy server code and necessary directories
COPY server ./server
COPY data ./data

# Create necessary directories
RUN mkdir -p /app/uploads /app/logs /app/data && \
    chmod -R 777 /app/uploads /app/logs /app/data

# Expose port
EXPOSE 5000

# Set environment
ENV NODE_ENV=production

# Start server
CMD ["node", "server/index.js"]
