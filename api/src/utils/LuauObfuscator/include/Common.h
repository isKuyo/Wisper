#ifndef COMMON_H
#define COMMON_H

#define _POSIX_C_SOURCE 200809L

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <stdarg.h>
#include <ctype.h>

// strdup declaration for C99
#ifndef strdup
char* strdup(const char* s);
#endif

// Boolean type support for C
typedef int bool;
#define true 1
#define false 0

// Configuration Macros
#define MAX_BUFFER_SIZE 100000
#define VM_VERSION "1.0.0"

// Common Helper Prototype
void LogInfo(const char* format, ...);
void LogError(const char* format, ...);

#endif
