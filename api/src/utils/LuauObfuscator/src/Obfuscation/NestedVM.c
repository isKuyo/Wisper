#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "NestedVM.h"
#include "Utils.h"

void GenerateNestedVMWrapper(char** script, int* size, int* capacity) {
    char buf[4096];
    char* outerVM = GenerateRandomString(3);
    char* env = GenerateRandomString(2);
    
    // Roblox-safe version - just create sandboxed environment wrapper
    snprintf(buf, 4096,
        "local %s=setmetatable({},{__index=function(t,k)return rawget(_G,k)end,"
        "__newindex=function(t,k,v)rawset(t,k,v)end});"
        "local %s=function(fn)return function(...)"
        "return fn(...)end;end;",
        env, outerVM
    );
    
    Append(script, size, capacity, buf);
    free(outerVM);
    free(env);
}

void GenerateInnerVMDispatcher(char** script, int* size, int* capacity, int layer) {
    char buf[2048];
    char* disp = GenerateRandomString(3);
    char* state = GenerateRandomString(2);
    int baseState = RandomInt(100, 999) + (layer * 1000);
    
    snprintf(buf, 2048,
        "local %s=%d;local %s={[%d]=function()%s=%d end,[%d]=function()%s=%d end,[%d]=function()%s=nil end};"
        "while %s and %s[%s]do %s[%s]()end;",
        state, baseState, disp,
        baseState, state, baseState + 1,
        baseState + 1, state, baseState + 2,
        baseState + 2, state,
        state, disp, state, disp, state
    );
    
    Append(script, size, capacity, buf);
    free(disp);
    free(state);
}

void GenerateMetamorphicCode(char** script, int* size, int* capacity) {
    char buf[4096];
    char* morph = GenerateRandomString(3);
    char* variant = GenerateRandomString(2);
    char* transform = GenerateRandomString(3);
    
    // Use tick() for Roblox, table.unpack instead of unpack
    snprintf(buf, 4096,
        "local %s=math.floor((tick and tick()or 0)*1000)%%4;"
        "local %s=function(x)"
        "if %s==0 then return x+0 "
        "elseif %s==1 then return x*1 "
        "elseif %s==2 then return bit32.bxor(x,0)"
        "else return x end;end;"
        "local %s=function(fn)return function(...)"
        "return fn(...);end;end;",
        variant,
        transform, variant, variant, variant,
        morph
    );
    
    Append(script, size, capacity, buf);
    free(morph);
    free(variant);
    free(transform);
}

void GenerateSelfModifyingPatterns(char** script, int* size, int* capacity) {
    char buf[2048];
    char* reg = GenerateRandomString(3);
    char* mod = GenerateRandomString(3);
    
    snprintf(buf, 2048,
        "local %s={};"
        "local %s=function(id,fn)%s[id]=fn;"
        "return function(...)if %s[id]then return %s[id](...)end;end;end;",
        reg, mod, reg, reg, reg
    );
    
    Append(script, size, capacity, buf);
    free(reg);
    free(mod);
}

void GenerateBytecodeEncryption(char** script, int* size, int* capacity, int key) {
    char buf[4096];
    char* dec = GenerateRandomString(3);
    char* enc = GenerateRandomString(3);
    int key2 = RandomInt(50, 200);
    
    snprintf(buf, 4096,
        "local %s=function(data,k)"
        "local r='';local kk=%d;"
        "for i=1,#data do "
        "local b=string.byte(data,i);"
        "b=bit32.bxor(b,bit32.band(kk,255));"
        "kk=bit32.band(kk*31+17,65535);"
        "r=r..string.char(b);"
        "end;return r;end;"
        "local %s=%s;",
        dec, key,
        enc, dec
    );
    
    Append(script, size, capacity, buf);
    free(dec);
    free(enc);
}

void GenerateNativePatterns(char** script, int* size, int* capacity) {
    char buf[4096];
    char* fast = GenerateRandomString(3);
    char* cache = GenerateRandomString(3);
    char* opt = GenerateRandomString(3);
    
    snprintf(buf, 4096,
        "local %s={};"
        "local %s=function(fn,id)"
        "if not %s[id]then %s[id]=fn end;"
        "return %s[id];"
        "end;"
        "local %s=function(t)"
        "local mt={__index=function(self,k)"
        "local v=rawget(t,k);"
        "if v then rawset(self,k,v)end;"
        "return v;end};"
        "return setmetatable({},mt);"
        "end;",
        cache,
        fast, cache, cache, cache,
        opt
    );
    
    Append(script, size, capacity, buf);
    free(fast);
    free(cache);
    free(opt);
}
