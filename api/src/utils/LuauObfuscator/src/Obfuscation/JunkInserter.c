#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "../../include/JunkInserter.h"
#include "../../include/Utils.h"

// Insert junk/dead code into bytecode
void InsertJunkCode(BytecodeChunk* chunk) {
    if (!chunk || chunk->Count < 3) return;
    
    int originalCount = chunk->Count;
    int junkCount = RandomInt(5, 15);
    int newCapacity = originalCount + junkCount * 3;
    Instruction* newInstructions = (Instruction*)malloc(newCapacity * sizeof(Instruction));
    int newCount = 0;
    
    // Insert junk at random positions
    int insertPositions[20];
    for (int i = 0; i < junkCount; i++) {
        insertPositions[i] = RandomInt(0, originalCount - 1);
    }
    
    int junkIdx = 0;
    for (int i = 0; i < originalCount; i++) {
        // Check if we should insert junk before this instruction
        for (int j = 0; j < junkCount; j++) {
            if (insertPositions[j] == i) {
                // Insert junk instruction (NOP-like operations)
                int junkType = RandomInt(0, 3);
                int junkReg = RandomInt(240, 250);
                switch (junkType) {
                    case 0: // Load nil
                        newInstructions[newCount++] = (Instruction){OP_LOADNIL, junkReg, 0, 0};
                        break;
                    case 1: // Move to self
                        newInstructions[newCount++] = (Instruction){OP_MOVE, junkReg, junkReg, 0};
                        break;
                    case 2: // Load bool
                        newInstructions[newCount++] = (Instruction){OP_LOADBOOL, junkReg, RandomInt(0,1), 0};
                        break;
                    case 3: // Load constant (if available)
                        if (chunk->ConstantCount > 0) {
                            newInstructions[newCount++] = (Instruction){OP_LOADK, junkReg, 0, 0};
                        }
                        break;
                }
            }
        }
        
        // Copy original instruction
        newInstructions[newCount++] = chunk->Instructions[i];
    }
    
    // Replace chunk instructions
    free(chunk->Instructions);
    chunk->Instructions = newInstructions;
    chunk->Count = newCount;
}

// Generate realistic junk code patterns in script
void GenerateJunkPatterns(char** script, int* size, int* capacity, int count) {
    char buf[1024];
    
    for (int i = 0; i < count; i++) {
        char* v = GenerateRandomString(2);
        int pattern = RandomInt(0, 5);
        
        switch (pattern) {
            case 0: // Dead variable assignment
                snprintf(buf, 1024, "local %s=%d;", v, RandomInt(1, 9999));
                break;
            case 1: // Unused function call result
                snprintf(buf, 1024, "local %s=tostring(%d);", v, RandomInt(1, 9999));
                break;
            case 2: // Math operation
                snprintf(buf, 1024, "local %s=math.floor(%d/%d);", v, RandomInt(100,999), RandomInt(1,10));
                break;
            case 3: // String operation
                snprintf(buf, 1024, "local %s=string.len('%s');", v, GenerateRandomString(5));
                break;
            case 4: // Table creation
                snprintf(buf, 1024, "local %s={%d,%d,%d};", v, RandomInt(1,99), RandomInt(1,99), RandomInt(1,99));
                break;
            case 5: // Bit operation
                snprintf(buf, 1024, "local %s=bit32.band(%d,%d);", v, RandomInt(100,999), RandomInt(100,999));
                break;
        }
        
        Append(script, size, capacity, buf);
        free(v);
    }
}
