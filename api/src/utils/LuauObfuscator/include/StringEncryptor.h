#ifndef STRING_ENCRYPTOR_H
#define STRING_ENCRYPTOR_H

#include "BytecodeBuilder.h"

// Encrypt all string constants in bytecode
void EncryptStringConstants(BytecodeChunk* chunk, int encryptionKey);

// Generate string decryption runtime code
void GenerateStringDecryptor(char** script, int* size, int* capacity, int encryptionKey);

// Generate constant number encryption
void GenerateConstantEncryption(char** script, int* size, int* capacity);

// Generate multi-layer VM wrapper
void GenerateMultiLayerVM(char** script, int* size, int* capacity);

#endif
