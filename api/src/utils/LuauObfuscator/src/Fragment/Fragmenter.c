#include "../../include/Fragmenter.h"
#include "../../include/Utils.h"

FragmentContext* CreateFragmentContext() {
    FragmentContext* ctx = (FragmentContext*)malloc(sizeof(FragmentContext));
    ctx->fragmentCount = 0;
    ctx->fakeCount = 0;
    ctx->orderTable = NULL;
    ctx->entryFragment = 0;
    return ctx;
}

void FragmentBytecode(FragmentContext* ctx, BytecodeChunk* chunk, int blockSize) {
    if (blockSize < 4) blockSize = 4;
    
    // Calculate total bytecode size
    int totalSize = 1 + 1; // version + const count
    for (int i = 0; i < chunk->ConstantCount; i++) {
        totalSize += 1 + strlen(chunk->Constants[i]);
    }
    totalSize += chunk->Count * 4; // instructions
    
    // Create fragments
    int offset = 0;
    while (offset < totalSize && ctx->fragmentCount < MAX_FRAGMENTS) {
        Fragment* frag = &ctx->fragments[ctx->fragmentCount];
        frag->id = ctx->fragmentCount;
        frag->type = FRAG_REAL;
        frag->realOrder = ctx->fragmentCount;
        
        int fragSize = blockSize + RandomInt(-2, 2);
        if (fragSize < 2) fragSize = 2;
        if (offset + fragSize > totalSize) fragSize = totalSize - offset;
        
        frag->dataLen = fragSize;
        frag->data = (unsigned char*)malloc(fragSize);
        frag->nextFragment = ctx->fragmentCount + 1;
        frag->checksum = RandomInt(0x1000, 0xFFFFFF);
        frag->decryptKey = RandomInt(1, 255);
        
        offset += fragSize;
        ctx->fragmentCount++;
    }
    
    // Set last fragment's next to -1
    if (ctx->fragmentCount > 0) {
        ctx->fragments[ctx->fragmentCount - 1].nextFragment = -1;
    }
}

void InsertFakeBlocks(FragmentContext* ctx, int count) {
    for (int i = 0; i < count && ctx->fragmentCount < MAX_FRAGMENTS; i++) {
        Fragment* frag = &ctx->fragments[ctx->fragmentCount];
        frag->id = ctx->fragmentCount;
        frag->type = FRAG_FAKE;
        frag->realOrder = -1;
        
        // Generate fake data
        int fakeSize = RandomInt(8, 32);
        frag->dataLen = fakeSize;
        frag->data = (unsigned char*)malloc(fakeSize);
        for (int j = 0; j < fakeSize; j++) {
            frag->data[j] = (unsigned char)RandomInt(0, 255);
        }
        
        frag->nextFragment = RandomInt(0, ctx->fragmentCount);
        frag->checksum = RandomInt(0x1000, 0xFFFFFF);
        frag->decryptKey = RandomInt(1, 255);
        
        ctx->fakeBlocks[ctx->fakeCount++] = ctx->fragmentCount;
        ctx->fragmentCount++;
    }
}

void ShuffleFragments(FragmentContext* ctx) {
    // Fisher-Yates shuffle
    for (int i = ctx->fragmentCount - 1; i > 0; i--) {
        int j = RandomInt(0, i);
        
        // Swap fragments
        Fragment temp = ctx->fragments[i];
        ctx->fragments[i] = ctx->fragments[j];
        ctx->fragments[j] = temp;
    }
    
    // Update entry fragment
    for (int i = 0; i < ctx->fragmentCount; i++) {
        if (ctx->fragments[i].realOrder == 0 && ctx->fragments[i].type == FRAG_REAL) {
            ctx->entryFragment = i;
            break;
        }
    }
}

char* GenerateFragmentLoader(FragmentContext* ctx) {
    char* code = (char*)malloc(4096);
    code[0] = '\0';
    char buf[512];
    
    // Generate fragment order table
    snprintf(buf, 512, 
        "local fO={");
    strcat(code, buf);
    
    for (int i = 0; i < ctx->fragmentCount; i++) {
        if (ctx->fragments[i].type == FRAG_REAL) {
            snprintf(buf, 512, "[%d]=%d,", ctx->fragments[i].realOrder, i);
            strcat(code, buf);
        }
    }
    strcat(code, "};");
    
    // Generate loader function
    snprintf(buf, 512,
        "local function lF(id)"
        "local f=fT[fO[id]];"
        "if f then "
        "local d=f.d;"
        "for i=1,#d do d=string.char(bit32.bxor(string.byte(d,i),f.k));end;"
        "return d;"
        "end;"
        "return '';"
        "end;");
    strcat(code, buf);
    
    // Generate fragment table
    strcat(code, "local fT={");
    for (int i = 0; i < ctx->fragmentCount && i < 20; i++) {
        Fragment* f = &ctx->fragments[i];
        snprintf(buf, 512, "[%d]={d='", i);
        strcat(code, buf);
        
        // Add escaped data
        for (int j = 0; j < f->dataLen && j < 64; j++) {
            snprintf(buf, 16, "\\%03d", f->data[j]);
            strcat(code, buf);
        }
        
        snprintf(buf, 512, "',k=%d,n=%d},", f->decryptKey, f->nextFragment);
        strcat(code, buf);
    }
    strcat(code, "};");
    
    return code;
}

void FreeFragmentContext(FragmentContext* ctx) {
    if (ctx) {
        for (int i = 0; i < ctx->fragmentCount; i++) {
            if (ctx->fragments[i].data) {
                free(ctx->fragments[i].data);
            }
        }
        if (ctx->orderTable) free(ctx->orderTable);
        free(ctx);
    }
}
