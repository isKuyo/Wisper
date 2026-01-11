#include "../../include/Utils.h"

void SeedRandom() {
    srand((unsigned int)time(NULL));
}

int RandomInt(int min, int max) {
    return min + rand() % (max - min + 1);
}

char* GenerateRandomString(int length) {
    char* str = (char*)malloc(length + 1);
    const char charset[] = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    if (str) {
        for (int i = 0; i < length; i++) {
            int key = rand() % (int)(sizeof(charset) - 1);
            str[i] = charset[key];
        }
        str[length] = '\0';
    }
    return str;
}

char* GenerateRandomHex(int length) {
    char* str = (char*)malloc(length + 1);
    const char charset[] = "0123456789ABCDEF";
    if (str) {
        for (int i = 0; i < length; i++) {
            int key = rand() % (int)(sizeof(charset) - 1);
            str[i] = charset[key];
        }
        str[length] = '\0';
    }
    return str;
}

void LogInfo(const char* format, ...) {
    va_list args;
    va_start(args, format);
    printf("[INFO] ");
    vprintf(format, args);
    printf("\n");
    va_end(args);
}

void LogError(const char* format, ...) {
    va_list args;
    va_start(args, format);
    fprintf(stderr, "[ERROR] ");
    vfprintf(stderr, format, args);
    fprintf(stderr, "\n");
    va_end(args);
}

// Base85 Custom Encoding (similar to Ascii85 but with custom alphabet)
char* EncodeBase85Custom(const unsigned char* data, int len) {
    // Custom Base85 alphabet with special chars
    const char* alphabet = "!\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstu";
    
    int outLen = ((len + 3) / 4) * 5 + 100; // Estimate with padding
    char* output = (char*)malloc(outLen);
    int outPos = 0;
    
    // Add prefix marker
    strcpy(output, "LPH+m0<X;z");
    outPos = strlen(output);
    
    for (int i = 0; i < len; i += 4) {
        unsigned long value = 0;
        int count = 0;
        
        // Pack 4 bytes into 32-bit value
        for (int j = 0; j < 4 && (i + j) < len; j++) {
            value = (value << 8) | data[i + j];
            count++;
        }
        
        // Pad if needed
        for (int j = count; j < 4; j++) {
            value = value << 8;
        }
        
        // Add marker every ~15 chars for obfuscation
        if (i > 0 && i % 60 == 0) {
            output[outPos++] = 'z';
            output[outPos++] = '!';
            output[outPos++] = '!';
        }
        
        // Encode to base85 (5 chars)
        char encoded[6];
        for (int j = 4; j >= 0; j--) {
            encoded[j] = alphabet[value % 85];
            value /= 85;
        }
        
        // Copy encoded chars
        for (int j = 0; j < 5; j++) {
            output[outPos++] = encoded[j];
        }
    }
    
    output[outPos] = '\0';
    return output;
}

// Serialize bytecode chunk to binary format
char* SerializeBytecode(BytecodeChunk* chunk) {
    // Calculate size needed
    int size = 1; // version byte
    size += 1; // constant count
    for (int i = 0; i < chunk->ConstantCount; i++) {
        size += 2; // string length (2 bytes)
        size += strlen(chunk->Constants[i]); // string data
    }
    size += chunk->Count * 6; // instructions (6 bytes each: op, A, B(2), C(2))
    
    unsigned char* buffer = (unsigned char*)malloc(size);
    int pos = 0;
    
    // Version
    buffer[pos++] = 0x01;
    
    // Constants - use 2 bytes for length to support long strings (functions)
    buffer[pos++] = (unsigned char)chunk->ConstantCount;
    for (int i = 0; i < chunk->ConstantCount; i++) {
        int len = strlen(chunk->Constants[i]);
        buffer[pos++] = (unsigned char)(len & 0xFF);
        buffer[pos++] = (unsigned char)((len >> 8) & 0xFF);
        memcpy(buffer + pos, chunk->Constants[i], len);
        pos += len;
    }
    
    // Instructions - use 2 bytes for B and C to support constant flags
    for (int i = 0; i < chunk->Count; i++) {
        buffer[pos++] = (unsigned char)chunk->Instructions[i].Op;
        buffer[pos++] = (unsigned char)chunk->Instructions[i].A;
        // B as 2 bytes (little endian)
        buffer[pos++] = (unsigned char)(chunk->Instructions[i].B & 0xFF);
        buffer[pos++] = (unsigned char)((chunk->Instructions[i].B >> 8) & 0xFF);
        // C as 2 bytes (little endian)
        buffer[pos++] = (unsigned char)(chunk->Instructions[i].C & 0xFF);
        buffer[pos++] = (unsigned char)((chunk->Instructions[i].C >> 8) & 0xFF);
    }
    
    // Encode to Base85
    char* encoded = EncodeBase85Custom(buffer, pos);
    free(buffer);
    
    return encoded;
}
