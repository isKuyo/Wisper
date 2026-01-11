#ifndef NESTED_VM_H
#define NESTED_VM_H

// Nested VM - VM within VM execution
void GenerateNestedVMWrapper(char** script, int* size, int* capacity);

// Generate inner VM dispatcher
void GenerateInnerVMDispatcher(char** script, int* size, int* capacity, int layer);

// Metamorphic code generator
void GenerateMetamorphicCode(char** script, int* size, int* capacity);

// Self-modifying code patterns
void GenerateSelfModifyingPatterns(char** script, int* size, int* capacity);

// Bytecode encryption layer
void GenerateBytecodeEncryption(char** script, int* size, int* capacity, int key);

// Native-like code generation (optimized Lua patterns)
void GenerateNativePatterns(char** script, int* size, int* capacity);

#endif
