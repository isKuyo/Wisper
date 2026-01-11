#ifndef ANTI_TAMPER_H
#define ANTI_TAMPER_H

#include "Common.h"

// ============================================
// ANTI-TAMPER MODULE
// ============================================

#define MAX_CHECKPOINTS 32
#define MAX_VALIDATORS 16

// Checkpoint types
typedef enum {
    CHECK_CRC32,
    CHECK_HASH,
    CHECK_LENGTH,
    CHECK_SIGNATURE,
    CHECK_CROSS_REF
} CheckpointType;

// Validation checkpoint
typedef struct {
    int id;
    CheckpointType type;
    unsigned int expectedValue;
    int targetStart;
    int targetEnd;
    int failMode;  // 0=silent corrupt, 1=wrong result, 2=delayed fail
} Checkpoint;

// Cross-reference validator
typedef struct {
    int funcA;
    int funcB;
    unsigned int sharedSecret;
    int validationPoint;
} CrossValidator;

// Anti-tamper context
typedef struct {
    Checkpoint checkpoints[MAX_CHECKPOINTS];
    int checkpointCount;
    CrossValidator validators[MAX_VALIDATORS];
    int validatorCount;
    unsigned int masterChecksum;
    int silentFailEnabled;
} AntiTamperContext;

// Function declarations
AntiTamperContext* CreateAntiTamperContext();
void AddCheckpoint(AntiTamperContext* ctx, CheckpointType type, int start, int end);
void AddCrossValidator(AntiTamperContext* ctx, int funcA, int funcB);
char* GenerateChecksumCode(AntiTamperContext* ctx, int variant);
char* GenerateValidatorCode(AntiTamperContext* ctx);
char* GenerateSilentFailCode(AntiTamperContext* ctx);
unsigned int ComputeCRC32(const char* data, int len);
void FreeAntiTamperContext(AntiTamperContext* ctx);

// Robust anti-tamper with multiple checks
char* GenerateRobustAntiTamper(int seed);

// Timing-based anti-debug
char* GenerateTimingCheck();

#endif
