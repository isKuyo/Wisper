#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "CodeVirtualizer.h"
#include "Utils.h"

// Apply deeper virtualization layer
void ApplyCodeVirtualization(BytecodeChunk* chunk) {
    if (!chunk || chunk->Count < 5) return;
    
    // Add virtual opcodes between real opcodes for confusion
    int originalCount = chunk->Count;
    int virtualCount = RandomInt(3, 8);
    int newCapacity = originalCount + virtualCount;
    Instruction* newInstructions = (Instruction*)malloc(newCapacity * sizeof(Instruction));
    int newCount = 0;
    
    for (int i = 0; i < originalCount; i++) {
        // Randomly insert virtual NOPs
        if (RandomInt(0, 4) == 0 && newCount < newCapacity - 1) {
            newInstructions[newCount++] = (Instruction){OP_VIRTUAL_NOP, 0, 0, 0};
        }
        
        // Copy original instruction
        newInstructions[newCount++] = chunk->Instructions[i];
    }
    
    free(chunk->Instructions);
    chunk->Instructions = newInstructions;
    chunk->Count = newCount;
}

// Generate extended VM handlers for deeper virtualization
void GenerateExtendedVMHandlers(char** script, int* size, int* capacity, int* opcodeMap) {
    char buf[2048];
    
    // Add handlers for virtual opcodes
    // These are no-ops but confuse analysis
    
    snprintf(buf, 2048, 
        "H[%d]=function()end;"  // VIRTUAL_NOP
        "H[%d]=function()local _=S[A];S[A+1]=_ end;"  // VIRTUAL_PUSH
        "H[%d]=function()S[A]=S[A+1] end;"  // VIRTUAL_POP
        "H[%d]=function()local _=S[A];S[A]=S[A];end;"  // VIRTUAL_DUP
        "H[%d]=function()local _=S[A];S[A]=S[B];S[B]=_ end;"  // VIRTUAL_SWAP
        "H[%d]=function()local a,b,c=S[A],S[A+1],S[A+2];S[A]=b;S[A+1]=c;S[A+2]=a end;",  // VIRTUAL_ROT
        opcodeMap[OP_VIRTUAL_NOP],
        opcodeMap[OP_VIRTUAL_PUSH],
        opcodeMap[OP_VIRTUAL_POP],
        opcodeMap[OP_VIRTUAL_DUP],
        opcodeMap[OP_VIRTUAL_SWAP],
        opcodeMap[OP_VIRTUAL_ROT]
    );
    
    Append(script, size, capacity, buf);
}
