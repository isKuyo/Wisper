#include "../../include/VmOpcodes.h"
#include "../../include/Utils.h"

// Create new opcode table with randomized mappings
OpcodeTable* CreateOpcodeTable() {
    OpcodeTable* table = (OpcodeTable*)malloc(sizeof(OpcodeTable));
    table->shuffleKey = RandomInt(1, 0xFFFFFF);
    table->xorKey = RandomInt(1, 255);
    table->buildId = RandomInt(10000, 99999);
    
    // Initialize mappings
    for (int i = 0; i < VM_OPCODE_COUNT; i++) {
        table->mappings[i].realOp = i;
        table->mappings[i].shuffledOp = i;  // Will be shuffled
        table->mappings[i].fakeCount = RandomInt(0, 3);
        table->mappings[i].flags = 0;
    }
    
    return table;
}

// Fisher-Yates shuffle for opcodes
void ShuffleOpcodes(OpcodeTable* table) {
    int used[256] = {0};
    
    for (int i = 0; i < VM_OPCODE_COUNT; i++) {
        int newOp;
        do {
            newOp = RandomInt(1, 250);  // Avoid 0 and high values
        } while (used[newOp]);
        
        used[newOp] = 1;
        table->mappings[i].shuffledOp = newOp ^ table->xorKey;
    }
}

// Get shuffled opcode for a real operation
int GetShuffledOpcode(OpcodeTable* table, int realOp) {
    if (realOp >= 0 && realOp < VM_OPCODE_COUNT) {
        return table->mappings[realOp].shuffledOp;
    }
    return 0;
}

// Get real opcode from shuffled value
int GetRealOpcode(OpcodeTable* table, int shuffledOp) {
    for (int i = 0; i < VM_OPCODE_COUNT; i++) {
        if (table->mappings[i].shuffledOp == shuffledOp) {
            return table->mappings[i].realOp;
        }
    }
    return -1;
}

void FreeOpcodeTable(OpcodeTable* table) {
    if (table) free(table);
}

// Generate Lua code for opcode handler
char* GenerateOpcodeHandler(OpcodeTable* table, int realOp) {
    char* code = (char*)malloc(512);
    int shuffled = GetShuffledOpcode(table, realOp);
    
    switch (realOp) {
        case VM_LOAD_CONST:
            snprintf(code, 512, "if op==%d then S[A]=K[B]", shuffled);
            break;
        case VM_LOAD_GLOBAL:
            snprintf(code, 512, "if op==%d then S[A]=E[K[B]]", shuffled);
            break;
        case VM_CALL:
            snprintf(code, 512, "if op==%d then S[A](S[A+1])", shuffled);
            break;
        case VM_ADD:
            snprintf(code, 512, "if op==%d then S[A]=S[B]+S[C]", shuffled);
            break;
        case VM_SUB:
            snprintf(code, 512, "if op==%d then S[A]=S[B]-S[C]", shuffled);
            break;
        case VM_MUL:
            snprintf(code, 512, "if op==%d then S[A]=S[B]*S[C]", shuffled);
            break;
        case VM_DIV:
            snprintf(code, 512, "if op==%d then S[A]=S[B]/S[C]", shuffled);
            break;
        case VM_JMP:
            snprintf(code, 512, "if op==%d then pc=pc+sB", shuffled);
            break;
        case VM_JMP_IF:
            snprintf(code, 512, "if op==%d then if S[A]then pc=pc+sB end", shuffled);
            break;
        case VM_JMP_IF_NOT:
            snprintf(code, 512, "if op==%d then if not S[A]then pc=pc+sB end", shuffled);
            break;
        case VM_RETURN:
            snprintf(code, 512, "if op==%d then return S[A]", shuffled);
            break;
        case VM_FAKE_LOAD:
        case VM_FAKE_STORE:
        case VM_FAKE_CALC:
        case VM_FAKE_JMP:
        case VM_FAKE_CALL:
            // Fake opcodes - do nothing but look real
            snprintf(code, 512, "if op==%d then _=S[A];_=nil", shuffled);
            break;
        default:
            snprintf(code, 512, "if op==%d then end", shuffled);
            break;
    }
    
    return code;
}
