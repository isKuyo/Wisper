#ifndef BYTECODE_BUILDER_H
#define BYTECODE_BUILDER_H

#include "../include/Common.h"

typedef enum {
    OP_MOVE,
    OP_LOADK,
    OP_LOADBOOL,
    OP_LOADNIL,
    OP_GETUPVAL,
    OP_GETGLOBAL,
    OP_GETTABLE,
    OP_SETGLOBAL,
    OP_SETUPVAL,
    OP_SETTABLE,
    OP_NEWTABLE,
    OP_SELF,
    OP_ADD,
    OP_SUB,
    OP_MUL,
    OP_DIV,
    OP_MOD,
    OP_POW,
    OP_UNM,
    OP_NOT,
    OP_LEN,
    OP_CONCAT,
    OP_JMP,
    OP_EQ,
    OP_LT,
    OP_LE,
    OP_TEST,
    OP_TESTSET,
    OP_CALL,
    OP_TAILCALL,
    OP_RETURN,
    OP_FORLOOP,
    OP_FORPREP,
    OP_TFORLOOP,
    OP_SETLIST,
    OP_CLOSE,
    OP_CLOSURE,
    OP_VARARG
} OpCode;

typedef struct {
    OpCode Op;
    int A;
    int B;
    int C;
} Instruction;

typedef struct {
    Instruction* Instructions;
    int Count;
    int Capacity;
    
    // Constants (simplified strings only for demo)
    char** Constants; 
    int ConstantCount;
} BytecodeChunk;

BytecodeChunk* CreateChunk();
void AddInstruction(BytecodeChunk* chunk, OpCode op, int a, int b, int c);
void AddConstant(BytecodeChunk* chunk, const char* str);
void FreeChunk(BytecodeChunk* chunk);

#endif
