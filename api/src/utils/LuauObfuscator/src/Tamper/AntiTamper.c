#include "../../include/AntiTamper.h"
#include "../../include/Utils.h"

AntiTamperContext* CreateAntiTamperContext() {
    AntiTamperContext* ctx = (AntiTamperContext*)malloc(sizeof(AntiTamperContext));
    ctx->checkpointCount = 0;
    ctx->validatorCount = 0;
    ctx->masterChecksum = 0;
    ctx->silentFailEnabled = 1;
    return ctx;
}

void AddCheckpoint(AntiTamperContext* ctx, CheckpointType type, int start, int end) {
    if (ctx->checkpointCount >= MAX_CHECKPOINTS) return;
    
    Checkpoint* cp = &ctx->checkpoints[ctx->checkpointCount];
    cp->id = ctx->checkpointCount;
    cp->type = type;
    cp->targetStart = start;
    cp->targetEnd = end;
    cp->failMode = RandomInt(0, 2);
    cp->expectedValue = RandomInt(0x1000, 0xFFFFFF);
    ctx->checkpointCount++;
}

void AddCrossValidator(AntiTamperContext* ctx, int funcA, int funcB) {
    if (ctx->validatorCount >= MAX_VALIDATORS) return;
    
    CrossValidator* cv = &ctx->validators[ctx->validatorCount];
    cv->funcA = funcA;
    cv->funcB = funcB;
    cv->sharedSecret = RandomInt(0x10000, 0xFFFFFF);
    cv->validationPoint = RandomInt(1, 10);
    ctx->validatorCount++;
}

unsigned int ComputeCRC32(const char* data, int len) {
    unsigned int crc = 0xFFFFFFFF;
    for (int i = 0; i < len; i++) {
        crc ^= (unsigned char)data[i];
        for (int j = 0; j < 8; j++) {
            crc = (crc >> 1) ^ (0xEDB88320 & -(crc & 1));
        }
    }
    return ~crc;
}

char* GenerateChecksumCode(AntiTamperContext* ctx, int variant) {
    char* code = (char*)malloc(2048);
    
    switch (variant % 3) {
        case 0:
            snprintf(code, 2048,
                "local function vC(s)"
                "local c=%u;"
                "for i=1,#s do "
                "c=bit32.bxor(c,string.byte(s,i));"
                "for j=1,8 do "
                "c=bit32.bxor(bit32.rshift(c,1),bit32.band(0xEDB88320,-bit32.band(c,1)));"
                "end;end;"
                "return bit32.bnot(c);"
                "end;",
                0xFFFFFFFF);
            break;
        case 1:
            snprintf(code, 2048,
                "local vC;do "
                "local t={};"
                "for i=0,255 do "
                "local c=i;"
                "for j=1,8 do "
                "c=bit32.bxor(bit32.rshift(c,1),bit32.band(0xEDB88320,-bit32.band(c,1)));"
                "end;t[i]=c;end;"
                "vC=function(s)"
                "local c=0xFFFFFFFF;"
                "for i=1,#s do "
                "c=bit32.bxor(t[bit32.band(bit32.bxor(c,string.byte(s,i)),0xFF)],bit32.rshift(c,8));"
                "end;"
                "return bit32.bnot(c);"
                "end;end;");
            break;
        default:
            snprintf(code, 2048,
                "local function vC(s)"
                "local h=%u;"
                "for i=1,#s do "
                "h=bit32.bxor(h*%d,string.byte(s,i));"
                "end;"
                "return h;"
                "end;",
                RandomInt(0x1000, 0xFFFF), RandomInt(31, 127));
            break;
    }
    
    return code;
}

char* GenerateSilentFailCode(AntiTamperContext* ctx) {
    char* code = (char*)malloc(1024);
    
    snprintf(code, 1024,
        "local _vF=%u;"
        "local function sF()"
        "_vF=bit32.bxor(_vF,%u);"
        "if _vF%%7==0 then return function()end end;"
        "return nil;"
        "end;",
        RandomInt(0x1000, 0xFFFF),
        RandomInt(0x100, 0xFFF));
    
    return code;
}

char* GenerateValidatorCode(AntiTamperContext* ctx) {
    char* code = (char*)malloc(2048);
    code[0] = '\0';
    char buf[512];
    
    snprintf(buf, 512,
        "local _vs={};"
        "local _vk=%u;",
        RandomInt(0x10000, 0xFFFFFF));
    strcat(code, buf);
    
    for (int i = 0; i < ctx->validatorCount && i < 5; i++) {
        CrossValidator* cv = &ctx->validators[i];
        snprintf(buf, 512,
            "_vs[%d]={s=%u,v=0};",
            i, cv->sharedSecret);
        strcat(code, buf);
    }
    
    snprintf(buf, 512,
        "local function xV(id,val)"
        "if _vs[id]then "
        "_vs[id].v=bit32.bxor(_vs[id].v,val);"
        "return _vs[id].v==_vs[id].s;"
        "end;"
        "return true;"
        "end;");
    strcat(code, buf);
    
    return code;
}

void FreeAntiTamperContext(AntiTamperContext* ctx) {
    if (ctx) free(ctx);
}

// Generate robust anti-tamper with multiple checks
char* GenerateRobustAntiTamper(int seed) {
    char* code = (char*)malloc(4096);
    char* v1 = GenerateRandomString(2);
    char* v2 = GenerateRandomString(2);
    char* v3 = GenerateRandomString(2);
    char* chk = GenerateRandomString(3);
    
    int key1 = RandomInt(1000, 9999);
    int key2 = RandomInt(100, 999);
    int expected = (seed * key2 + key1) & 0xFFFF;
    
    snprintf(code, 4096,
        // Integrity check function
        "local %s=function()"
        "local %s=%d;local %s=%d;"
        "local %s=bit32.band(%s*%d+%s,65535);"
        "if %s~=%d then return true end;"
        "return false;end;"
        // Self-check on script structure
        "if %s()then return end;"
        // Environment integrity
        "if type(bit32)~='table'or type(string)~='table'then return end;"
        // Function count check
        "local _fc=0;for k,v in pairs(_G)do if type(v)=='function'then _fc=_fc+1 end end;"
        "if _fc>500 then return end;",
        chk,
        v1, seed, v2, key1,
        v3, v1, key2, v2,
        v3, expected,
        chk
    );
    
    free(v1);
    free(v2);
    free(v3);
    free(chk);
    
    return code;
}

// Generate timing-based anti-debug
char* GenerateTimingCheck() {
    char* code = (char*)malloc(2048);
    char* t1 = GenerateRandomString(2);
    char* t2 = GenerateRandomString(2);
    
    snprintf(code, 2048,
        // Timing check - debuggers slow down execution
        "local %s=os.clock and os.clock()or 0;"
        "for _=1,1000 do local _=1+1 end;"
        "local %s=os.clock and os.clock()or 0;"
        "if %s-%s>0.1 then return end;",  // If loop took >100ms, likely debugging
        t1, t2, t2, t1
    );
    
    free(t1);
    free(t2);
    
    return code;
}
