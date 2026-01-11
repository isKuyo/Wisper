#include "../../include/ControlFlow.h"
#include "../../include/Utils.h"

ControlFlowContext* CreateControlFlowContext() {
    ControlFlowContext* ctx = (ControlFlowContext*)malloc(sizeof(ControlFlowContext));
    ctx->stateCount = 0;
    ctx->entryState = 0;
    ctx->exitState = -1;
    ctx->dispatcherVariant = RandomInt(0, 4);
    ctx->stateXorKey = RandomInt(0x1000, 0xFFFF);
    ctx->redundantJumps = RandomInt(5, 15);
    ctx->fakeLoops = RandomInt(2, 6);
    return ctx;
}

void AddState(ControlFlowContext* ctx, StateType type, int nextReal) {
    if (ctx->stateCount >= MAX_STATES) return;
    
    StateNode* node = &ctx->states[ctx->stateCount];
    node->id = ctx->stateCount;
    node->type = type;
    node->nextReal = nextReal;
    node->nextFake = RandomInt(0, ctx->stateCount);
    node->condition = RandomInt(0, 5);
    node->stateKey = (ctx->stateCount * 7919 + ctx->stateXorKey) ^ ctx->stateXorKey;
    
    ctx->stateCount++;
}

void InsertFakeStates(ControlFlowContext* ctx, int count) {
    for (int i = 0; i < count && ctx->stateCount < MAX_STATES; i++) {
        StateNode* node = &ctx->states[ctx->stateCount];
        node->id = ctx->stateCount;
        node->type = STATE_FAKE;
        node->nextReal = RandomInt(0, ctx->stateCount);
        node->nextFake = RandomInt(0, ctx->stateCount);
        node->condition = RandomInt(0, 10);
        node->stateKey = RandomInt(0x1000, 0xFFFF);
        ctx->stateCount++;
    }
}

void InsertRedundantJumps(ControlFlowContext* ctx, int count) {
    ctx->redundantJumps = count;
}

void EncryptStateTransitions(ControlFlowContext* ctx, unsigned int key) {
    for (int i = 0; i < ctx->stateCount; i++) {
        ctx->states[i].stateKey ^= key;
    }
}

char* GenerateCFDispatcher(ControlFlowContext* ctx, int variant) {
    char* code = (char*)malloc(8192);
    code[0] = '\0';
    char buf[512];
    
    switch (variant % 5) {
        case 0: // While-based dispatcher
            snprintf(buf, 512,
                "local st=%d;"
                "local xk=%u;"
                "while true do "
                "local cs=bit32.bxor(st,xk);",
                ctx->entryState, ctx->stateXorKey);
            strcat(code, buf);
            break;
            
        case 1: // Repeat-until dispatcher
            snprintf(buf, 512,
                "local st=%d;"
                "local done=false;"
                "repeat "
                "local cs=st*%d%%256;",
                ctx->entryState, ctx->stateXorKey % 100 + 7);
            strcat(code, buf);
            break;
            
        case 2: // Goto-style (using labels simulation)
            snprintf(buf, 512,
                "local st,xk,_r=%d,%u,0;"
                "while st>=0 do "
                "local cs=(st+_r)%%128;_r=_r+1;",
                ctx->entryState, ctx->stateXorKey);
            strcat(code, buf);
            break;
            
        case 3: // Table-driven dispatcher
            snprintf(buf, 512,
                "local st=%d;"
                "local jt={};for i=0,127 do jt[i]=i end;"
                "while st do "
                "local cs=jt[st%%128];",
                ctx->entryState);
            strcat(code, buf);
            break;
            
        default: // Computed dispatcher
            snprintf(buf, 512,
                "local st=%d;"
                "local sk=%u;"
                "while true do "
                "local cs=bit32.band(st,0x7F);"
                "st=bit32.bxor(st,sk);",
                ctx->entryState, ctx->stateXorKey);
            strcat(code, buf);
            break;
    }
    
    // Add state handlers
    for (int i = 0; i < ctx->stateCount && i < 20; i++) {
        StateNode* node = &ctx->states[i];
        
        if (node->type == STATE_FAKE) {
            // Fake state - does nothing useful
            snprintf(buf, 512,
                "if cs==%d then local _t=%d;_t=_t+1;st=%d;",
                i, RandomInt(1, 100), node->nextReal);
        } else {
            // Real state
            snprintf(buf, 512,
                "if cs==%d then st=%d;",
                i, node->nextReal);
        }
        strcat(code, buf);
        
        // Add redundant condition
        if (RandomInt(0, 2) == 0) {
            snprintf(buf, 512, "if %d>%d then end;", RandomInt(50, 100), RandomInt(1, 49));
            strcat(code, buf);
        }
        
        strcat(code, "end;");
    }
    
    // Close dispatcher
    strcat(code, "if st<0 then break end;end;");
    
    return code;
}

void FreeControlFlowContext(ControlFlowContext* ctx) {
    if (ctx) free(ctx);
}
