#ifndef VM_GENERATOR_H
#define VM_GENERATOR_H

#include "../include/Common.h"
#include "../include/BytecodeBuilder.h"

// Generates the full obfuscated Lua script string from the bytecode chunk
// Now supports polymorphism and encryption
char* GenerateObfuscatedScript(BytecodeChunk* chunk);

#endif
