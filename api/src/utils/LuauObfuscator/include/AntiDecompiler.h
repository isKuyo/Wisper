#ifndef ANTI_DECOMPILER_H
#define ANTI_DECOMPILER_H

#include "BytecodeBuilder.h"

// Insert anti-decompiler traps that confuse Unluac, Luraph decompilers
void InsertAntiDecompilerTraps(BytecodeChunk* chunk);

// Generate anti-decompiler code patterns in script
void GenerateAntiDecompilerPatterns(char** script, int* size, int* capacity);

#endif
