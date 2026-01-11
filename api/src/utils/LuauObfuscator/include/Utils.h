#ifndef UTILS_H
#define UTILS_H

#include "../include/Common.h"
#include "../include/BytecodeBuilder.h"

// Random Generation
void SeedRandom();
int RandomInt(int min, int max);
char* GenerateRandomString(int length);
char* GenerateRandomHex(int length);

// Logging
void LogInfo(const char* format, ...);
void LogError(const char* format, ...);

// Base85 Encoding
char* EncodeBase85Custom(const unsigned char* data, int len);
char* SerializeBytecode(BytecodeChunk* chunk);

// String buffer helper
void Append(char** buffer, int* size, int* capacity, const char* str);

#endif
