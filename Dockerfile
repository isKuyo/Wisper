FROM node:20-alpine

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl openssl-dev libc6-compat

WORKDIR /app

# Copy API files
COPY api/package*.json ./
RUN npm install

COPY api/ ./

# Copy loader files
COPY loader/ ./loader/

# Generate Prisma client
RUN npx prisma generate

# Create data directory for SQLite
RUN mkdir -p /data

EXPOSE 3001

# Start command
CMD ["sh", "-c", "npx prisma db push && node src/index.js"]
