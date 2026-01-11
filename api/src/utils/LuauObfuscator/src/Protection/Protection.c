#include "../../include/Protection.h"
#include "../../include/Utils.h"

char* GetAntiTamperCode() {
    // Basic idea: check if key functions exist or have been tampered.
    // In a real scenario this would wrap encryption.
    return strdup("if (string.dump) then else while true do end end"); 
}

char* GetAntiDebugCode() {
    // A simple tight loop that would hang if debugged stepping through, 
    // or checks timings (mock).
    // User requested format style:
    // BB=function(u,u)while-239 do u[0B1][0X25_]=(-0b11001101);end;if not(141-0X2C)then else return{-(-0b11000100)};end;return nil;end
    return strdup("local BB=function(u) while false do u[0]=0; end if debug and debug.info then while true do end end return 1 end");
}

char* GetControlFlowJunk() {
    // Generates a junk loop akin to the user's example
    // loop: while-239 do ...
    // Note: 'while -239 do' in Lua 5.1 is valid (numbers are true), but infinite loop unless break. 
    // The user's snippet 'while -239 do' seems to imply it expects it to NOT run or break instantly?
    // Actually in Lua: all numbers are true. 'while -239' is 'while true'. 
    // Maybe they rely on 'break' or it's just fake code that never runs.
    
    char* junk = (char*)malloc(512);
    snprintf(junk, 512, 
        "local junk_%s = function() "
        "   local x = 0x%s; "
        "   while (x > 0) do "
        "       x = x - 1; "
        "       if (x %% 2 == 0) then end "
        "   end "
        "end", 
        GenerateRandomString(5), 
        GenerateRandomHex(3)
    );
    return junk;
}
