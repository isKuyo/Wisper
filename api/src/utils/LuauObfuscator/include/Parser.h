#ifndef PARSER_H
#define PARSER_H

#include "Common.h"
#include "Lexer.h"

typedef enum {
    NODE_CHUNK,
    NODE_BLOCK,
    NODE_LOCAL,
    NODE_ASSIGN,
    NODE_IF,
    NODE_WHILE,
    NODE_FOR_NUM,
    NODE_FOR_IN,
    NODE_REPEAT,
    NODE_FUNCTION,
    NODE_LOCAL_FUNCTION,
    NODE_RETURN,
    NODE_BREAK,
    NODE_CALL,
    NODE_METHOD_CALL,
    NODE_INDEX,
    NODE_DOT_INDEX,
    NODE_BINOP,
    NODE_UNOP,
    NODE_NUMBER,
    NODE_STRING,
    NODE_BOOL,
    NODE_NIL,
    NODE_NAME,
    NODE_TABLE,
    NODE_TABLE_FIELD,
    NODE_VARARG
} NodeType;

typedef struct ASTNode ASTNode;

typedef struct {
    ASTNode** items;
    int count;
    int capacity;
} NodeList;

struct ASTNode {
    NodeType type;
    int line;
    
    union {
        // Number literal
        double number;
        
        // String/Name
        char* string;
        
        // Boolean
        int boolean;
        
        // Binary operation
        struct {
            char op[4];
            ASTNode* left;
            ASTNode* right;
        } binop;
        
        // Unary operation
        struct {
            char op[4];
            ASTNode* operand;
        } unop;
        
        // Local declaration
        struct {
            NodeList names;
            NodeList values;
        } local;
        
        // Assignment
        struct {
            NodeList targets;
            NodeList values;
        } assign;
        
        // If statement
        struct {
            ASTNode* condition;
            ASTNode* thenBlock;
            NodeList elseifs;
            ASTNode* elseBlock;
        } ifstmt;
        
        // While loop
        struct {
            ASTNode* condition;
            ASTNode* body;
        } whilestmt;
        
        // Numeric for
        struct {
            char* var;
            ASTNode* start;
            ASTNode* limit;
            ASTNode* step;
            ASTNode* body;
        } fornum;
        
        // Generic for
        struct {
            NodeList names;
            NodeList iterators;
            ASTNode* body;
        } forin;
        
        // Function call
        struct {
            ASTNode* func;
            NodeList args;
        } call;
        
        // Method call (obj:method(args))
        struct {
            ASTNode* object;
            char* method;
            NodeList args;
        } methodcall;
        
        // Index access (obj[key])
        struct {
            ASTNode* object;
            ASTNode* key;
        } index;
        
        // Dot access (obj.field)
        struct {
            ASTNode* object;
            char* field;
        } dotindex;
        
        // Function definition
        struct {
            char* name;
            NodeList params;
            int isVararg;
            ASTNode* body;
        } func;
        
        // Return statement
        struct {
            NodeList values;
        } ret;
        
        // Table constructor
        struct {
            NodeList fields;
        } table;
        
        // Table field
        struct {
            ASTNode* key;
            ASTNode* value;
        } field;
        
        // Block (list of statements)
        struct {
            NodeList statements;
        } block;
        
    } data;
};

typedef struct {
    Lexer* lexer;
    Token current;
    Token previous;
    int hadError;
    char errorMsg[256];
} Parser;

Parser* CreateParser(const char* source);
void FreeParser(Parser* parser);
ASTNode* Parse(Parser* parser);
void FreeAST(ASTNode* node);

// Helper functions
NodeList CreateNodeList();
void AddNode(NodeList* list, ASTNode* node);
void FreeNodeList(NodeList* list);

#endif
