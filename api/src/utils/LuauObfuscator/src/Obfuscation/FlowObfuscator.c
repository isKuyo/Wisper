#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "../../include/FlowObfuscator.h"
#include "../../include/Utils.h"

// Apply control flow flattening - transform control structures into state machine
void ApplyControlFlowFlattening(BytecodeChunk* chunk) {
    if (!chunk || chunk->Count < 5) return;
    
    // Insert state variable initialization at the beginning
    // This transforms if/while into a switch-like state machine
    
    int originalCount = chunk->Count;
    int newCapacity = originalCount + 20;
    Instruction* newInstructions = (Instruction*)malloc(newCapacity * sizeof(Instruction));
    int newCount = 0;
    
    // Add state variable setup (uses register 250 as state)
    newInstructions[newCount++] = (Instruction){OP_LOADK, 250, 0, 0};  // state = 0
    
    // Copy original instructions with state transitions
    int stateCounter = 1;
    for (int i = 0; i < originalCount; i++) {
        Instruction inst = chunk->Instructions[i];
        
        // For jump instructions, add state transitions
        if (inst.Op == OP_JMP) {
            // Before jump, set state
            newInstructions[newCount++] = (Instruction){OP_LOADK, 250, stateCounter++, 0};
        }
        
        newInstructions[newCount++] = inst;
    }
    
    // Replace chunk instructions
    free(chunk->Instructions);
    chunk->Instructions = newInstructions;
    chunk->Count = newCount;
}

// Generate control flow flattening dispatcher in script (safe version)
void GenerateControlFlowDispatcher(char** script, int* size, int* capacity) {
    char buf[4096];
    
    // Create state machine that wraps the VM execution
    char* state = GenerateRandomString(2);
    char* dispatch = GenerateRandomString(3);
    
    // Generate randomized state values
    int s1 = RandomInt(100, 999);
    int s2 = RandomInt(100, 999);
    int s3 = RandomInt(100, 999);
    
    snprintf(buf, 4096,
        // State machine dispatcher
        "local %s=%d;"  // Initial state
        "local %s={[%d]=function()%s=%d end,[%d]=function()%s=%d end,[%d]=function()%s=%d end};"
        "while %s[%s]do %s[%s]()end;",
        state, s1,
        dispatch, s1, state, s2, s2, state, s3, s3, state, s1,
        dispatch, state, dispatch, state
    );
    
    Append(script, size, capacity, buf);
    
    free(state);
    free(dispatch);
}

// Insert opaque predicates - always true/false conditions that confuse analysis
void InsertOpaquePredicates(char** script, int* size, int* capacity) {
    char buf[2048];
    
    // Generate random variable names
    char* v1 = GenerateRandomString(2);
    char* v2 = GenerateRandomString(2);
    char* v3 = GenerateRandomString(2);
    
    // Opaque predicates - mathematical expressions that are always true or always false
    // but difficult for static analysis to determine
    int a = RandomInt(100, 999);
    int b = RandomInt(100, 999);
    
    snprintf(buf, 2048,
        // Opaque predicate 1: (x*x >= 0) is always true
        "local %s=%d;local %s=%s*%s>=0;"
        // Opaque predicate 2: (x*x + 1 > 0) is always true  
        "local %s=%s*%s+1>0;"
        // Use predicates in dead code paths
        "if not %s then return end;"
        "if not %s then return end;",
        v1, a, v2, v1, v1,
        v3, v1, v1,
        v2, v3
    );
    
    Append(script, size, capacity, buf);
    
    free(v1);
    free(v2);
    free(v3);
}
