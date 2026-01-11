#include "../../include/BytecodeBuilder.h"

BytecodeChunk* CreateChunk() {
    BytecodeChunk* chunk = (BytecodeChunk*)malloc(sizeof(BytecodeChunk));
    chunk->Count = 0;
    chunk->Capacity = 32;
    chunk->Instructions = (Instruction*)malloc(sizeof(Instruction) * chunk->Capacity);
    chunk->ConstantCount = 0;
    chunk->Constants = (char**)malloc(sizeof(char*) * 32); 
    return chunk;
}

void AddInstruction(BytecodeChunk* chunk, OpCode op, int a, int b, int c) {
    if (chunk->Count >= chunk->Capacity) {
        chunk->Capacity *= 2;
        chunk->Instructions = (Instruction*)realloc(chunk->Instructions, sizeof(Instruction) * chunk->Capacity);
    }
    chunk->Instructions[chunk->Count].Op = op;
    chunk->Instructions[chunk->Count].A = a;
    chunk->Instructions[chunk->Count].B = b;
    chunk->Instructions[chunk->Count].C = c;
    chunk->Count++;
}

void AddConstant(BytecodeChunk* chunk, const char* str) {
    chunk->Constants[chunk->ConstantCount] = strdup(str);
    chunk->ConstantCount++;
}

void FreeChunk(BytecodeChunk* chunk) {
    if (chunk) {
        free(chunk->Instructions);
        for(int i=0; i<chunk->ConstantCount; i++) free(chunk->Constants[i]);
        free(chunk->Constants);
        free(chunk);
    }
}
