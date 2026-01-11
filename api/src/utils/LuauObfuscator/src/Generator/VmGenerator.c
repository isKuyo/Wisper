#include "../../include/VmGenerator.h"
#include "../../include/Utils.h"
#include "../../include/Protection.h"
#include "../../include/FlowObfuscator.h"
#include "../../include/StringEncryptor.h"
#include "../../include/CodeVirtualizer.h"
#include "../../include/JunkInserter.h"
#include "../../include/AntiDecompiler.h"
#include "../../include/NestedVM.h"

#define MAX_OPCODES 100
#define MAX_DUMMY_PATTERNS 12

// Build context for variability
typedef struct {
    int buildId;
    int opcodeMap[256];
    int xorKey;
    int encKey;
    int dispatcherVariant;
    int decoderVariant;
    int checksumSeed;
} BuildContext;

// Helper to append text
void Append(char** buffer, int* size, int* capacity, const char* str) {
    int len = strlen(str);
    while (*size + len >= *capacity) {
        *capacity *= 2;
        char* newBuf = (char*)realloc(*buffer, *capacity);
        if (newBuf) {
            *buffer = newBuf;
            memset(*buffer + *size, 0, *capacity - *size);
        }
    }
    strcpy(*buffer + *size, str);
    *size += len;
    (*buffer)[*size] = '\0';
}

// Create unique build context
BuildContext* CreateBuildContext() {
    BuildContext* ctx = (BuildContext*)malloc(sizeof(BuildContext));
    ctx->buildId = RandomInt(10000, 99999);
    ctx->xorKey = RandomInt(1, 254);
    ctx->encKey = RandomInt(0x1000, 0xFFFFFF);
    ctx->dispatcherVariant = RandomInt(0, 4);
    ctx->decoderVariant = RandomInt(0, 4);
    ctx->checksumSeed = RandomInt(0x100, 0xFFFF);
    
    // Generate shuffled opcode mapping - randomize real opcodes to different values
    // Create array of available values and shuffle
    int available[256];
    for (int i = 0; i < 256; i++) {
        available[i] = i;
    }
    // Fisher-Yates shuffle
    for (int i = 255; i > 0; i--) {
        int j = RandomInt(0, i);
        int temp = available[i];
        available[i] = available[j];
        available[j] = temp;
    }
    // Assign shuffled values to opcodes
    for (int i = 0; i < 256; i++) {
        ctx->opcodeMap[i] = available[i];
    }
    return ctx;
}

// Generate smart noise functions that look important
void GenerateSmartNoise(char** script, int* size, int* capacity, const char* name, int variant) {
    char buf[1024];
    
    switch (variant % MAX_DUMMY_PATTERNS) {
        case 0: // Fake validator
            snprintf(buf, 1024, 
                "%s=function(u,E,x)"
                "local h=%u;"
                "for i=1,#u do h=bit32.bxor(h*%d,string.byte(u,i)or 0);end;"
                "return h==%u and E or x;"
                "end,",
                name, RandomInt(0x1000,0xFFFF), RandomInt(31,127), RandomInt(0x10000,0xFFFFFF));
            break;
        case 1: // Fake decryptor
            snprintf(buf, 1024,
                "%s=function(d,k)"
                "local o,m={},k or %u;"
                "for i=1,#d do o[i]=string.char(bit32.bxor(string.byte(d,i),m%%256));m=m+%d;end;"
                "return table.concat(o);"
                "end,",
                name, RandomInt(0x100,0xFFFF), RandomInt(3,17));
            break;
        case 2: // Fake state machine
            snprintf(buf, 1024,
                "%s=function(s,t)"
                "local st=%d;"
                "while st>0 do "
                "if st==%d then st=t[1]or-1;"
                "elseif st==%d then st=s and %d or-1;"
                "else st=-1;end;end;"
                "return st==-%d;"
                "end,",
                name, RandomInt(1,10), RandomInt(1,5), RandomInt(6,10), 
                RandomInt(1,5), RandomInt(1,3));
            break;
        case 3: // Fake checksum
            snprintf(buf, 1024,
                "%s=function(b)"
                "local c=%u;"
                "for i=1,#b do "
                "c=bit32.bxor(c,string.byte(b,i));"
                "for j=1,8 do c=bit32.bxor(bit32.rshift(c,1),%u*bit32.band(c,1));end;"
                "end;"
                "return c;"
                "end,",
                name, RandomInt(0x1000,0xFFFFFF), RandomInt(0x10000,0xFFFFFF));
            break;
        case 4: // Fake loader with closure
            snprintf(buf, 1024,
                "%s=(function()"
                "local _k=%u;"
                "local _t={};"
                "for i=0,%d do _t[i]=bit32.bxor(i,_k)end;"
                "return function(x)return _t[x%%%d]or 0;end;"
                "end)(),",
                name, RandomInt(0x100,0xFFF), RandomInt(64,128), RandomInt(64,128));
            break;
        case 5: // Fake cross-validator
            snprintf(buf, 1024,
                "%s=function(a,b,c)"
                "local v=bit32.bxor(a or %d,b or %d);"
                "if c then v=bit32.band(v,c);end;"
                "return v>%d and v<%d;"
                "end,",
                name, RandomInt(100,500), RandomInt(100,500), 
                RandomInt(10,100), RandomInt(500,1000));
            break;
        case 6: // Fake table manipulator
            snprintf(buf, 1024,
                "%s=function(t,k,v)"
                "if type(t)~='table'then return nil;end;"
                "local h=%u;"
                "for i,x in pairs(t)do h=bit32.bxor(h,type(x)=='number'and x or 0);end;"
                "t[k]=bit32.bxor(v or 0,h);"
                "return t;"
                "end,",
                name, RandomInt(0x1000,0xFFFF));
            break;
        case 7: // Fake iterator
            snprintf(buf, 1024,
                "%s=function(n,s)"
                "local i,m=0,s or %d;"
                "return function()"
                "i=i+1;"
                "if i>n then return nil;end;"
                "m=bit32.bxor(m*%d,i);"
                "return i,m%%%d;"
                "end;"
                "end,",
                name, RandomInt(100,999), RandomInt(3,17), RandomInt(100,1000));
            break;
        case 8: // Fake environment checker
            snprintf(buf, 1024,
                "%s=function()"
                "local e=getfenv();"
                "local c=%u;"
                "for k,v in pairs(e)do "
                "if type(v)=='function'then c=c+1;end;"
                "end;"
                "return c>%d;"
                "end,",
                name, RandomInt(0,50), RandomInt(10,30));
            break;
        case 9: // Fake bit manipulator
            snprintf(buf, 1024,
                "%s=function(x,y,z)"
                "local r=bit32.band(x or %d,y or %d);"
                "r=bit32.bor(r,bit32.lshift(z or 0,%d));"
                "return bit32.bxor(r,%u);"
                "end,",
                name, RandomInt(0xFF,0xFFFF), RandomInt(0xFF,0xFFFF),
                RandomInt(1,8), RandomInt(0x100,0xFFF));
            break;
        case 10: // Fake string builder
            snprintf(buf, 1024,
                "%s=function(...)"
                "local a={...};"
                "local o={};"
                "for i=1,#a do "
                "if type(a[i])=='string'then "
                "for j=1,#a[i]do o[#o+1]=string.char(bit32.bxor(string.byte(a[i],j),%d));end;"
                "end;end;"
                "return table.concat(o);"
                "end,",
                name, RandomInt(1,50));
            break;
        default: // Fake math operation
            snprintf(buf, 1024,
                "%s=function(a,b)"
                "local r=((a or %d)*(b or %d)+%d)%%%d;"
                "return r>%d and r or r+%d;"
                "end,",
                name, RandomInt(1,100), RandomInt(1,100), 
                RandomInt(100,1000), RandomInt(1000,10000),
                RandomInt(100,500), RandomInt(10,50));
            break;
    }
    
    Append(script, size, capacity, buf);
}

// Generate polymorphic opcode handlers using dispatch table - opcodes completely hidden
void GenerateOpcodeHandlers(char** script, int* size, int* capacity, BuildContext* ctx) {
    char buf[2048];
    
    // Create dispatch table - opcodes are hidden as table indices
    // The table is built with scrambled indices so no pattern is visible
    Append(script, size, capacity, "local U={};local H={};");
    
    // Build handler table with shuffled indices - no visible opcode numbers!
    // Each handler is assigned to H[shuffledOp]
    
    snprintf(buf, 2048, "H[%d]=function()S[A]=S[B] end;", ctx->opcodeMap[0]); // MOVE
    Append(script, size, capacity, buf);
    
    snprintf(buf, 2048, "H[%d]=function()S[A]=K[B] end;", ctx->opcodeMap[1]); // LOADK
    Append(script, size, capacity, buf);
    
    snprintf(buf, 2048, "H[%d]=function()S[A]=(B==1);if C==1 then pos=pos+4 end end;", ctx->opcodeMap[2]); // LOADBOOL
    Append(script, size, capacity, buf);
    
    snprintf(buf, 2048, "H[%d]=function()for i=A,A+B do S[i]=nil end end;", ctx->opcodeMap[3]); // LOADNIL
    Append(script, size, capacity, buf);
    
    snprintf(buf, 2048, "H[%d]=function()S[A]=U[B] end;", ctx->opcodeMap[4]); // GETUPVAL
    Append(script, size, capacity, buf);
    
    snprintf(buf, 2048, "H[%d]=function()S[A]=G[K[B]] end;", ctx->opcodeMap[5]); // GETGLOBAL
    Append(script, size, capacity, buf);
    
    snprintf(buf, 2048, "H[%d]=function()local k=C>=256 and K[C-256] or S[C];S[A]=S[B][k] end;", ctx->opcodeMap[6]); // GETTABLE
    Append(script, size, capacity, buf);
    
    snprintf(buf, 2048, "H[%d]=function()G[K[B]]=S[A] end;", ctx->opcodeMap[7]); // SETGLOBAL
    Append(script, size, capacity, buf);
    
    snprintf(buf, 2048, "H[%d]=function()U[B]=S[A] end;", ctx->opcodeMap[8]); // SETUPVAL
    Append(script, size, capacity, buf);
    
    snprintf(buf, 2048, "H[%d]=function()local k=B>=256 and K[B-256] or S[B];local v=C>=256 and K[C-256] or S[C];S[A][k]=v end;", ctx->opcodeMap[9]); // SETTABLE
    Append(script, size, capacity, buf);
    
    snprintf(buf, 2048, "H[%d]=function()S[A]={} end;", ctx->opcodeMap[10]); // NEWTABLE
    Append(script, size, capacity, buf);
    
    snprintf(buf, 2048, "H[%d]=function()local k=C>=256 and K[C-256] or S[C];S[A+1]=S[B];S[A]=S[B][k] end;", ctx->opcodeMap[11]); // SELF
    Append(script, size, capacity, buf);
    
    snprintf(buf, 2048, "H[%d]=function()S[A]=S[B]+S[C] end;", ctx->opcodeMap[12]); // ADD
    Append(script, size, capacity, buf);
    
    snprintf(buf, 2048, "H[%d]=function()S[A]=S[B]-S[C] end;", ctx->opcodeMap[13]); // SUB
    Append(script, size, capacity, buf);
    
    snprintf(buf, 2048, "H[%d]=function()S[A]=S[B]*S[C] end;", ctx->opcodeMap[14]); // MUL
    Append(script, size, capacity, buf);
    
    snprintf(buf, 2048, "H[%d]=function()S[A]=S[B]/S[C] end;", ctx->opcodeMap[15]); // DIV
    Append(script, size, capacity, buf);
    
    snprintf(buf, 2048, "H[%d]=function()S[A]=S[B]%%S[C] end;", ctx->opcodeMap[16]); // MOD
    Append(script, size, capacity, buf);
    
    snprintf(buf, 2048, "H[%d]=function()S[A]=S[B]^S[C] end;", ctx->opcodeMap[17]); // POW
    Append(script, size, capacity, buf);
    
    snprintf(buf, 2048, "H[%d]=function()S[A]=-S[B] end;", ctx->opcodeMap[18]); // UNM
    Append(script, size, capacity, buf);
    
    snprintf(buf, 2048, "H[%d]=function()S[A]=not S[B] end;", ctx->opcodeMap[19]); // NOT
    Append(script, size, capacity, buf);
    
    snprintf(buf, 2048, "H[%d]=function()S[A]=#S[B] end;", ctx->opcodeMap[20]); // LEN
    Append(script, size, capacity, buf);
    
    snprintf(buf, 2048, "H[%d]=function()S[A]=S[B]..S[C] end;", ctx->opcodeMap[21]); // CONCAT
    Append(script, size, capacity, buf);
    
    snprintf(buf, 2048, "H[%d]=function()pos=pos+B*6 end;", ctx->opcodeMap[22]); // JMP
    Append(script, size, capacity, buf);
    
    snprintf(buf, 2048, "H[%d]=function()if (S[B]==S[C])~=(A==1) then pos=pos+6 end end;", ctx->opcodeMap[23]); // EQ
    Append(script, size, capacity, buf);
    
    snprintf(buf, 2048, "H[%d]=function()if (S[B]<S[C])~=(A==1) then pos=pos+6 end end;", ctx->opcodeMap[24]); // LT
    Append(script, size, capacity, buf);
    
    snprintf(buf, 2048, "H[%d]=function()if (S[B]<=S[C])~=(A==1) then pos=pos+6 end end;", ctx->opcodeMap[25]); // LE
    Append(script, size, capacity, buf);
    
    snprintf(buf, 2048, "H[%d]=function()if (not S[A])~=(C==1) then pos=pos+6 end end;", ctx->opcodeMap[26]); // TEST
    Append(script, size, capacity, buf);
    
    snprintf(buf, 2048, "H[%d]=function()if (not S[B])~=(C==1) then pos=pos+6 else S[A]=S[B] end end;", ctx->opcodeMap[27]); // TESTSET
    Append(script, size, capacity, buf);
    
    snprintf(buf, 2048, "H[%d]=function()local f=S[A];local args={};for i=1,B-1 do args[i]=S[A+i] end;local rets={f(unpack(args))};if C>1 then for i=1,C-1 do S[A+i-1]=rets[i] end else S[A]=rets[1] end end;", ctx->opcodeMap[28]); // CALL
    Append(script, size, capacity, buf);
    
    snprintf(buf, 2048, "H[%d]=function()local f=S[A];local args={};for i=1,B-1 do args[i]=S[A+i] end;return f(unpack(args)) end;", ctx->opcodeMap[29]); // TAILCALL
    Append(script, size, capacity, buf);
    
    snprintf(buf, 2048, "H[%d]=function()local rets={};for i=0,B-2 do rets[i+1]=S[A+i] end;return unpack(rets) end;", ctx->opcodeMap[30]); // RETURN
    Append(script, size, capacity, buf);
    
    snprintf(buf, 2048, "H[%d]=function()S[A]=S[A]+S[A+2];if S[A+2]>0 then if S[A]<=S[A+1] then S[A+3]=S[A];pos=pos-B*6 end else if S[A]>=S[A+1] then S[A+3]=S[A];pos=pos-B*6 end end end;", ctx->opcodeMap[31]); // FORLOOP
    Append(script, size, capacity, buf);
    
    snprintf(buf, 2048, "H[%d]=function()S[A]=S[A]-S[A+2];S[A+3]=S[A];pos=pos+B*6 end;", ctx->opcodeMap[32]); // FORPREP
    Append(script, size, capacity, buf);
    
    snprintf(buf, 2048, "H[%d]=function()local f,s,v=S[A],S[A+1],S[A+2];local r={f(s,v)};for i=1,C do S[A+2+i]=r[i] end;if r[1]~=nil then S[A+2]=r[1] else pos=pos+6 end end;", ctx->opcodeMap[33]); // TFORLOOP
    Append(script, size, capacity, buf);
    
    snprintf(buf, 2048, "H[%d]=function()local t=S[A];local off=(C-1)*50;for i=1,B do t[off+i]=S[A+i] end end;", ctx->opcodeMap[34]); // SETLIST
    Append(script, size, capacity, buf);
    
    snprintf(buf, 2048, "H[%d]=function()end;", ctx->opcodeMap[35]); // CLOSE
    Append(script, size, capacity, buf);
    
    snprintf(buf, 2048, "H[%d]=function()local fi=K[B];if type(fi)=='number' and _F[fi+1] then S[A]=_F[fi+1] else S[A]=function()end end end;", ctx->opcodeMap[36]); // CLOSURE
    Append(script, size, capacity, buf);
    
    snprintf(buf, 2048, "H[%d]=function()end;", ctx->opcodeMap[37]); // VARARG
    Append(script, size, capacity, buf);
    
    // Add fake handlers for noise
    for (int i = 0; i < 8; i++) {
        int fakeOp = ctx->opcodeMap[RandomInt(50, 200)];
        snprintf(buf, 512, "H[%d]=function()local _=%d end;", fakeOp, RandomInt(1,1000));
        Append(script, size, capacity, buf);
    }
    
    // Dispatch using table lookup - no if/elseif chain visible!
    Append(script, size, capacity, "local h=H[op];if h then h() end;");
}

// Generate dispatcher based on variant
void GenerateDispatcher(char** script, int* size, int* capacity, BuildContext* ctx) {
    char buf[512];
    
    // Read B and C as 2 bytes each (little endian), with B as signed for jumps
    const char* readBC = "local op=rb();local A=rb();local B=rb()+rb()*256;if B>=32768 then B=B-65536 end;local C=rb()+rb()*256;";
    
    switch (ctx->dispatcherVariant % 3) {
        case 0: // Standard while - most reliable
            snprintf(buf, 512, "while pos<=#D do %s", readBC);
            break;
        case 1: // For with break
            snprintf(buf, 512,
                "for _i=1,%d do "
                "if pos>#D then break;end;%s",
                RandomInt(50000,100000), readBC);
            break;
        default: // Counter-based
            snprintf(buf, 512,
                "local _c=0;"
                "while pos<=#D do "
                "_c=_c+1;if _c>%d then break;end;%s",
                RandomInt(10000,50000), readBC);
            break;
    }
    
    Append(script, size, capacity, buf);
}

// Generate dispatcher close based on variant
void GenerateDispatcherClose(char** script, int* size, int* capacity, BuildContext* ctx) {
    // All variants now use simple end;
    Append(script, size, capacity, "end;");
}

// Generate Base85 decoder variant
void GenerateBase85Decoder(char** script, int* size, int* capacity, BuildContext* ctx) {
    char buf[1024];
    
    switch (ctx->decoderVariant) {
        case 0: // Standard
            Append(script, size, capacity,
                "local function d85(s)"
                "local o,i={},1;"
                "while i<=#s do "
                "if string.sub(s,i,i+9)=='LPH+m0<X;z'then i=i+10;"
                "elseif string.sub(s,i,i+2)=='z!!'then i=i+3;"
                "else "
                "local c1,c2,c3,c4,c5=string.byte(s,i,i+4);"
                "if c1 and c5 then "
                "local v=(c1-33)*52200625+(c2-33)*614125+(c3-33)*7225+(c4-33)*85+(c5-33);"
                "o[#o+1]=string.char(math.floor(v/16777216)%256,math.floor(v/65536)%256,math.floor(v/256)%256,v%256);"
                "end;i=i+5;end;end;"
                "return table.concat(o);end;");
            break;
        case 1: // Table-based
            snprintf(buf, 1024,
                "local d85;do "
                "local T={};"
                "for i=33,117 do T[i]=i-33;end;"
                "d85=function(s)"
                "local o,i={},1;"
                "while i<=#s do "
                "local c=string.byte(s,i);"
                "if c==76 and string.sub(s,i,i+9)=='LPH+m0<X;z'then i=i+10;"
                "elseif c==122 and string.sub(s,i+1,i+2)=='!!'then i=i+3;"
                "else "
                "local c1,c2,c3,c4,c5=string.byte(s,i,i+4);"
                "if c1 and c5 then "
                "local v=T[c1]*52200625+T[c2]*614125+T[c3]*7225+T[c4]*85+T[c5];"
                "o[#o+1]=string.char(bit32.rshift(v,24)%%256,bit32.rshift(v,16)%%256,bit32.rshift(v,8)%%256,v%%256);"
                "end;i=i+5;end;end;"
                "return table.concat(o);end;end;");
            Append(script, size, capacity, buf);
            break;
        case 2: // Closure-based
            Append(script, size, capacity,
                "local d85=(function()"
                "local B=52200625;local C=614125;local D=7225;local F=85;"
                "return function(s)"
                "local o,i={},1;"
                "while i<=#s do "
                "if string.sub(s,i,i+9)=='LPH+m0<X;z'then i=i+10;"
                "elseif string.sub(s,i,i+2)=='z!!'then i=i+3;"
                "else "
                "local c1,c2,c3,c4,c5=string.byte(s,i,i+4);"
                "if c1 and c5 then "
                "local v=(c1-33)*B+(c2-33)*C+(c3-33)*D+(c4-33)*F+(c5-33);"
                "o[#o+1]=string.char(math.floor(v/16777216)%256,math.floor(v/65536)%256,math.floor(v/256)%256,v%256);"
                "end;i=i+5;end;end;"
                "return table.concat(o);end;end)();");
            break;
        default: // Optimized
            Append(script, size, capacity,
                "local function d85(s)"
                "local o,n={},0;"
                "local i=1;local len=#s;"
                "while i<=len do "
                "local c=string.byte(s,i);"
                "if c==76 then local m=string.sub(s,i,i+9);if m=='LPH+m0<X;z'then i=i+10;c=nil;end;end;"
                "if c==122 then local m=string.sub(s,i+1,i+2);if m=='!!'then i=i+3;c=nil;end;end;"
                "if c then "
                "local c1,c2,c3,c4,c5=string.byte(s,i,i+4);"
                "if c1 and c5 then "
                "local v=(c1-33)*52200625+(c2-33)*614125+(c3-33)*7225+(c4-33)*85+(c5-33);"
                "n=n+1;o[n]=string.char(math.floor(v/16777216)%256,math.floor(v/65536)%256,math.floor(v/256)%256,v%256);"
                "end;i=i+5;end;end;"
                "return table.concat(o);end;");
            break;
    }
}

// Generate anti-tamper checksum
void GenerateAntiTamper(char** script, int* size, int* capacity, BuildContext* ctx) {
    char buf[512];
    
    snprintf(buf, 512,
        "local _cs=%u;"
        "local function vF(s)"
        "local h=_cs;"
        "for i=1,math.min(#s,%d)do h=bit32.bxor(h*%d,string.byte(s,i));end;"
        "return h;"
        "end;",
        ctx->checksumSeed, RandomInt(50,200), RandomInt(17,37));
    
    Append(script, size, capacity, buf);
}

// Helper to generate compact XOR-obfuscated string using decode function
void GenerateXorObfuscatedString(char* output, int maxLen, const char* str, int xorKey, const char* decodeFunc) {
    int len = strlen(str);
    int pos = 0;
    // Use decode function: _d({n1,n2,n3...})
    pos += snprintf(output + pos, maxLen - pos, "%s({", decodeFunc);
    for (int i = 0; i < len; i++) {
        if (i > 0) pos += snprintf(output + pos, maxLen - pos, ",");
        int xored = ((unsigned char)str[i]) ^ xorKey;
        pos += snprintf(output + pos, maxLen - pos, "%d", xored);
    }
    snprintf(output + pos, maxLen - pos, "})");
}

// Generate anti-dump protection with heavily obfuscated strings
void GenerateAntiDump(char** script, int* size, int* capacity, BuildContext* ctx) {
    char buf[8192];
    
    // Create hidden variables for everything
    char* b32 = GenerateRandomString(2);  // bit32 alias
    char* sc = GenerateRandomString(2);   // string.char alias
    char* df = GenerateRandomString(2);   // decode function
    char* rg = GenerateRandomString(2);   // rawget alias
    char* tp = GenerateRandomString(2);   // type alias  
    int xorKey = RandomInt(50, 200);
    
    // Use standard libs, rawget/type directly (detection strings are hidden)
    snprintf(buf, 8192,
        "local _%s_=string;local %s=_%s_.char;"  // string and char
        "local _%s_=bit32;local %s=_%s_.bxor;"  // bit32 and bxor
        "local _%s_=rawget;local %s=type;"  // rawget and type directly
        "local %s=(function(x,c,k)return function(t)"
        "local r='';for i=1,#t do r=r..c(x(t[i],k))end;return r end end)(%s,%s,%d);",
        sc, sc, sc,
        b32, b32, b32,
        rg, tp,
        df, b32, sc, xorKey
    );
    Append(script, size, capacity, buf);
    
    // Generate XOR-obfuscated strings using decode function
    char s1[256], s2[256], s3[256], fnStr[256];
    GenerateXorObfuscatedString(s1, 256, "dump", xorKey, df);
    GenerateXorObfuscatedString(s2, 256, "decompile", xorKey, df);
    GenerateXorObfuscatedString(s3, 256, "saveinstance", xorKey, df);
    GenerateXorObfuscatedString(fnStr, 256, "function", xorKey, df);
    
    char* v1 = GenerateRandomString(2);
    char* v2 = GenerateRandomString(2);
    char* fn = GenerateRandomString(2);
    
    snprintf(buf, 8192,
        "local %s=%s;"
        "local %s=_%s_(_G,%s)or _%s_(_G,%s)or _%s_(_G,%s);"
        "if %s and %s(%s)==%s then return end;"
        "local %s=print('');if %s~=nil then return end;",
        
        fn, fnStr,
        v1, rg, s1, rg, s2, rg, s3,
        v1, tp, v1, fn,
        v2, v2
    );
    
    Append(script, size, capacity, buf);
    
    free(b32);
    free(sc);
    free(df);
    free(rg);
    free(tp);
    free(v1);
    free(v2);
    free(fn);
}

// Generate anti-debug protection with heavily obfuscated strings
void GenerateAntiDebug(char** script, int* size, int* capacity, BuildContext* ctx) {
    char buf[8192];
    
    // Create hidden variables for everything - different names than anti-dump
    char* b32 = GenerateRandomString(2);  // bit32 alias
    char* sc = GenerateRandomString(2);   // string.char alias
    char* df = GenerateRandomString(2);   // decode function
    char* rg = GenerateRandomString(2);   // rawget alias
    char* tp = GenerateRandomString(2);   // type alias
    int xorKey = RandomInt(80, 180);
    
    // Use standard libs, rawget/type directly (detection strings are hidden)
    snprintf(buf, 8192,
        "local _%s_=string;local %s=_%s_.char;"  // string and char
        "local _%s_=bit32;local %s=_%s_.bxor;"  // bit32 and bxor
        "local _%s_=rawget;local %s=type;"  // rawget and type directly
        "local %s=(function(x,c,k)return function(t)"
        "local r='';for i=1,#t do r=r..c(x(t[i],k))end;return r end end)(%s,%s,%d);",
        sc, sc, sc,
        b32, b32, b32,
        rg, tp,
        df, b32, sc, xorKey
    );
    Append(script, size, capacity, buf);
    
    // Generate XOR-obfuscated strings using decode function
    char s1[256], s2[256], s3[256], s4[256], s5[256], s6[256], s7[256], gi[256], fnStr[256];
    GenerateXorObfuscatedString(s1, 256, "syn", xorKey, df);
    GenerateXorObfuscatedString(s2, 256, "KRNL_LOADED", xorKey, df);
    GenerateXorObfuscatedString(s3, 256, "getexecutorname", xorKey, df);
    GenerateXorObfuscatedString(s4, 256, "is_sirhurt_closure", xorKey, df);
    GenerateXorObfuscatedString(s5, 256, "debug", xorKey, df);
    GenerateXorObfuscatedString(s6, 256, "hookfunction", xorKey, df);
    GenerateXorObfuscatedString(s7, 256, "replaceclosure", xorKey, df);
    GenerateXorObfuscatedString(gi, 256, "getinfo", xorKey, df);
    GenerateXorObfuscatedString(fnStr, 256, "function", xorKey, df);
    
    char* d1 = GenerateRandomString(2);
    char* d2 = GenerateRandomString(2);
    char* giv = GenerateRandomString(2);
    
    snprintf(buf, 8192,
        "local %s=%s;"
        "local %s=_%s_(_G,%s)or _%s_(_G,%s)or _%s_(_G,%s);"
        "if %s then "
        "local %s=_%s_(_G,%s)or _%s_(_G,%s);"
        "if %s and %s(%s[%s])=='function'then return end;"
        "end;",
        
        giv, gi,
        d1, rg, s1, rg, s2, rg, s3, d1,
        d2, rg, s4, rg, s5, d2, tp, d2, giv
    );
    
    Append(script, size, capacity, buf);
    
    // Second check
    char* d3 = GenerateRandomString(2);
    char* fn = GenerateRandomString(2);
    
    snprintf(buf, 8192,
        "local %s=%s;"
        "local %s=_%s_(_G,%s)or _%s_(_G,%s);"
        "if %s then "
        "if %s(tostring)~=%s then return end;"
        "end;",
        fn, fnStr,
        d3, rg, s6, rg, s7, d3,
        tp, fn
    );
    
    Append(script, size, capacity, buf);
    
    free(b32);
    free(sc);
    free(df);
    free(rg);
    free(tp);
    free(d1);
    free(d2);
    free(d3);
    free(giv);
    free(fn);
}

// Serialize bytecode with shuffled opcodes
char* SerializeBytecodeWithMapping(BytecodeChunk* chunk, BuildContext* ctx) {
    // Calculate size needed
    int dataSize = 1; // version byte
    dataSize += 1; // constant count
    for (int i = 0; i < chunk->ConstantCount; i++) {
        dataSize += 2; // string length (2 bytes)
        dataSize += strlen(chunk->Constants[i]); // string data
    }
    dataSize += chunk->Count * 6; // instructions (6 bytes each: op, A, B(2), C(2))
    
    unsigned char* buffer = (unsigned char*)malloc(dataSize);
    int pos = 0;
    
    // Version
    buffer[pos++] = 0x01;
    
    // Constants - use 2 bytes for length
    buffer[pos++] = (unsigned char)chunk->ConstantCount;
    for (int i = 0; i < chunk->ConstantCount; i++) {
        int len = strlen(chunk->Constants[i]);
        buffer[pos++] = (unsigned char)(len & 0xFF);
        buffer[pos++] = (unsigned char)((len >> 8) & 0xFF);
        memcpy(buffer + pos, chunk->Constants[i], len);
        pos += len;
    }
    
    // Instructions with SHUFFLED opcodes
    for (int i = 0; i < chunk->Count; i++) {
        // Apply opcode mapping - transform real opcode to shuffled value
        int realOp = chunk->Instructions[i].Op;
        int shuffledOp = ctx->opcodeMap[realOp];
        
        buffer[pos++] = (unsigned char)shuffledOp;  // Use shuffled opcode!
        buffer[pos++] = (unsigned char)chunk->Instructions[i].A;
        // B as 2 bytes (little endian)
        buffer[pos++] = (unsigned char)(chunk->Instructions[i].B & 0xFF);
        buffer[pos++] = (unsigned char)((chunk->Instructions[i].B >> 8) & 0xFF);
        // C as 2 bytes (little endian)
        buffer[pos++] = (unsigned char)(chunk->Instructions[i].C & 0xFF);
        buffer[pos++] = (unsigned char)((chunk->Instructions[i].C >> 8) & 0xFF);
    }
    
    // Encode to Base85
    char* encoded = EncodeBase85Custom(buffer, pos);
    free(buffer);
    
    return encoded;
}

char* GenerateObfuscatedScript(BytecodeChunk* chunk) {
    BuildContext* ctx = CreateBuildContext();
    int capacity = 65536;
    int size = 0;
    char* script = (char*)malloc(capacity);
    script[0] = '\0';
    char buf[4096];

    // === ADVANCED OBFUSCATION PASSES ===
    // (Temporarily disabled for stability - enable one by one)
    
    // 1. Insert junk code into bytecode
    // InsertJunkCode(chunk);
    
    // 2. Apply control flow flattening
    // ApplyControlFlowFlattening(chunk);
    
    // 3. Apply code virtualization (add virtual opcodes)
    // ApplyCodeVirtualization(chunk);
    
    // 4. Insert anti-decompiler traps
    // InsertAntiDecompilerTraps(chunk);
    
    // Extract functions from constants (those with __lua__ prefix)
    int funcCount = 0;
    char* funcCodes[256];
    char* originalConstants[256]; // Store original pointers
    for (int i = 0; i < chunk->ConstantCount; i++) {
        originalConstants[i] = chunk->Constants[i];
        if (chunk->Constants[i] && strlen(chunk->Constants[i]) > 7 && 
            strncmp(chunk->Constants[i], "__lua__", 7) == 0) {
            funcCodes[funcCount] = chunk->Constants[i] + 7; // Skip __lua__ prefix
            // Replace constant with function index (as string number)
            char indexStr[16];
            snprintf(indexStr, sizeof(indexStr), "%d", funcCount);
            chunk->Constants[i] = strdup(indexStr);
            funcCount++;
        }
    }

    // Serialize bytecode to Base85 with SHUFFLED opcodes
    char* encodedData = SerializeBytecodeWithMapping(chunk, ctx);
    
    // Restore original constants (for cleanup)
    for (int i = 0; i < chunk->ConstantCount; i++) {
        if (chunk->Constants[i] != originalConstants[i]) {
            free(chunk->Constants[i]); // Free the strdup'd index string
        }
        chunk->Constants[i] = originalConstants[i];
    }
    
    // Add watermark
    Append(&script, &size, &capacity, "-- This file was protected using Luraph Obfuscator v14.4.2 [https://lura.ph/]\n");
    
    // Start with return({ structure
    Append(&script, &size, &capacity, "return({");
    
    // Random order of library references
    const char* libs[] = {"C=table.move,", "U=bit32,", "V=coroutine,", "G=tostring,", "z=getfenv,", "M=math,", "S=string,"};
    int libOrder[] = {0, 1, 2, 3, 4, 5, 6};
    for (int i = 6; i > 0; i--) {
        int j = RandomInt(0, i);
        int t = libOrder[i]; libOrder[i] = libOrder[j]; libOrder[j] = t;
    }
    
    // Add some libs
    for (int i = 0; i < 3; i++) {
        Append(&script, &size, &capacity, libs[libOrder[i]]);
    }
    
    // Generate smart noise functions (first batch)
    int numNoise1 = RandomInt(8, 15);
    for (int i = 0; i < numNoise1; i++) {
        char* name = GenerateRandomString(RandomInt(1, 2));
        GenerateSmartNoise(&script, &size, &capacity, name, RandomInt(0, MAX_DUMMY_PATTERNS));
        free(name);
    }
    
    // More libs
    for (int i = 3; i < 5; i++) {
        Append(&script, &size, &capacity, libs[libOrder[i]]);
    }
    
    // Generate smart noise functions (second batch)
    int numNoise2 = RandomInt(5, 10);
    for (int i = 0; i < numNoise2; i++) {
        char* name = GenerateRandomString(RandomInt(1, 2));
        GenerateSmartNoise(&script, &size, &capacity, name, RandomInt(0, MAX_DUMMY_PATTERNS));
        free(name);
    }
    
    // Remaining libs
    for (int i = 5; i < 7; i++) {
        Append(&script, &size, &capacity, libs[libOrder[i]]);
    }
    
    // Main VM function with anti-dump protection
    Append(&script, &size, &capacity, "BW=function(u)");
    
    // Add anti-dump and anti-debug protection at the start of the VM function
    GenerateAntiDump(&script, &size, &capacity, ctx);
    GenerateAntiDebug(&script, &size, &capacity, ctx);
    
    // Add opaque predicates (confuse static analysis)
    InsertOpaquePredicates(&script, &size, &capacity);
    
    // Add anti-decompiler patterns
    GenerateAntiDecompilerPatterns(&script, &size, &capacity);
    
    // Add junk code patterns
    GenerateJunkPatterns(&script, &size, &capacity, RandomInt(3, 6));
    
    // === NEW ADVANCED FEATURES ===
    
    // Multi-layer VM wrapper
    GenerateMultiLayerVM(&script, &size, &capacity);
    
    // Constant encryption
    GenerateConstantEncryption(&script, &size, &capacity);
    
    // === ULTRA ADVANCED FEATURES (Roblox-safe) ===
    
    // Nested VM wrapper (sandboxed environment)
    GenerateNestedVMWrapper(&script, &size, &capacity);
    
    // Inner VM dispatchers (state machines)
    GenerateInnerVMDispatcher(&script, &size, &capacity, 1);
    GenerateInnerVMDispatcher(&script, &size, &capacity, 2);
    
    // Metamorphic code (self-changing patterns)
    GenerateMetamorphicCode(&script, &size, &capacity);
    
    // Self-modifying patterns
    GenerateSelfModifyingPatterns(&script, &size, &capacity);
    
    // Bytecode encryption layer
    GenerateBytecodeEncryption(&script, &size, &capacity, ctx->encKey);
    
    // Native-like optimized patterns
    GenerateNativePatterns(&script, &size, &capacity);
    
    // Robust anti-tamper with integrity checks
    char* robustTamper = GenerateRobustAntiTamper(ctx->buildId);
    Append(&script, &size, &capacity, robustTamper);
    free(robustTamper);
    
    // Timing-based anti-debug
    char* timingCheck = GenerateTimingCheck();
    Append(&script, &size, &capacity, timingCheck);
    free(timingCheck);
    
    Append(&script, &size, &capacity, "local enc=([=[");
    Append(&script, &size, &capacity, encodedData);
    Append(&script, &size, &capacity, "]=]);");
    
    // Generate Base85 decoder
    GenerateBase85Decoder(&script, &size, &capacity, ctx);
    
    // Generate anti-tamper (always enabled now)
    GenerateAntiTamper(&script, &size, &capacity, ctx);
    
    // Decode data
    Append(&script, &size, &capacity, "local D=d85(enc);local pos=1;");
    
    // Polymorphic read functions
    // Use simple reliable rb function
    Append(&script, &size, &capacity, 
        "local function rb()local b=string.byte(D,pos);pos=pos+1;return b or 0;end;");
    
    // Read string function - 2 bytes for length
    Append(&script, &size, &capacity,
        "local function rs()local n=rb()+rb()*256;local s=string.sub(D,pos,pos+n-1);pos=pos+n;return s;end;");
    
    // Load constants - convert numeric strings to numbers
    Append(&script, &size, &capacity,
        "local _=rb();local K={};local cc=rb();for i=1,cc do local s=rs();local n=tonumber(s);if n then K[i-1]=n else K[i-1]=s end;end;");
    
    // Stack and environment
    Append(&script, &size, &capacity, "local S={};local G=getfenv();");
    
    // Generate pre-defined functions table (zero loadstring approach)
    if (funcCount > 0) {
        Append(&script, &size, &capacity, "local _F={");
        for (int i = 0; i < funcCount; i++) {
            if (i > 0) Append(&script, &size, &capacity, ",");
            // Output the function code directly
            Append(&script, &size, &capacity, funcCodes[i]);
        }
        Append(&script, &size, &capacity, "};");
    } else {
        Append(&script, &size, &capacity, "local _F={};");
    }
    
    // Generate dispatcher
    GenerateDispatcher(&script, &size, &capacity, ctx);
    
    // Generate opcode handlers
    GenerateOpcodeHandlers(&script, &size, &capacity, ctx);
    
    // Close dispatcher
    GenerateDispatcherClose(&script, &size, &capacity, ctx);
    
    // Close BW function
    Append(&script, &size, &capacity, "end,");
    
    // Final batch of noise functions
    int numNoise3 = RandomInt(3, 7);
    for (int i = 0; i < numNoise3; i++) {
        char* name = GenerateRandomString(RandomInt(1, 2));
        GenerateSmartNoise(&script, &size, &capacity, name, RandomInt(0, MAX_DUMMY_PATTERNS));
        free(name);
    }
    
    // Build ID comment (for debugging/tracking)
    snprintf(buf, 512, "_B=%d,", ctx->buildId);
    Append(&script, &size, &capacity, buf);
    
    // Close and call
    Append(&script, &size, &capacity, "}):BW()");
    
    free(encodedData);
    free(ctx);
    return script;
}
