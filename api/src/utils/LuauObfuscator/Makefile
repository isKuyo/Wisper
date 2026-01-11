CC=gcc
CFLAGS=-I./include -Wall -std=c99
SRC=src/Main.c src/Utils/Utils.c src/Protection/Protection.c src/Generator/VmGenerator.c src/Compiler/BytecodeBuilder.c src/Compiler/Compiler.c src/Parser/Lexer.c src/Parser/Parser.c src/VM/VmOpcodes.c src/Crypto/Encryption.c src/Flow/ControlFlow.c src/Tamper/AntiTamper.c src/Poly/Polymorphic.c src/Fragment/Fragmenter.c
OBJ=$(SRC:.c=.o)
OUT=bin/Obfuscator.exe

all: $(OUT)

$(OUT): $(OBJ)
	$(CC) -o $@ $^

%.o: %.c
	$(CC) $(CFLAGS) -c $< -o $@

clean:
	rm -f src/*.o src/*/*.o $(OUT)
