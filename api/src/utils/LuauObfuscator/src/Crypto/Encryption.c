#include "../../include/Encryption.h"
#include "../../include/Utils.h"

EncryptionContext* CreateEncryptionContext() {
    EncryptionContext* ctx = (EncryptionContext*)malloc(sizeof(EncryptionContext));
    ctx->masterKey = RandomInt(0x10000, 0xFFFFFF);
    ctx->keyRotation = RandomInt(3, 11);
    ctx->rounds = RandomInt(2, 5);
    GenerateKeys(ctx);
    return ctx;
}

void GenerateKeys(EncryptionContext* ctx) {
    unsigned int seed = ctx->masterKey;
    
    // Generate per-constant keys
    for (int i = 0; i < 256; i++) {
        seed = (seed * 1103515245 + 12345) & 0x7FFFFFFF;
        ctx->constKeys[i] = seed;
    }
    
    // Generate per-block keys
    for (int i = 0; i < 64; i++) {
        seed = (seed * 1103515245 + 12345) & 0x7FFFFFFF;
        ctx->blockKeys[i] = seed;
    }
    
    // Generate XOR lookup table
    for (int i = 0; i < 256; i++) {
        ctx->xorTable[i] = (unsigned char)((i * 167 + ctx->masterKey) ^ (ctx->masterKey >> 8));
    }
}

char* EncryptConstant(EncryptionContext* ctx, const char* input, int* keyIndex) {
    int len = strlen(input);
    *keyIndex = RandomInt(0, 255);
    unsigned int key = ctx->constKeys[*keyIndex];
    
    // Allocate output (escaped format)
    char* output = (char*)malloc(len * 4 + 16);
    output[0] = '\0';
    
    for (int round = 0; round < ctx->rounds; round++) {
        for (int i = 0; i < len; i++) {
            unsigned char b = (unsigned char)input[i];
            // Multi-layer encryption
            b ^= (key >> (8 * (i % 4))) & 0xFF;
            b = ctx->xorTable[b];
            b = ((b << ctx->keyRotation) | (b >> (8 - ctx->keyRotation))) & 0xFF;
            
            char buf[8];
            snprintf(buf, 8, "\\%03d", b);
            strcat(output, buf);
            
            key = (key * 1103515245 + i) & 0x7FFFFFFF;
        }
    }
    
    return output;
}

char* GenerateDecryptorCode(EncryptionContext* ctx, int variant) {
    char* code = (char*)malloc(2048);
    
    switch (variant % 3) {
        case 0:
            snprintf(code, 2048,
                "local function dK(s,ki)"
                "local k=%u;"
                "local t={%u,%u,%u,%u,%u,%u,%u,%u};"
                "local o={};"
                "for i=1,#s do "
                "local b=string.byte(s,i);"
                "b=((b>>%d)|(b<<(8-%d)))%%256;"
                "b=t[(b%%8)+1]~b;"
                "b=bit32.bxor(b,(k>>(8*((i-1)%%4)))%%256);"
                "k=(k*1103515245+i-1)%%2147483648;"
                "table.insert(o,string.char(b));"
                "end;"
                "return table.concat(o);"
                "end;",
                ctx->masterKey,
                ctx->xorTable[0], ctx->xorTable[32], ctx->xorTable[64], ctx->xorTable[96],
                ctx->xorTable[128], ctx->xorTable[160], ctx->xorTable[192], ctx->xorTable[224],
                ctx->keyRotation, ctx->keyRotation
            );
            break;
        case 1:
            snprintf(code, 2048,
                "local dK;do "
                "local m=%u;"
                "local r=%d;"
                "dK=function(s,ki)"
                "local k=m;"
                "local o={};"
                "for i=1,#s do "
                "local b=string.byte(s,i);"
                "b=bit32.bxor(bit32.rrotate(b,r),(k>>(8*((i-1)%%4)))%%256);"
                "k=(k*1103515245+i-1)%%2147483648;"
                "o[i]=string.char(b);"
                "end;"
                "return table.concat(o);"
                "end;end;",
                ctx->masterKey, ctx->keyRotation
            );
            break;
        default:
            snprintf(code, 2048,
                "local dK=(function()"
                "local M=%u;"
                "return function(s)"
                "local k,o=M,{};"
                "for i=1,#s do "
                "local c=string.byte(s,i);"
                "c=bit32.bxor(c,k%%256);"
                "k=bit32.bxor(k*%d,i);"
                "o[#o+1]=string.char(c);"
                "end;"
                "return table.concat(o);"
                "end;end)();",
                ctx->masterKey, ctx->keyRotation + 100
            );
            break;
    }
    
    return code;
}

unsigned int ComputeChecksum(const char* data, int len) {
    unsigned int crc = 0xFFFFFFFF;
    for (int i = 0; i < len; i++) {
        crc ^= (unsigned char)data[i];
        for (int j = 0; j < 8; j++) {
            crc = (crc >> 1) ^ (0xEDB88320 & -(crc & 1));
        }
    }
    return ~crc;
}

void FreeEncryptionContext(EncryptionContext* ctx) {
    if (ctx) free(ctx);
}
