#include "../../include/Compiler.h"
#include "../../include/Utils.h"
#include <stdlib.h>
#include <string.h>
#include <stdio.h>

static void compileNode(CompilerState* state, ASTNode* node);
static void compileExpression(CompilerState* state, ASTNode* node);
static void compileStatement(CompilerState* state, ASTNode* node);
static void astToLua(ASTNode* node, char* buf, int bufSize, int* pos);
static int funcCounter = 0;

static Compiler* currentCompiler(CompilerState* state) {
    return state->current;
}

static BytecodeChunk* currentChunk(CompilerState* state) {
    return state->current->chunk;
}

static void emitByte(CompilerState* state, int byte) {
    // We'll encode as instruction with just opcode
}

static int emitInstruction(CompilerState* state, OpCode op, int a, int b, int c) {
    AddInstruction(currentChunk(state), op, a, b, c);
    return currentChunk(state)->Count - 1;
}

static int addConstant(CompilerState* state, const char* value) {
    BytecodeChunk* chunk = currentChunk(state);
    // Check if constant already exists
    for (int i = 0; i < chunk->ConstantCount; i++) {
        if (strcmp(chunk->Constants[i], value) == 0) {
            return i;
        }
    }
    AddConstant(chunk, value);
    return chunk->ConstantCount - 1;
}

static int addNumberConstant(CompilerState* state, double value) {
    char buf[64];
    snprintf(buf, 64, "%.17g", value);
    return addConstant(state, buf);
}

static void initCompiler(CompilerState* state, Compiler* compiler) {
    compiler->enclosing = state->current;
    compiler->chunk = CreateChunk();
    compiler->localCount = 0;
    compiler->scopeDepth = 0;
    compiler->upvalueCount = 0;
    compiler->stackTop = 0;
    compiler->maxStack = 0;
    compiler->breakJumps = NULL;
    compiler->breakCount = 0;
    compiler->breakCapacity = 0;
    state->current = compiler;
}

static int resolveLocal(Compiler* compiler, const char* name) {
    for (int i = compiler->localCount - 1; i >= 0; i--) {
        if (strcmp(compiler->locals[i].name, name) == 0) {
            return compiler->locals[i].slot;
        }
    }
    return -1;
}

static int addLocal(CompilerState* state, const char* name) {
    Compiler* compiler = currentCompiler(state);
    if (compiler->localCount >= MAX_LOCALS) {
        state->hadError = 1;
        snprintf(state->errorMsg, 256, "Too many local variables");
        return -1;
    }
    
    Local* local = &compiler->locals[compiler->localCount++];
    local->name = strdup(name);
    local->depth = compiler->scopeDepth;
    local->slot = compiler->localCount - 1;
    
    // Keep stackTop in sync with locals
    if (compiler->stackTop < compiler->localCount) {
        compiler->stackTop = compiler->localCount;
    }
    if (compiler->stackTop > compiler->maxStack) {
        compiler->maxStack = compiler->stackTop;
    }
    
    return local->slot;
}

static void beginScope(CompilerState* state) {
    currentCompiler(state)->scopeDepth++;
}

static void endScope(CompilerState* state) {
    Compiler* compiler = currentCompiler(state);
    compiler->scopeDepth--;
    
    while (compiler->localCount > 0 && 
           compiler->locals[compiler->localCount - 1].depth > compiler->scopeDepth) {
        free(compiler->locals[compiler->localCount - 1].name);
        compiler->localCount--;
    }
}

static int allocReg(CompilerState* state) {
    Compiler* compiler = currentCompiler(state);
    int reg = compiler->stackTop++;
    if (compiler->stackTop > compiler->maxStack) {
        compiler->maxStack = compiler->stackTop;
    }
    return reg;
}

static void freeReg(CompilerState* state) {
    currentCompiler(state)->stackTop--;
}

static void compileNumber(CompilerState* state, ASTNode* node, int reg) {
    int constIdx = addNumberConstant(state, node->data.number);
    emitInstruction(state, OP_LOADK, reg, constIdx, 0);
}

static void compileString(CompilerState* state, ASTNode* node, int reg) {
    int constIdx = addConstant(state, node->data.string);
    emitInstruction(state, OP_LOADK, reg, constIdx, 0);
}

static void compileBool(CompilerState* state, ASTNode* node, int reg) {
    emitInstruction(state, OP_LOADBOOL, reg, node->data.boolean ? 1 : 0, 0);
}

static void compileNil(CompilerState* state, ASTNode* node, int reg) {
    emitInstruction(state, OP_LOADNIL, reg, 0, 0);
}

static void compileName(CompilerState* state, ASTNode* node, int reg) {
    const char* name = node->data.string;
    int local = resolveLocal(currentCompiler(state), name);
    
    if (local != -1) {
        if (local != reg) {
            emitInstruction(state, OP_MOVE, reg, local, 0);
        }
    } else {
        int constIdx = addConstant(state, name);
        emitInstruction(state, OP_GETGLOBAL, reg, constIdx, 0);
    }
}

static void compileExpressionToReg(CompilerState* state, ASTNode* node, int reg);

static void compileCall(CompilerState* state, ASTNode* node, int reg) {
    // Compile function
    compileExpressionToReg(state, node->data.call.func, reg);
    
    // Compile arguments
    int argCount = node->data.call.args.count;
    for (int i = 0; i < argCount; i++) {
        compileExpressionToReg(state, node->data.call.args.items[i], reg + 1 + i);
    }
    
    // Call: A = base, B = arg count + 1, C = return count + 1
    emitInstruction(state, OP_CALL, reg, argCount + 1, 2);
}

static void compileMethodCall(CompilerState* state, ASTNode* node, int reg) {
    // Compile object
    compileExpressionToReg(state, node->data.methodcall.object, reg);
    
    // SELF instruction: A[A+1] = A[B], A = A
    int methodIdx = addConstant(state, node->data.methodcall.method);
    emitInstruction(state, OP_SELF, reg, reg, methodIdx | 0x100); // Mark as constant
    
    // Compile arguments (after self)
    int argCount = node->data.methodcall.args.count;
    for (int i = 0; i < argCount; i++) {
        compileExpressionToReg(state, node->data.methodcall.args.items[i], reg + 2 + i);
    }
    
    // Call with self as first arg
    emitInstruction(state, OP_CALL, reg, argCount + 2, 2);
}

static void compileDotIndex(CompilerState* state, ASTNode* node, int reg) {
    compileExpressionToReg(state, node->data.dotindex.object, reg);
    int fieldIdx = addConstant(state, node->data.dotindex.field);
    emitInstruction(state, OP_GETTABLE, reg, reg, fieldIdx | 0x100); // Constant flag
}

static void compileIndex(CompilerState* state, ASTNode* node, int reg) {
    compileExpressionToReg(state, node->data.index.object, reg);
    int keyReg = allocReg(state);
    compileExpressionToReg(state, node->data.index.key, keyReg);
    emitInstruction(state, OP_GETTABLE, reg, reg, keyReg);
    freeReg(state);
}

static void compileTable(CompilerState* state, ASTNode* node, int reg) {
    int arraySize = 0;
    int hashSize = 0;
    
    for (int i = 0; i < node->data.table.fields.count; i++) {
        ASTNode* field = node->data.table.fields.items[i];
        if (field->type == NODE_TABLE_FIELD) {
            ASTNode* key = field->data.field.key;
            if (key == NULL) {
                arraySize++;
            } else if (key->type == NODE_NUMBER) {
                arraySize++;
            } else {
                hashSize++;
            }
        } else {
            // Direct value (array element)
            arraySize++;
        }
    }
    
    emitInstruction(state, OP_NEWTABLE, reg, arraySize, hashSize);
    
    int arrayIdx = 1;
    for (int i = 0; i < node->data.table.fields.count; i++) {
        ASTNode* field = node->data.table.fields.items[i];
        
        if (field->type != NODE_TABLE_FIELD) {
            // Direct value - array element
            int valReg = allocReg(state);
            compileExpressionToReg(state, field, valReg);
            emitInstruction(state, OP_SETLIST, reg, 1, arrayIdx++);
            freeReg(state);
            continue;
        }
        
        ASTNode* key = field->data.field.key;
        ASTNode* value = field->data.field.value;
        
        if (key == NULL) {
            // Array element without explicit key
            int valReg = allocReg(state);
            compileExpressionToReg(state, value, valReg);
            emitInstruction(state, OP_SETLIST, reg, 1, arrayIdx++);
            freeReg(state);
        } else if (key->type == NODE_NUMBER) {
            // Numeric key
            int valReg = allocReg(state);
            compileExpressionToReg(state, value, valReg);
            emitInstruction(state, OP_SETLIST, reg, 1, arrayIdx++);
            freeReg(state);
        } else if (key->type == NODE_STRING || key->type == NODE_NAME) {
            // String/name key - hash element
            int valReg = allocReg(state);
            const char* keyStr = key->data.string;
            int keyIdx = addConstant(state, keyStr);
            compileExpressionToReg(state, value, valReg);
            emitInstruction(state, OP_SETTABLE, reg, keyIdx | 0x100, valReg);
            freeReg(state);
        } else {
            // Expression key
            int keyReg = allocReg(state);
            int valReg = allocReg(state);
            compileExpressionToReg(state, key, keyReg);
            compileExpressionToReg(state, value, valReg);
            emitInstruction(state, OP_SETTABLE, reg, keyReg, valReg);
            freeReg(state);
            freeReg(state);
        }
    }
}

static void compileBinop(CompilerState* state, ASTNode* node, int reg) {
    const char* op = node->data.binop.op;
    
    // Short-circuit for and/or
    if (strcmp(op, "and") == 0 || strcmp(op, "or") == 0) {
        compileExpressionToReg(state, node->data.binop.left, reg);
        int jumpIdx = emitInstruction(state, OP_TEST, reg, 0, strcmp(op, "or") == 0 ? 1 : 0);
        int jmpIdx = emitInstruction(state, OP_JMP, 0, 0, 0);
        compileExpressionToReg(state, node->data.binop.right, reg);
        // Patch jump
        currentChunk(state)->Instructions[jmpIdx].B = currentChunk(state)->Count - jmpIdx - 1;
        return;
    }
    
    // Allocate temp registers above current stack to avoid conflicts
    int leftReg = allocReg(state);
    int rightReg = allocReg(state);
    compileExpressionToReg(state, node->data.binop.left, leftReg);
    compileExpressionToReg(state, node->data.binop.right, rightReg);
    
    OpCode opcode;
    if (strcmp(op, "+") == 0) opcode = OP_ADD;
    else if (strcmp(op, "-") == 0) opcode = OP_SUB;
    else if (strcmp(op, "*") == 0) opcode = OP_MUL;
    else if (strcmp(op, "/") == 0) opcode = OP_DIV;
    else if (strcmp(op, "%") == 0) opcode = OP_MOD;
    else if (strcmp(op, "^") == 0) opcode = OP_POW;
    else if (strcmp(op, "..") == 0) opcode = OP_CONCAT;
    else if (strcmp(op, "==") == 0) opcode = OP_EQ;
    else if (strcmp(op, "~=") == 0) opcode = OP_EQ; // Will negate
    else if (strcmp(op, "<") == 0) opcode = OP_LT;
    else if (strcmp(op, "<=") == 0) opcode = OP_LE;
    else if (strcmp(op, ">") == 0) opcode = OP_LT; // Swap operands
    else if (strcmp(op, ">=") == 0) opcode = OP_LE; // Swap operands
    else {
        state->hadError = 1;
        snprintf(state->errorMsg, 256, "Unknown operator: %s", op);
        freeReg(state);
        return;
    }
    
    // Handle comparison operators specially
    if (opcode == OP_EQ || opcode == OP_LT || opcode == OP_LE) {
        int invert = (strcmp(op, "~=") == 0) ? 1 : 0;
        int swapped = (strcmp(op, ">") == 0 || strcmp(op, ">=") == 0);
        
        if (swapped) {
            emitInstruction(state, opcode, invert, rightReg, leftReg);
        } else {
            emitInstruction(state, opcode, invert, leftReg, rightReg);
        }
        emitInstruction(state, OP_JMP, 0, 1, 0);
        emitInstruction(state, OP_LOADBOOL, reg, 0, 1);
        emitInstruction(state, OP_LOADBOOL, reg, 1, 0);
    } else {
        emitInstruction(state, opcode, reg, leftReg, rightReg);
    }
    
    freeReg(state);
    freeReg(state);
}

static void compileUnop(CompilerState* state, ASTNode* node, int reg) {
    const char* op = node->data.unop.op;
    compileExpressionToReg(state, node->data.unop.operand, reg);
    
    if (strcmp(op, "-") == 0) {
        emitInstruction(state, OP_UNM, reg, reg, 0);
    } else if (strcmp(op, "not") == 0) {
        emitInstruction(state, OP_NOT, reg, reg, 0);
    } else if (strcmp(op, "#") == 0) {
        emitInstruction(state, OP_LEN, reg, reg, 0);
    }
}

static void compileExpressionToReg(CompilerState* state, ASTNode* node, int reg) {
    switch (node->type) {
        case NODE_NUMBER: compileNumber(state, node, reg); break;
        case NODE_STRING: compileString(state, node, reg); break;
        case NODE_BOOL: compileBool(state, node, reg); break;
        case NODE_NIL: compileNil(state, node, reg); break;
        case NODE_NAME: compileName(state, node, reg); break;
        case NODE_CALL: compileCall(state, node, reg); break;
        case NODE_METHOD_CALL: compileMethodCall(state, node, reg); break;
        case NODE_DOT_INDEX: compileDotIndex(state, node, reg); break;
        case NODE_INDEX: compileIndex(state, node, reg); break;
        case NODE_TABLE: compileTable(state, node, reg); break;
        case NODE_BINOP: compileBinop(state, node, reg); break;
        case NODE_UNOP: compileUnop(state, node, reg); break;
        case NODE_FUNCTION: {
            // Anonymous function - use loadstring approach like local functions
            char luaCode[4096];
            int pos = 0;
            
            pos += snprintf(luaCode + pos, sizeof(luaCode) - pos, "__lua__--[[%d]]function(", funcCounter++);
            for (int i = 0; i < node->data.func.params.count; i++) {
                if (i > 0) pos += snprintf(luaCode + pos, sizeof(luaCode) - pos, ",");
                ASTNode* param = node->data.func.params.items[i];
                pos += snprintf(luaCode + pos, sizeof(luaCode) - pos, "%s", param->data.string);
            }
            pos += snprintf(luaCode + pos, sizeof(luaCode) - pos, ")");
            
            // Convert body to Lua
            astToLua(node->data.func.body, luaCode, sizeof(luaCode), &pos);
            
            pos += snprintf(luaCode + pos, sizeof(luaCode) - pos, " end");
            
            int constIdx = addConstant(state, luaCode);
            emitInstruction(state, OP_CLOSURE, reg, constIdx, node->data.func.params.count);
            break;
        }
        default:
            state->hadError = 1;
            snprintf(state->errorMsg, 256, "Cannot compile expression type %d", node->type);
            break;
    }
}

static void compileLocal(CompilerState* state, ASTNode* node) {
    int count = node->data.local.names.count;
    int valueCount = node->data.local.values.count;
    
    // Allocate slots for locals
    int firstSlot = currentCompiler(state)->localCount;
    
    for (int i = 0; i < count; i++) {
        ASTNode* name = node->data.local.names.items[i];
        addLocal(state, name->data.string);
    }
    
    // Compile values
    for (int i = 0; i < count; i++) {
        int slot = firstSlot + i;
        if (i < valueCount) {
            compileExpressionToReg(state, node->data.local.values.items[i], slot);
        } else {
            emitInstruction(state, OP_LOADNIL, slot, 0, 0);
        }
    }
}

static void compileAssign(CompilerState* state, ASTNode* node) {
    int targetCount = node->data.assign.targets.count;
    int valueCount = node->data.assign.values.count;
    
    // Compile values to temp registers first
    int baseReg = currentCompiler(state)->stackTop;
    for (int i = 0; i < valueCount; i++) {
        int reg = allocReg(state);
        compileExpressionToReg(state, node->data.assign.values.items[i], reg);
    }
    
    // Assign to targets
    for (int i = 0; i < targetCount; i++) {
        ASTNode* target = node->data.assign.targets.items[i];
        int valueReg = (i < valueCount) ? baseReg + i : -1;
        
        if (target->type == NODE_NAME) {
            const char* name = target->data.string;
            int local = resolveLocal(currentCompiler(state), name);
            
            if (local != -1) {
                if (valueReg >= 0) {
                    emitInstruction(state, OP_MOVE, local, valueReg, 0);
                } else {
                    emitInstruction(state, OP_LOADNIL, local, 0, 0);
                }
            } else {
                int constIdx = addConstant(state, name);
                if (valueReg >= 0) {
                    emitInstruction(state, OP_SETGLOBAL, valueReg, constIdx, 0);
                } else {
                    int nilReg = allocReg(state);
                    emitInstruction(state, OP_LOADNIL, nilReg, 0, 0);
                    emitInstruction(state, OP_SETGLOBAL, nilReg, constIdx, 0);
                    freeReg(state);
                }
            }
        } else if (target->type == NODE_DOT_INDEX) {
            int objReg = allocReg(state);
            compileExpressionToReg(state, target->data.dotindex.object, objReg);
            int fieldIdx = addConstant(state, target->data.dotindex.field);
            emitInstruction(state, OP_SETTABLE, objReg, fieldIdx | 0x100, valueReg >= 0 ? valueReg : objReg);
            freeReg(state);
        } else if (target->type == NODE_INDEX) {
            int objReg = allocReg(state);
            int keyReg = allocReg(state);
            compileExpressionToReg(state, target->data.index.object, objReg);
            compileExpressionToReg(state, target->data.index.key, keyReg);
            emitInstruction(state, OP_SETTABLE, objReg, keyReg, valueReg >= 0 ? valueReg : objReg);
            freeReg(state);
            freeReg(state);
        }
    }
    
    // Free value registers
    for (int i = 0; i < valueCount; i++) {
        freeReg(state);
    }
}

static void compileIf(CompilerState* state, ASTNode* node) {
    ASTNode* cond = node->data.ifstmt.condition;
    int thenJump;
    
    // Check if condition is a comparison - handle directly
    if (cond->type == NODE_BINOP) {
        const char* op = cond->data.binop.op;
        if (strcmp(op, "<") == 0 || strcmp(op, "<=") == 0 || 
            strcmp(op, ">") == 0 || strcmp(op, ">=") == 0 ||
            strcmp(op, "==") == 0 || strcmp(op, "~=") == 0) {
            
            int leftReg = allocReg(state);
            int rightReg = allocReg(state);
            compileExpressionToReg(state, cond->data.binop.left, leftReg);
            compileExpressionToReg(state, cond->data.binop.right, rightReg);
            
            OpCode opcode;
            int invert = 0;
            int swapped = 0;
            
            // For if: skip then block when condition is FALSE
            // A=0: skips if comparison is TRUE (we want to execute then block)
            // So we need A=0 to skip the jump-over-then when TRUE
            if (strcmp(op, "<") == 0) { opcode = OP_LT; invert = 0; }
            else if (strcmp(op, "<=") == 0) { opcode = OP_LE; invert = 0; }
            else if (strcmp(op, ">") == 0) { opcode = OP_LT; invert = 0; swapped = 1; }
            else if (strcmp(op, ">=") == 0) { opcode = OP_LE; invert = 0; swapped = 1; }
            else if (strcmp(op, "==") == 0) { opcode = OP_EQ; invert = 0; }
            else { opcode = OP_EQ; invert = 1; } // ~=
            
            if (swapped) {
                emitInstruction(state, opcode, invert, rightReg, leftReg);
            } else {
                emitInstruction(state, opcode, invert, leftReg, rightReg);
            }
            
            freeReg(state);
            freeReg(state);
            
            thenJump = emitInstruction(state, OP_JMP, 0, 0, 0);
            goto compile_then;
        }
    }
    
    // Fallback: compile condition as expression and test
    {
        int condReg = allocReg(state);
        compileExpressionToReg(state, cond, condReg);
        freeReg(state);
        emitInstruction(state, OP_TEST, condReg, 0, 0);
        thenJump = emitInstruction(state, OP_JMP, 0, 0, 0);
    }
    
compile_then:
    
    // Compile then block
    beginScope(state);
    compileNode(state, node->data.ifstmt.thenBlock);
    endScope(state);
    
    // Check if we have else/elseif
    int hasElse = (node->data.ifstmt.elseBlock != NULL) || (node->data.ifstmt.elseifs.count > 0);
    int elseJump = -1;
    
    if (hasElse) {
        elseJump = emitInstruction(state, OP_JMP, 0, 0, 0);
    }
    
    // Patch then jump - jumps here if condition was false
    currentChunk(state)->Instructions[thenJump].B = currentChunk(state)->Count - thenJump - 1;
    
    // Compile elseifs
    for (int i = 0; i < node->data.ifstmt.elseifs.count; i++) {
        ASTNode* elseif = node->data.ifstmt.elseifs.items[i];
        
        int condReg2 = allocReg(state);
        compileExpressionToReg(state, elseif->data.ifstmt.condition, condReg2);
        freeReg(state);
        
        emitInstruction(state, OP_TEST, condReg2, 0, 0);
        int elseifJump = emitInstruction(state, OP_JMP, 0, 0, 0);
        
        beginScope(state);
        compileNode(state, elseif->data.ifstmt.thenBlock);
        endScope(state);
        
        int nextJump = emitInstruction(state, OP_JMP, 0, 0, 0);
        currentChunk(state)->Instructions[elseifJump].B = currentChunk(state)->Count - elseifJump - 1;
        
        // Chain jumps to end
        if (elseJump >= 0) {
            currentChunk(state)->Instructions[elseJump].B = currentChunk(state)->Count - elseJump - 1;
        }
        elseJump = nextJump;
    }
    
    // Compile else block
    if (node->data.ifstmt.elseBlock) {
        beginScope(state);
        compileNode(state, node->data.ifstmt.elseBlock);
        endScope(state);
    }
    
    // Patch final jump
    if (elseJump >= 0) {
        currentChunk(state)->Instructions[elseJump].B = currentChunk(state)->Count - elseJump - 1;
    }
}

static void compileWhile(CompilerState* state, ASTNode* node) {
    int loopStart = currentChunk(state)->Count;
    
    ASTNode* cond = node->data.whilestmt.condition;
    int exitJump;
    
    // Check if condition is a comparison - handle directly
    if (cond->type == NODE_BINOP) {
        const char* op = cond->data.binop.op;
        if (strcmp(op, "<") == 0 || strcmp(op, "<=") == 0 || 
            strcmp(op, ">") == 0 || strcmp(op, ">=") == 0 ||
            strcmp(op, "==") == 0 || strcmp(op, "~=") == 0) {
            
            // Compile operands
            int leftReg = allocReg(state);
            int rightReg = allocReg(state);
            compileExpressionToReg(state, cond->data.binop.left, leftReg);
            compileExpressionToReg(state, cond->data.binop.right, rightReg);
            
            // Determine opcode and whether to swap/invert
            OpCode opcode;
            int invert = 0;
            int swapped = 0;
            
            // For while: we want to EXIT when condition is FALSE
            // VM logic: if (comparison)~=(A==1) then skip
            // A=0: skips if comparison is TRUE
            // A=1: skips if comparison is FALSE
            // We want to skip exit jump when condition is TRUE, so A=0
            // But exit jump comes AFTER comparison, so we need to NOT skip when TRUE
            // Actually: comparison TRUE -> continue loop (don't take exit) -> skip exit jump
            // So A=0 means: skip next if TRUE -> correct!
            if (strcmp(op, "<") == 0) { opcode = OP_LT; invert = 0; }
            else if (strcmp(op, "<=") == 0) { opcode = OP_LE; invert = 0; }
            else if (strcmp(op, ">") == 0) { opcode = OP_LT; invert = 0; swapped = 1; }
            else if (strcmp(op, ">=") == 0) { opcode = OP_LE; invert = 0; swapped = 1; }
            else if (strcmp(op, "==") == 0) { opcode = OP_EQ; invert = 0; }
            else { opcode = OP_EQ; invert = 1; } // ~=
            
            // Emit comparison - if false, skip next instruction (the jump back)
            if (swapped) {
                emitInstruction(state, opcode, invert, rightReg, leftReg);
            } else {
                emitInstruction(state, opcode, invert, leftReg, rightReg);
            }
            
            freeReg(state);
            freeReg(state);
            
            // Jump to exit if comparison failed
            exitJump = emitInstruction(state, OP_JMP, 0, 0, 0);
            
            goto compile_body;
        }
    }
    
    // Fallback: compile condition as expression and test
    {
        int condReg = allocReg(state);
        compileExpressionToReg(state, cond, condReg);
        emitInstruction(state, OP_TEST, condReg, 0, 0);
        freeReg(state);
        exitJump = emitInstruction(state, OP_JMP, 0, 0, 0);
    }
    
compile_body:
    // Compile body
    beginScope(state);
    compileNode(state, node->data.whilestmt.body);
    endScope(state);
    
    // Jump back to start
    int loopJump = emitInstruction(state, OP_JMP, 0, 0, 0);
    currentChunk(state)->Instructions[loopJump].B = loopStart - loopJump - 1;
    
    // Patch exit jump
    currentChunk(state)->Instructions[exitJump].B = currentChunk(state)->Count - exitJump - 1;
}

static void compileForNum(CompilerState* state, ASTNode* node) {
    beginScope(state);
    
    // Internal loop variables
    int base = currentCompiler(state)->localCount;
    addLocal(state, "(for index)");
    addLocal(state, "(for limit)");
    addLocal(state, "(for step)");
    addLocal(state, node->data.fornum.var);
    
    // Initialize loop variables
    compileExpressionToReg(state, node->data.fornum.start, base);
    compileExpressionToReg(state, node->data.fornum.limit, base + 1);
    compileExpressionToReg(state, node->data.fornum.step, base + 2);
    
    // FORPREP - jumps to FORLOOP
    int prepIdx = emitInstruction(state, OP_FORPREP, base, 0, 0);
    
    int loopStart = currentChunk(state)->Count;
    
    // Body
    compileNode(state, node->data.fornum.body);
    
    // FORLOOP - jumps back to loopStart if continuing
    int loopIdx = emitInstruction(state, OP_FORLOOP, base, 0, 0);
    
    // FORPREP jumps forward to FORLOOP
    currentChunk(state)->Instructions[prepIdx].B = loopIdx - prepIdx - 1;
    // FORLOOP jumps back to loopStart (body start)
    currentChunk(state)->Instructions[loopIdx].B = loopIdx - loopStart + 1;
    
    endScope(state);
}

static void compileForIn(CompilerState* state, ASTNode* node) {
    beginScope(state);
    
    int base = currentCompiler(state)->localCount;
    
    // Internal variables: iterator, state, control
    addLocal(state, "(for generator)");
    addLocal(state, "(for state)");
    addLocal(state, "(for control)");
    
    // User variables
    for (int i = 0; i < node->data.forin.names.count; i++) {
        ASTNode* name = node->data.forin.names.items[i];
        addLocal(state, name->data.string);
    }
    
    // Initialize iterator
    for (int i = 0; i < node->data.forin.iterators.count && i < 3; i++) {
        compileExpressionToReg(state, node->data.forin.iterators.items[i], base + i);
    }
    
    int loopStart = currentChunk(state)->Count;
    
    // TFORLOOP
    emitInstruction(state, OP_TFORLOOP, base, 0, node->data.forin.names.count);
    int exitJump = emitInstruction(state, OP_JMP, 0, 0, 0);
    
    // Body
    compileNode(state, node->data.forin.body);
    
    // Jump back
    int backJump = emitInstruction(state, OP_JMP, 0, 0, 0);
    currentChunk(state)->Instructions[backJump].B = loopStart - backJump - 1;
    
    // Patch exit
    currentChunk(state)->Instructions[exitJump].B = currentChunk(state)->Count - exitJump - 1;
    
    endScope(state);
}

static void compileReturn(CompilerState* state, ASTNode* node) {
    int count = node->data.ret.values.count;
    int base = currentCompiler(state)->stackTop;
    
    for (int i = 0; i < count; i++) {
        compileExpressionToReg(state, node->data.ret.values.items[i], base + i);
    }
    
    emitInstruction(state, OP_RETURN, base, count + 1, 0);
}

// Helper to generate Lua code from AST (simplified)
static void astToLua(ASTNode* node, char* buf, int bufSize, int* pos);

static void astExprToLua(ASTNode* node, char* buf, int bufSize, int* pos) {
    if (!node || *pos >= bufSize - 100) return;
    
    switch (node->type) {
        case NODE_NUMBER:
            *pos += snprintf(buf + *pos, bufSize - *pos, "%.17g", node->data.number);
            break;
        case NODE_STRING:
            *pos += snprintf(buf + *pos, bufSize - *pos, "\"%s\"", node->data.string);
            break;
        case NODE_NAME:
            *pos += snprintf(buf + *pos, bufSize - *pos, "%s", node->data.string);
            break;
        case NODE_BOOL:
            *pos += snprintf(buf + *pos, bufSize - *pos, "%s", node->data.boolean ? "true" : "false");
            break;
        case NODE_NIL:
            *pos += snprintf(buf + *pos, bufSize - *pos, "nil");
            break;
        case NODE_BINOP:
            *pos += snprintf(buf + *pos, bufSize - *pos, "(");
            astExprToLua(node->data.binop.left, buf, bufSize, pos);
            *pos += snprintf(buf + *pos, bufSize - *pos, "%s", node->data.binop.op);
            astExprToLua(node->data.binop.right, buf, bufSize, pos);
            *pos += snprintf(buf + *pos, bufSize - *pos, ")");
            break;
        case NODE_UNOP:
            *pos += snprintf(buf + *pos, bufSize - *pos, "(%s", node->data.unop.op);
            astExprToLua(node->data.unop.operand, buf, bufSize, pos);
            *pos += snprintf(buf + *pos, bufSize - *pos, ")");
            break;
        case NODE_CALL:
            astExprToLua(node->data.call.func, buf, bufSize, pos);
            *pos += snprintf(buf + *pos, bufSize - *pos, "(");
            for (int i = 0; i < node->data.call.args.count; i++) {
                if (i > 0) *pos += snprintf(buf + *pos, bufSize - *pos, ",");
                astExprToLua(node->data.call.args.items[i], buf, bufSize, pos);
            }
            *pos += snprintf(buf + *pos, bufSize - *pos, ")");
            break;
        case NODE_METHOD_CALL:
            astExprToLua(node->data.methodcall.object, buf, bufSize, pos);
            *pos += snprintf(buf + *pos, bufSize - *pos, ":%s(", node->data.methodcall.method);
            for (int i = 0; i < node->data.methodcall.args.count; i++) {
                if (i > 0) *pos += snprintf(buf + *pos, bufSize - *pos, ",");
                astExprToLua(node->data.methodcall.args.items[i], buf, bufSize, pos);
            }
            *pos += snprintf(buf + *pos, bufSize - *pos, ")");
            break;
        case NODE_DOT_INDEX:
            astExprToLua(node->data.dotindex.object, buf, bufSize, pos);
            *pos += snprintf(buf + *pos, bufSize - *pos, ".%s", node->data.dotindex.field);
            break;
        case NODE_INDEX:
            astExprToLua(node->data.index.object, buf, bufSize, pos);
            *pos += snprintf(buf + *pos, bufSize - *pos, "[");
            astExprToLua(node->data.index.key, buf, bufSize, pos);
            *pos += snprintf(buf + *pos, bufSize - *pos, "]");
            break;
        case NODE_TABLE:
            *pos += snprintf(buf + *pos, bufSize - *pos, "{");
            for (int i = 0; i < node->data.table.fields.count; i++) {
                if (i > 0) *pos += snprintf(buf + *pos, bufSize - *pos, ",");
                ASTNode* f = node->data.table.fields.items[i];
                if (f->type == NODE_TABLE_FIELD) {
                    if (f->data.field.key) {
                        *pos += snprintf(buf + *pos, bufSize - *pos, "[");
                        astExprToLua(f->data.field.key, buf, bufSize, pos);
                        *pos += snprintf(buf + *pos, bufSize - *pos, "]=");
                    }
                    astExprToLua(f->data.field.value, buf, bufSize, pos);
                } else {
                    astExprToLua(f, buf, bufSize, pos);
                }
            }
            *pos += snprintf(buf + *pos, bufSize - *pos, "}");
            break;
        case NODE_FUNCTION:
            // Anonymous function / closure
            *pos += snprintf(buf + *pos, bufSize - *pos, "function(");
            for (int i = 0; i < node->data.func.params.count; i++) {
                if (i > 0) *pos += snprintf(buf + *pos, bufSize - *pos, ",");
                *pos += snprintf(buf + *pos, bufSize - *pos, "%s", node->data.func.params.items[i]->data.string);
            }
            *pos += snprintf(buf + *pos, bufSize - *pos, ")");
            astToLua(node->data.func.body, buf, bufSize, pos);
            *pos += snprintf(buf + *pos, bufSize - *pos, " end");
            break;
        default:
            break;
    }
}

static void astToLua(ASTNode* node, char* buf, int bufSize, int* pos) {
    if (!node || *pos >= bufSize - 100) return;
    
    switch (node->type) {
        case NODE_BLOCK:
            for (int i = 0; i < node->data.block.statements.count; i++) {
                astToLua(node->data.block.statements.items[i], buf, bufSize, pos);
            }
            break;
        case NODE_LOCAL: {
            *pos += snprintf(buf + *pos, bufSize - *pos, "local ");
            for (int i = 0; i < node->data.local.names.count; i++) {
                if (i > 0) *pos += snprintf(buf + *pos, bufSize - *pos, ",");
                *pos += snprintf(buf + *pos, bufSize - *pos, "%s", node->data.local.names.items[i]->data.string);
            }
            if (node->data.local.values.count > 0) {
                *pos += snprintf(buf + *pos, bufSize - *pos, "=");
                for (int i = 0; i < node->data.local.values.count; i++) {
                    if (i > 0) *pos += snprintf(buf + *pos, bufSize - *pos, ",");
                    astExprToLua(node->data.local.values.items[i], buf, bufSize, pos);
                }
            }
            *pos += snprintf(buf + *pos, bufSize - *pos, " ");
            break;
        }
        case NODE_ASSIGN: {
            for (int i = 0; i < node->data.assign.targets.count; i++) {
                if (i > 0) *pos += snprintf(buf + *pos, bufSize - *pos, ",");
                astExprToLua(node->data.assign.targets.items[i], buf, bufSize, pos);
            }
            *pos += snprintf(buf + *pos, bufSize - *pos, "=");
            for (int i = 0; i < node->data.assign.values.count; i++) {
                if (i > 0) *pos += snprintf(buf + *pos, bufSize - *pos, ",");
                astExprToLua(node->data.assign.values.items[i], buf, bufSize, pos);
            }
            *pos += snprintf(buf + *pos, bufSize - *pos, " ");
            break;
        }
        case NODE_IF: {
            *pos += snprintf(buf + *pos, bufSize - *pos, "if ");
            astExprToLua(node->data.ifstmt.condition, buf, bufSize, pos);
            *pos += snprintf(buf + *pos, bufSize - *pos, " then ");
            astToLua(node->data.ifstmt.thenBlock, buf, bufSize, pos);
            if (node->data.ifstmt.elseBlock) {
                *pos += snprintf(buf + *pos, bufSize - *pos, " else ");
                astToLua(node->data.ifstmt.elseBlock, buf, bufSize, pos);
            }
            *pos += snprintf(buf + *pos, bufSize - *pos, " end ");
            break;
        }
        case NODE_WHILE: {
            *pos += snprintf(buf + *pos, bufSize - *pos, "while ");
            astExprToLua(node->data.whilestmt.condition, buf, bufSize, pos);
            *pos += snprintf(buf + *pos, bufSize - *pos, " do ");
            astToLua(node->data.whilestmt.body, buf, bufSize, pos);
            *pos += snprintf(buf + *pos, bufSize - *pos, " end ");
            break;
        }
        case NODE_FOR_NUM: {
            *pos += snprintf(buf + *pos, bufSize - *pos, "for %s=", node->data.fornum.var);
            astExprToLua(node->data.fornum.start, buf, bufSize, pos);
            *pos += snprintf(buf + *pos, bufSize - *pos, ",");
            astExprToLua(node->data.fornum.limit, buf, bufSize, pos);
            if (node->data.fornum.step) {
                *pos += snprintf(buf + *pos, bufSize - *pos, ",");
                astExprToLua(node->data.fornum.step, buf, bufSize, pos);
            }
            *pos += snprintf(buf + *pos, bufSize - *pos, " do ");
            astToLua(node->data.fornum.body, buf, bufSize, pos);
            *pos += snprintf(buf + *pos, bufSize - *pos, " end ");
            break;
        }
        case NODE_FOR_IN: {
            *pos += snprintf(buf + *pos, bufSize - *pos, "for ");
            for (int i = 0; i < node->data.forin.names.count; i++) {
                if (i > 0) *pos += snprintf(buf + *pos, bufSize - *pos, ",");
                *pos += snprintf(buf + *pos, bufSize - *pos, "%s", node->data.forin.names.items[i]->data.string);
            }
            *pos += snprintf(buf + *pos, bufSize - *pos, " in ");
            for (int i = 0; i < node->data.forin.iterators.count; i++) {
                if (i > 0) *pos += snprintf(buf + *pos, bufSize - *pos, ",");
                astExprToLua(node->data.forin.iterators.items[i], buf, bufSize, pos);
            }
            *pos += snprintf(buf + *pos, bufSize - *pos, " do ");
            astToLua(node->data.forin.body, buf, bufSize, pos);
            *pos += snprintf(buf + *pos, bufSize - *pos, " end ");
            break;
        }
        case NODE_RETURN:
            *pos += snprintf(buf + *pos, bufSize - *pos, "return ");
            for (int i = 0; i < node->data.ret.values.count; i++) {
                if (i > 0) *pos += snprintf(buf + *pos, bufSize - *pos, ",");
                astExprToLua(node->data.ret.values.items[i], buf, bufSize, pos);
            }
            *pos += snprintf(buf + *pos, bufSize - *pos, " ");
            break;
        case NODE_BREAK:
            *pos += snprintf(buf + *pos, bufSize - *pos, "break ");
            break;
        case NODE_CALL:
        case NODE_METHOD_CALL:
            // Expression statements
            astExprToLua(node, buf, bufSize, pos);
            *pos += snprintf(buf + *pos, bufSize - *pos, " ");
            break;
        case NODE_LOCAL_FUNCTION:
        case NODE_FUNCTION:
            // Nested function definition
            if (node->data.func.name) {
                *pos += snprintf(buf + *pos, bufSize - *pos, "local function %s(", node->data.func.name);
            } else {
                *pos += snprintf(buf + *pos, bufSize - *pos, "local function(");
            }
            for (int i = 0; i < node->data.func.params.count; i++) {
                if (i > 0) *pos += snprintf(buf + *pos, bufSize - *pos, ",");
                *pos += snprintf(buf + *pos, bufSize - *pos, "%s", node->data.func.params.items[i]->data.string);
            }
            *pos += snprintf(buf + *pos, bufSize - *pos, ")");
            astToLua(node->data.func.body, buf, bufSize, pos);
            *pos += snprintf(buf + *pos, bufSize - *pos, " end ");
            break;
        default:
            break;
    }
}

static void compileFunction(CompilerState* state, ASTNode* node) {
    const char* funcName = node->data.func.name;
    int funcSlot = -1;
    
    if (node->type == NODE_LOCAL_FUNCTION && funcName) {
        funcSlot = addLocal(state, funcName);
    }
    
    // Generate Lua code for the function with unique ID to prevent constant reuse
    char luaCode[4096];
    int pos = 0;
    
    // Add unique identifier comment to prevent constant deduplication
    pos += snprintf(luaCode + pos, sizeof(luaCode) - pos, "__lua__--[[%d]]function(", funcCounter++);
    for (int i = 0; i < node->data.func.params.count; i++) {
        if (i > 0) pos += snprintf(luaCode + pos, sizeof(luaCode) - pos, ",");
        ASTNode* param = node->data.func.params.items[i];
        pos += snprintf(luaCode + pos, sizeof(luaCode) - pos, "%s", param->data.string);
    }
    pos += snprintf(luaCode + pos, sizeof(luaCode) - pos, ")");
    
    // Convert body to Lua
    astToLua(node->data.func.body, luaCode, sizeof(luaCode), &pos);
    
    pos += snprintf(luaCode + pos, sizeof(luaCode) - pos, " end");
    
    if (funcSlot >= 0) {
        int constIdx = addConstant(state, luaCode);
        emitInstruction(state, OP_CLOSURE, funcSlot, constIdx, node->data.func.params.count);
    }
}

static void compileStatement(CompilerState* state, ASTNode* node) {
    switch (node->type) {
        case NODE_LOCAL:
            compileLocal(state, node);
            break;
        case NODE_ASSIGN:
            compileAssign(state, node);
            break;
        case NODE_IF:
            compileIf(state, node);
            break;
        case NODE_WHILE:
            compileWhile(state, node);
            break;
        case NODE_FOR_NUM:
            compileForNum(state, node);
            break;
        case NODE_FOR_IN:
            compileForIn(state, node);
            break;
        case NODE_RETURN:
            compileReturn(state, node);
            break;
        case NODE_BREAK:
            // TODO: Track break jumps
            emitInstruction(state, OP_JMP, 0, 0, 0);
            break;
        case NODE_FUNCTION:
        case NODE_LOCAL_FUNCTION:
            compileFunction(state, node);
            break;
        case NODE_CALL:
        case NODE_METHOD_CALL: {
            int reg = allocReg(state);
            compileExpressionToReg(state, node, reg);
            freeReg(state);
            break;
        }
        default:
            break;
    }
}

static void compileNode(CompilerState* state, ASTNode* node) {
    if (!node || state->hadError) return;
    
    switch (node->type) {
        case NODE_CHUNK:
        case NODE_BLOCK:
            for (int i = 0; i < node->data.block.statements.count; i++) {
                compileStatement(state, node->data.block.statements.items[i]);
            }
            break;
        default:
            compileStatement(state, node);
            break;
    }
}

CompilerState* CreateCompilerState(const char* source) {
    CompilerState* state = (CompilerState*)malloc(sizeof(CompilerState));
    state->parser = CreateParser(source);
    state->current = NULL;
    state->hadError = 0;
    state->errorMsg[0] = '\0';
    return state;
}

void FreeCompilerState(CompilerState* state) {
    if (state) {
        FreeParser(state->parser);
        free(state);
    }
}

BytecodeChunk* Compile(CompilerState* state) {
    ASTNode* ast = Parse(state->parser);
    
    if (state->parser->hadError) {
        state->hadError = 1;
        strcpy(state->errorMsg, state->parser->errorMsg);
        FreeAST(ast);
        return NULL;
    }
    
    Compiler mainCompiler;
    initCompiler(state, &mainCompiler);
    
    compileNode(state, ast);
    
    // Add final return
    emitInstruction(state, OP_RETURN, 0, 1, 0);
    
    FreeAST(ast);
    
    if (state->hadError) {
        fprintf(stderr, "[COMPILER ERROR] %s\n", state->errorMsg);
        return NULL;
    }
    
    return mainCompiler.chunk;
}
