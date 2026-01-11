#ifndef CODE_VIRTUALIZER_H
#define CODE_VIRTUALIZER_H

#include "BytecodeBuilder.h"

// Extended opcode set for deeper virtualization
#define OP_VIRTUAL_NOP      50
#define OP_VIRTUAL_PUSH     51
#define OP_VIRTUAL_POP      52
#define OP_VIRTUAL_DUP      53
#define OP_VIRTUAL_SWAP     54
#define OP_VIRTUAL_ROT      55

// Generate extended VM handlers for deeper virtualization
void GenerateExtendedVMHandlers(char** script, int* size, int* capacity, int* opcodeMap);

// Insert virtualization layer
void ApplyCodeVirtualization(BytecodeChunk* chunk);

#endif
