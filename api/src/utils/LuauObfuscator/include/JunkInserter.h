#ifndef JUNK_INSERTER_H
#define JUNK_INSERTER_H

#include "BytecodeBuilder.h"

// Insert junk/dead code into bytecode
void InsertJunkCode(BytecodeChunk* chunk);

// Generate realistic junk code patterns in script
void GenerateJunkPatterns(char** script, int* size, int* capacity, int count);

#endif
