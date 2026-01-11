#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "../../include/AntiDecompiler.h"
#include "../../include/Utils.h"

// Insert anti-decompiler traps into bytecode
void InsertAntiDecompilerTraps(BytecodeChunk* chunk) {
    if (!chunk || chunk->Count < 5) return;
    
    // Add confusing instruction sequences that break decompiler patterns
    int originalCount = chunk->Count;
    int trapCount = RandomInt(2, 5);
    int newCapacity = originalCount + trapCount * 4;
    Instruction* newInstructions = (Instruction*)malloc(newCapacity * sizeof(Instruction));
    int newCount = 0;
    
    for (int i = 0; i < originalCount; i++) {
        // Insert trap before certain instructions
        if (i > 0 && RandomInt(0, 10) == 0) {
            int trapReg = RandomInt(245, 250);
            // Create confusing sequence: LOADK -> TEST -> JMP(0) -> instruction
            // This creates a pattern that confuses decompilers
            newInstructions[newCount++] = (Instruction){OP_LOADBOOL, trapReg, 1, 0};
            newInstructions[newCount++] = (Instruction){OP_TEST, trapReg, 0, 1};
            newInstructions[newCount++] = (Instruction){OP_JMP, 0, 1, 0};  // Skip next
            newInstructions[newCount++] = (Instruction){OP_RETURN, 0, 1, 0}; // Never executed
        }
        
        newInstructions[newCount++] = chunk->Instructions[i];
    }
    
    free(chunk->Instructions);
    chunk->Instructions = newInstructions;
    chunk->Count = newCount;
}

// Generate anti-decompiler code patterns
void GenerateAntiDecompilerPatterns(char** script, int* size, int* capacity) {
    char buf[2048];
    
    // Patterns that confuse Lua decompilers
    char* v1 = GenerateRandomString(2);
    char* v2 = GenerateRandomString(2);
    char* v3 = GenerateRandomString(2);
    
    // Pattern 1: Recursive self-reference that confuses static analysis
    snprintf(buf, 2048,
        "local %s;%s=function()return %s end;"
        // Pattern 2: Indirect function call
        "local %s=({[1]=function()end})[1];"
        // Pattern 3: Dynamic table access that breaks pattern matching
        "local %s=_G[string.reverse('tnirp')]or print;",
        v1, v1, v1,
        v2,
        v3
    );
    
    Append(script, size, capacity, buf);
    
    // Pattern 4: Metamethod confusion (rawget hidden via _G)
    char* mt = GenerateRandomString(2);
    snprintf(buf, 2048,
        "local %s=setmetatable({},{__index=function(t,k)return _G[string.char(114,97,119,103,101,116)](t,k)end});"
        "%s[1]=%d;",
        mt, mt, RandomInt(1, 9999)
    );
    
    Append(script, size, capacity, buf);
    
    free(v1);
    free(v2);
    free(v3);
    free(mt);
}
