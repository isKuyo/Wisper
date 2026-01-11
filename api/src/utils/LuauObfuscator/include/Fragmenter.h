#ifndef FRAGMENTER_H
#define FRAGMENTER_H

#include "Common.h"
#include "BytecodeBuilder.h"

// ============================================
// BYTECODE FRAGMENTER MODULE
// ============================================

#define MAX_FRAGMENTS 64
#define MAX_FAKE_BLOCKS 32

// Fragment types
typedef enum {
    FRAG_REAL,      // Real bytecode
    FRAG_FAKE,      // Fake/decoy block
    FRAG_JUMP,      // Jump connector
    FRAG_ENCRYPTED  // Encrypted block
} FragmentType;

// Single fragment
typedef struct {
    int id;
    FragmentType type;
    unsigned char* data;
    int dataLen;
    int nextFragment;   // Runtime order
    int realOrder;      // Original order
    unsigned int checksum;
    int decryptKey;
} Fragment;

// Fragmentation context
typedef struct {
    Fragment fragments[MAX_FRAGMENTS];
    int fragmentCount;
    int fakeBlocks[MAX_FAKE_BLOCKS];
    int fakeCount;
    int* orderTable;    // Runtime reconstruction order
    int entryFragment;
} FragmentContext;

// Function declarations
FragmentContext* CreateFragmentContext();
void FragmentBytecode(FragmentContext* ctx, BytecodeChunk* chunk, int blockSize);
void InsertFakeBlocks(FragmentContext* ctx, int count);
void ShuffleFragments(FragmentContext* ctx);
char* GenerateFragmentLoader(FragmentContext* ctx);
char* SerializeFragments(FragmentContext* ctx, int* totalLen);
void FreeFragmentContext(FragmentContext* ctx);

#endif
