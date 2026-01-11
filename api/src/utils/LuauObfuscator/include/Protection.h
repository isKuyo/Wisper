#ifndef PROTECTION_H
#define PROTECTION_H

#include "../include/Common.h"

// Returns a Lua chunk string for Anti-Tamper
char* GetAntiTamperCode();

// Returns a Lua chunk string for Anti-Debug
char* GetAntiDebugCode();

// Returns a Lua chunk string for Control Flow Flattening (Junk loop)
char* GetControlFlowJunk();

#endif
