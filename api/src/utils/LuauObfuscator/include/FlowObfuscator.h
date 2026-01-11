#ifndef FLOW_OBFUSCATOR_H
#define FLOW_OBFUSCATOR_H

#include "BytecodeBuilder.h"

// Control Flow Flattening - transforms control structures into state machine
void ApplyControlFlowFlattening(BytecodeChunk* chunk);

// Opaque Predicates - inserts always-true/false conditions
void InsertOpaquePredicates(char** script, int* size, int* capacity);

// Control Flow Dispatcher - state machine in script
void GenerateControlFlowDispatcher(char** script, int* size, int* capacity);

#endif
