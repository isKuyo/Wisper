#ifndef LEXER_H
#define LEXER_H

#include "Common.h"

typedef enum {
    // Literals
    TOK_NUMBER,
    TOK_STRING,
    TOK_NAME,
    TOK_TRUE,
    TOK_FALSE,
    TOK_NIL,
    
    // Keywords
    TOK_AND,
    TOK_BREAK,
    TOK_DO,
    TOK_ELSE,
    TOK_ELSEIF,
    TOK_END,
    TOK_FOR,
    TOK_FUNCTION,
    TOK_IF,
    TOK_IN,
    TOK_LOCAL,
    TOK_NOT,
    TOK_OR,
    TOK_REPEAT,
    TOK_RETURN,
    TOK_THEN,
    TOK_UNTIL,
    TOK_WHILE,
    
    // Operators
    TOK_PLUS,       // +
    TOK_MINUS,      // -
    TOK_STAR,       // *
    TOK_SLASH,      // /
    TOK_PERCENT,    // %
    TOK_CARET,      // ^
    TOK_HASH,       // #
    TOK_EQ,         // ==
    TOK_NE,         // ~=
    TOK_LE,         // <=
    TOK_GE,         // >=
    TOK_LT,         // <
    TOK_GT,         // >
    TOK_ASSIGN,     // =
    TOK_LPAREN,     // (
    TOK_RPAREN,     // )
    TOK_LBRACE,     // {
    TOK_RBRACE,     // }
    TOK_LBRACKET,   // [
    TOK_RBRACKET,   // ]
    TOK_SEMICOLON,  // ;
    TOK_COLON,      // :
    TOK_COMMA,      // ,
    TOK_DOT,        // .
    TOK_DOTDOT,     // ..
    TOK_DOTDOTDOT,  // ...
    
    TOK_EOF,
    TOK_ERROR
} TokenType;

typedef struct {
    TokenType type;
    char* value;
    int line;
    int column;
} Token;

typedef struct {
    char* source;
    int pos;
    int line;
    int column;
    int length;
    Token current;
} Lexer;

Lexer* CreateLexer(const char* source);
void FreeLexer(Lexer* lexer);
Token NextToken(Lexer* lexer);
Token PeekToken(Lexer* lexer);
const char* TokenTypeName(TokenType type);

#endif
