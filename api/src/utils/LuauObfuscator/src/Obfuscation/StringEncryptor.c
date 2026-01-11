#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "StringEncryptor.h"
#include "Utils.h"

// Encrypt all string constants in bytecode using XOR with rolling key
void EncryptStringConstants(BytecodeChunk* chunk, int encryptionKey) {
    if (!chunk) return;
    
    for (int i = 0; i < chunk->ConstantCount; i++) {
        if (chunk->Constants[i] == NULL) continue;
        
        // Skip function constants (start with __lua__)
        if (strncmp(chunk->Constants[i], "__lua__", 7) == 0) continue;
        
        // Skip numeric strings
        char* endptr;
        strtod(chunk->Constants[i], &endptr);
        if (*endptr == '\0') continue;
        
        // Encrypt the string with rolling XOR
        int len = strlen(chunk->Constants[i]);
        char* encrypted = (char*)malloc(len + 5);  // Add prefix for encrypted marker
        encrypted[0] = '_';
        encrypted[1] = 'E';
        encrypted[2] = '_';
        
        int key = encryptionKey;
        for (int j = 0; j < len; j++) {
            encrypted[j + 3] = chunk->Constants[i][j] ^ (key & 0xFF);
            key = (key * 31 + 17) & 0xFFFF;
        }
        encrypted[len + 3] = '\0';
        
        free(chunk->Constants[i]);
        chunk->Constants[i] = encrypted;
    }
}

// Generate string decryption runtime code
void GenerateStringDecryptor(char** script, int* size, int* capacity, int encryptionKey) {
    char buf[2048];
    
    char* fn = GenerateRandomString(3);
    char* k = GenerateRandomString(2);
    
    // Generate decryption function
    snprintf(buf, 2048,
        "local %s=%d;"
        "local %s=function(s)"
        "if s:sub(1,3)~='_E_'then return s end;"
        "local r='';local k=%s;"
        "for i=4,#s do "
        "r=r..string.char(bit32.bxor(string.byte(s,i),bit32.band(k,255)));"
        "k=bit32.band(k*31+17,65535);"
        "end;"
        "return r;"
        "end;",
        k, encryptionKey,
        fn, k
    );
    
    Append(script, size, capacity, buf);
    
    free(fn);
    free(k);
}

// Generate constant number encryption/decryption
void GenerateConstantEncryption(char** script, int* size, int* capacity) {
    char buf[2048];
    
    char* dec = GenerateRandomString(3);  // decrypt function
    char* enc = GenerateRandomString(3);  // encrypt function
    int key1 = RandomInt(1000, 9999);
    int key2 = RandomInt(100, 999);
    
    // Number obfuscation: encrypt(n) = (n * key2) + key1
    // decrypt(n) = (n - key1) / key2
    snprintf(buf, 2048,
        "local %s=function(n)return(n-%d)/%d end;"  // decrypt
        "local %s=function(n)return n*%d+%d end;",   // encrypt (for reference)
        dec, key1, key2,
        enc, key2, key1
    );
    
    Append(script, size, capacity, buf);
    
    free(dec);
    free(enc);
}

// Generate multi-layer VM wrapper
void GenerateMultiLayerVM(char** script, int* size, int* capacity) {
    char buf[4096];
    
    char* layer1 = GenerateRandomString(3);
    char* layer2 = GenerateRandomString(3);
    char* wrapper = GenerateRandomString(3);
    
    // Create nested function wrappers that add execution layers
    snprintf(buf, 4096,
        // Layer 1: Basic wrapper with environment check
        "local %s=function(f)return function(...)local e=getfenv and getfenv()or _G;"
        "if e then return f(...)end end end;"
        // Layer 2: Protected call wrapper
        "local %s=function(f)return function(...)local s,r=pcall(f,...);if s then return r end end end;"
        // Combined wrapper
        "local %s=function(f)return %s(%s(f))end;",
        layer1,
        layer2,
        wrapper, layer1, layer2
    );
    
    Append(script, size, capacity, buf);
    
    free(layer1);
    free(layer2);
    free(wrapper);
}
