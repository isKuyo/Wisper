FROM node:20-alpine

# Install OpenSSL for Prisma and GCC for obfuscator
RUN apk add --no-cache openssl openssl-dev libc6-compat gcc musl-dev make

WORKDIR /app

# Copy API files
COPY api/package*.json ./
RUN npm install

COPY api/ ./

# Copy loader files
COPY loader/ ./loader/

# Compile LuauObfuscator for Linux
WORKDIR /app/src/utils/LuauObfuscator
RUN mkdir -p bin && \
    gcc -I./include -Wall -std=c99 -o bin/Obfuscator \
    src/Main.c src/Utils/Utils.c src/Protection/Protection.c \
    src/Generator/VmGenerator.c src/Compiler/BytecodeBuilder.c \
    src/Compiler/Compiler.c src/Parser/Lexer.c src/Parser/Parser.c \
    src/VM/VmOpcodes.c src/Crypto/Encryption.c src/Flow/ControlFlow.c \
    src/Tamper/AntiTamper.c src/Poly/Polymorphic.c src/Fragment/Fragmenter.c

# Copy obfuscator to accessible location
RUN mkdir -p /app/obfuscator && cp bin/Obfuscator /app/obfuscator/

WORKDIR /app

# Generate Prisma client
RUN npx prisma generate

# Create data directory for SQLite
RUN mkdir -p /data

EXPOSE 3001

# Start command - use --accept-data-loss=false to prevent data reset
CMD ["sh", "-c", "npx prisma db push --skip-generate && node src/index.js"]
