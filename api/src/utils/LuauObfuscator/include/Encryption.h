#ifndef ENCRYPTION_H
#define ENCRYPTION_H

#include "Common.h"

// ============================================
// ADVANCED ENCRYPTION MODULE
// ============================================

// Encryption context for build
typedef struct {
    unsigned int masterKey;
    unsigned int constKeys[256];    // Per-constant keys
    unsigned int blockKeys[64];     // Per-block keys
    unsigned int xorTable[256];     // XOR lookup table
    int keyRotation;
    int rounds;
} EncryptionContext;

// Encrypted constant
typedef struct {
    char* data;
    int length;
    int keyIndex;
    int decryptPhase;  // 0=immediate, 1=lazy, 2=on-demand
    unsigned int checksum;
} EncryptedConstant;

// Function declarations
EncryptionContext* CreateEncryptionContext();
void GenerateKeys(EncryptionContext* ctx);
char* EncryptConstant(EncryptionContext* ctx, const char* input, int* keyIndex);
char* GenerateDecryptorCode(EncryptionContext* ctx, int variant);
unsigned int ComputeChecksum(const char* data, int len);
void FreeEncryptionContext(EncryptionContext* ctx);

// Multi-layer encryption
char* EncryptLayer1_XOR(const char* input, int len, unsigned int key);
char* EncryptLayer2_Rotate(const char* input, int len, int rotation);
char* EncryptLayer3_Shuffle(const char* input, int len, unsigned int* table);

#endif
