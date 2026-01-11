#include "../include/Common.h"
#include "../include/Utils.h"
#include "../include/BytecodeBuilder.h"
#include "../include/VmGenerator.h"
#include "../include/Compiler.h"

// Full Lua parser using new compiler
BytecodeChunk* ParseLuaFile(const char* filename) {
    FILE* f = fopen(filename, "rb");
    if (!f) {
        LogError("Cannot open file: %s", filename);
        return NULL;
    }
    
    // Read file content
    fseek(f, 0, SEEK_END);
    long size = ftell(f);
    fseek(f, 0, SEEK_SET);
    
    char* content = (char*)malloc(size + 1);
    fread(content, 1, size, f);
    content[size] = '\0';
    fclose(f);
    
    // Normalize CRLF to LF
    char* src = content;
    char* dst = content;
    while (*src) {
        if (*src == '\r' && *(src + 1) == '\n') {
            src++; // Skip \r, keep \n
        } else {
            *dst++ = *src++;
        }
    }
    *dst = '\0';
    size = dst - content;
    
    LogInfo("File size: %ld bytes", size);
    
    // Use the new full compiler
    CompilerState* state = CreateCompilerState(content);
    BytecodeChunk* chunk = Compile(state);
    
    if (state->hadError || !chunk) {
        LogError("Compilation failed: %s", state->errorMsg);
        FreeCompilerState(state);
        free(content);
        return NULL;
    }
    
    LogInfo("Compiled successfully: %d constants, %d instructions", 
        chunk->ConstantCount, chunk->Count);
    
    FreeCompilerState(state);
    free(content);
    
    return chunk;
}

int main(int argc, char** argv) {
    SeedRandom();
    LogInfo("Starting Luau Obfuscator v2.0 (Advanced)...");
    LogInfo("Build features: Opcode Shuffling, Polymorphic VM, Smart Noise, Anti-Tamper");

    BytecodeChunk* chunk = NULL;
    char* outputFile = "Obfuscated.lua";

    if (argc < 2) {
        LogInfo("Usage: Obfuscator.exe <input.lua> [output.lua]");
        LogInfo("Running Demo Mode: Obfuscating 'print(\"Hello World\")'");
        
        // Demo mode
        chunk = CreateChunk();
        AddConstant(chunk, "print");
        AddConstant(chunk, "Hello World from Luau Obfuscator!");
        AddInstruction(chunk, OP_GETGLOBAL, 0, 0, 0);
        AddInstruction(chunk, OP_LOADK, 1, 1, 0);
        AddInstruction(chunk, OP_CALL, 0, 1, 1);
    } else {
        LogInfo("Input file: %s", argv[1]);
        chunk = ParseLuaFile(argv[1]);
        
        if (!chunk) {
            LogError("Failed to parse input file");
            return 1;
        }
        
        if (argc >= 3) {
            outputFile = argv[2];
        }
    }

    // Generate the obfuscated script
    char* result = GenerateObfuscatedScript(chunk);
    
    LogInfo("Obfuscation Complete!");
    LogInfo("Constants: %d, Instructions: %d", chunk->ConstantCount, chunk->Count);

    // Save to file
    FILE* f = fopen(outputFile, "w");
    if (f) {
        fprintf(f, "%s", result);
        fclose(f);
        LogInfo("Saved to '%s'", outputFile);
    } else {
        LogError("Failed to save output file");
    }

    // Cleanup
    free(result);
    FreeChunk(chunk);

    return 0;
}
