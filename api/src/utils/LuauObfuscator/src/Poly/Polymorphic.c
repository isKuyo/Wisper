#include "../../include/Polymorphic.h"
#include "../../include/Utils.h"

PolymorphicContext* CreatePolymorphicContext(int seed) {
    PolymorphicContext* ctx = (PolymorphicContext*)malloc(sizeof(PolymorphicContext));
    ctx->templateCount = 0;
    ctx->buildSeed = seed > 0 ? seed : RandomInt(1, 0xFFFFFF);
    
    // Pre-select variants for this build
    for (int i = 0; i < MAX_TEMPLATES; i++) {
        ctx->variantChoices[i] = RandomInt(0, MAX_VARIANTS - 1);
    }
    
    return ctx;
}

// Decoder templates - same logic, different forms
static const char* DECODER_VARIANTS[] = {
    // Variant 0: Standard loop
    "local function %s(d)local o={};for i=1,#d do o[i]=string.char(bit32.bxor(string.byte(d,i),%d));end;return table.concat(o);end;",
    // Variant 1: Reverse iteration
    "local function %s(d)local o={};local k=%d;for i=#d,1,-1 do o[#d-i+1]=string.char(bit32.bxor(string.byte(d,i),k));k=bit32.bxor(k,i);end;return table.concat(o);end;",
    // Variant 2: Table-based
    "local %s;do local t={};for i=0,255 do t[i]=bit32.bxor(i,%d);end;%s=function(d)local o={};for i=1,#d do o[i]=string.char(t[string.byte(d,i)]);end;return table.concat(o);end;end;",
    // Variant 3: Closure-based
    "local %s=(function()local k=%d;return function(d)local o={};for i=1,#d do local b=string.byte(d,i);o[i]=string.char(bit32.band(bit32.bxor(b,k),255));k=bit32.bxor(k,b);end;return table.concat(o);end;end)();",
    // Variant 4: Recursive style (iterative actually)
    "local function %s(d)local k,o=%d,{};local n=#d;local i=1;while i<=n do local b=string.byte(d,i);o[i]=string.char(bit32.bxor(b,k%%256));k=k+b;i=i+1;end;return table.concat(o);end;"
};

// Dispatcher templates
static const char* DISPATCHER_VARIANTS[] = {
    // Variant 0: While true
    "while true do local op=rb();%s if op==%d then break;end;end;",
    // Variant 1: Repeat until
    "local _run=true;repeat local op=rb();%s _run=op~=%d;until not _run;",
    // Variant 2: Numeric for (with break)
    "for _i=1,999999 do local op=rb();%s if op==%d then break;end;end;",
    // Variant 3: State machine
    "local _st=1;while _st>0 do local op=rb();%s if op==%d then _st=-1;end;end;",
    // Variant 4: Function recursion simulation
    "local _c=0;while _c>=0 do local op=rb();%s if op==%d then _c=-1;else _c=_c+1;end;end;"
};

// Read byte function templates
static const char* READBYTE_VARIANTS[] = {
    "local function rb()local b=string.byte(E,pos);pos=pos+1;return b or 0;end;",
    "local rb;do local p=1;rb=function()local b=string.byte(E,p);p=p+1;return b or 0;end;end;pos=1;",
    "local rb=(function()local _p=0;return function()_p=_p+1;return string.byte(E,_p)or 0;end;end)();",
    "local function rb()local r=string.byte(E,pos,pos);pos=pos+1;if r then return r;else return 0;end;end;",
    "local rb;rb=function()local v=string.byte(E,pos);pos=pos+1;return v and v or 0;end;"
};

char* GeneratePolymorphicDecoder(PolymorphicContext* ctx, const char* name, int key) {
    char* code = (char*)malloc(1024);
    int variant = ctx->variantChoices[ctx->templateCount % MAX_TEMPLATES];
    
    if (variant == 2) {
        // Special case for variant 2 (needs name twice)
        snprintf(code, 1024, DECODER_VARIANTS[variant], name, key, name);
    } else {
        snprintf(code, 1024, DECODER_VARIANTS[variant], name, key);
    }
    
    ctx->templateCount++;
    return code;
}

char* GeneratePolymorphicDispatcher(PolymorphicContext* ctx, const char* handlers, int exitOp) {
    char* code = (char*)malloc(4096);
    int variant = ctx->variantChoices[(ctx->templateCount + 10) % MAX_TEMPLATES] % 5;
    
    snprintf(code, 4096, DISPATCHER_VARIANTS[variant], handlers, exitOp);
    
    ctx->templateCount++;
    return code;
}

char* GeneratePolymorphicReadByte(PolymorphicContext* ctx) {
    int variant = ctx->variantChoices[(ctx->templateCount + 20) % MAX_TEMPLATES] % 5;
    char* code = (char*)malloc(256);
    strcpy(code, READBYTE_VARIANTS[variant]);
    ctx->templateCount++;
    return code;
}

// Generate a complete polymorphic function wrapper
char* GeneratePolymorphicWrapper(PolymorphicContext* ctx, const char* innerCode) {
    char* code = (char*)malloc(2048);
    int variant = ctx->variantChoices[(ctx->templateCount + 30) % MAX_TEMPLATES] % 4;
    
    switch (variant) {
        case 0:
            snprintf(code, 2048, "(function()%s end)()", innerCode);
            break;
        case 1:
            snprintf(code, 2048, "do %s end", innerCode);
            break;
        case 2:
            snprintf(code, 2048, "local _=(function()%s return true;end)();", innerCode);
            break;
        default:
            snprintf(code, 2048, "%s", innerCode);
            break;
    }
    
    ctx->templateCount++;
    return code;
}

void FreePolymorphicContext(PolymorphicContext* ctx) {
    if (ctx) free(ctx);
}
