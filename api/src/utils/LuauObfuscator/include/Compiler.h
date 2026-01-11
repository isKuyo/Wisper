#ifndef COMPILER_H
#define COMPILER_H

#include "Common.h"
#include "Parser.h"
#include "BytecodeBuilder.h"

#define MAX_LOCALS 200
#define MAX_UPVALUES 60
#define MAX_CONSTANTS 65536

typedef struct {
    char* name;
    int depth;
    int slot;
} Local;

typedef struct {
    char* name;
    int index;
    int isLocal;
} Upvalue;

typedef struct Compiler Compiler;

struct Compiler {
    Compiler* enclosing;
    BytecodeChunk* chunk;
    
    Local locals[MAX_LOCALS];
    int localCount;
    int scopeDepth;
    
    Upvalue upvalues[MAX_UPVALUES];
    int upvalueCount;
    
    int stackTop;
    int maxStack;
    
    // For break statements
    int* breakJumps;
    int breakCount;
    int breakCapacity;
};

typedef struct {
    Compiler* current;
    Parser* parser;
    int hadError;
    char errorMsg[256];
} CompilerState;

CompilerState* CreateCompilerState(const char* source);
void FreeCompilerState(CompilerState* state);
BytecodeChunk* Compile(CompilerState* state);

#endif
