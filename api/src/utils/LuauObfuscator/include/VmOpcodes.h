#ifndef VM_OPCODES_H
#define VM_OPCODES_H

#include "Common.h"

// ============================================
// EXTENDED OPCODE SET (50+ opcodes)
// ============================================

// Real opcodes (functional)
typedef enum {
    // Stack operations
    VM_NOP = 0,
    VM_LOAD_NIL,
    VM_LOAD_BOOL,
    VM_LOAD_INT,
    VM_LOAD_CONST,
    VM_LOAD_GLOBAL,
    VM_STORE_GLOBAL,
    VM_LOAD_UPVAL,
    VM_STORE_UPVAL,
    VM_LOAD_LOCAL,
    VM_STORE_LOCAL,
    
    // Table operations
    VM_NEW_TABLE,
    VM_GET_TABLE,
    VM_SET_TABLE,
    VM_GET_INDEX,
    VM_SET_INDEX,
    
    // Arithmetic
    VM_ADD,
    VM_SUB,
    VM_MUL,
    VM_DIV,
    VM_MOD,
    VM_POW,
    VM_UNM,
    VM_CONCAT,
    
    // Comparison
    VM_EQ,
    VM_NE,
    VM_LT,
    VM_LE,
    VM_GT,
    VM_GE,
    
    // Logical
    VM_NOT,
    VM_AND,
    VM_OR,
    VM_XOR,
    VM_BAND,
    VM_BOR,
    VM_BXOR,
    VM_BNOT,
    VM_SHL,
    VM_SHR,
    
    // Control flow
    VM_JMP,
    VM_JMP_IF,
    VM_JMP_IF_NOT,
    VM_JMP_EQ,
    VM_JMP_NE,
    VM_JMP_LT,
    VM_LOOP,
    VM_CALL,
    VM_TAILCALL,
    VM_RETURN,
    VM_VARARG,
    
    // Closures
    VM_CLOSURE,
    VM_CLOSE,
    
    // ============================================
    // FAKE OPCODES (NOPs that look functional)
    // ============================================
    VM_FAKE_LOAD,
    VM_FAKE_STORE,
    VM_FAKE_CALC,
    VM_FAKE_JMP,
    VM_FAKE_CALL,
    VM_FAKE_CHECK,
    VM_FAKE_SYNC,
    VM_FAKE_HASH,
    VM_FAKE_VERIFY,
    VM_FAKE_DECRYPT,
    
    // ============================================
    // MULTI-PURPOSE OPCODES (behavior depends on flags)
    // ============================================
    VM_MULTI_A,  // Different ops based on flag byte
    VM_MULTI_B,
    VM_MULTI_C,
    VM_MULTI_D,
    
    // ============================================
    // DYNAMIC JUMP OPCODES
    // ============================================
    VM_DYN_JMP,      // Jump to computed address
    VM_DYN_DISPATCH, // Dispatcher jump
    VM_STATE_JMP,    // State machine jump
    VM_COND_STATE,   // Conditional state change
    
    VM_OPCODE_COUNT
} VmOpcode;

// Opcode flags for multi-purpose instructions
#define VM_FLAG_MODE_A  0x00
#define VM_FLAG_MODE_B  0x40
#define VM_FLAG_MODE_C  0x80
#define VM_FLAG_MODE_D  0xC0

// Opcode mapping structure for shuffling
typedef struct {
    int realOp;       // Real operation
    int shuffledOp;   // Shuffled value for this build
    int fakeCount;    // Number of fake NOPs to insert
    int flags;        // Special flags
} OpcodeMapping;

// Build-specific opcode table
typedef struct {
    OpcodeMapping mappings[VM_OPCODE_COUNT];
    int shuffleKey;
    int xorKey;
    int buildId;
} OpcodeTable;

// Function declarations
OpcodeTable* CreateOpcodeTable();
void ShuffleOpcodes(OpcodeTable* table);
int GetShuffledOpcode(OpcodeTable* table, int realOp);
int GetRealOpcode(OpcodeTable* table, int shuffledOp);
void FreeOpcodeTable(OpcodeTable* table);

#endif
