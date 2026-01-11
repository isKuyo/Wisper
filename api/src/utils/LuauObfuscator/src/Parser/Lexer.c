#include "../../include/Lexer.h"
#include <ctype.h>
#include <string.h>
#include <stdlib.h>

static const char* keywords[] = {
    "and", "break", "do", "else", "elseif", "end", "false", "for",
    "function", "if", "in", "local", "nil", "not", "or", "repeat",
    "return", "then", "true", "until", "while", NULL
};

static TokenType keywordTypes[] = {
    TOK_AND, TOK_BREAK, TOK_DO, TOK_ELSE, TOK_ELSEIF, TOK_END, TOK_FALSE, TOK_FOR,
    TOK_FUNCTION, TOK_IF, TOK_IN, TOK_LOCAL, TOK_NIL, TOK_NOT, TOK_OR, TOK_REPEAT,
    TOK_RETURN, TOK_THEN, TOK_TRUE, TOK_UNTIL, TOK_WHILE
};

Lexer* CreateLexer(const char* source) {
    Lexer* lexer = (Lexer*)malloc(sizeof(Lexer));
    lexer->source = strdup(source);
    lexer->pos = 0;
    lexer->line = 1;
    lexer->column = 1;
    lexer->length = strlen(source);
    lexer->current.type = TOK_EOF;
    lexer->current.value = NULL;
    return lexer;
}

void FreeLexer(Lexer* lexer) {
    if (lexer) {
        free(lexer->source);
        if (lexer->current.value) free(lexer->current.value);
        free(lexer);
    }
}

static char peek(Lexer* lexer) {
    if (lexer->pos >= lexer->length) return '\0';
    return lexer->source[lexer->pos];
}

static char peekNext(Lexer* lexer) {
    if (lexer->pos + 1 >= lexer->length) return '\0';
    return lexer->source[lexer->pos + 1];
}

static char advance(Lexer* lexer) {
    char c = lexer->source[lexer->pos++];
    if (c == '\n') {
        lexer->line++;
        lexer->column = 1;
    } else {
        lexer->column++;
    }
    return c;
}

static void skipWhitespace(Lexer* lexer) {
    while (1) {
        char c = peek(lexer);
        if (c == ' ' || c == '\t' || c == '\r' || c == '\n' || c == '\f' || c == '\v') {
            advance(lexer);
        } else if (c == '-' && peekNext(lexer) == '-') {
            // Comment
            advance(lexer); advance(lexer);
            if (peek(lexer) == '[' && peekNext(lexer) == '[') {
                // Long comment
                advance(lexer); advance(lexer);
                while (!(peek(lexer) == ']' && peekNext(lexer) == ']') && peek(lexer) != '\0') {
                    advance(lexer);
                }
                if (peek(lexer) != '\0') { advance(lexer); advance(lexer); }
            } else {
                // Line comment
                while (peek(lexer) != '\n' && peek(lexer) != '\0') {
                    advance(lexer);
                }
            }
        } else {
            break;
        }
    }
}

static Token makeToken(Lexer* lexer, TokenType type, const char* value) {
    Token token;
    token.type = type;
    token.value = value ? strdup(value) : NULL;
    token.line = lexer->line;
    token.column = lexer->column;
    return token;
}

static Token errorToken(Lexer* lexer, const char* msg) {
    Token token;
    token.type = TOK_ERROR;
    token.value = strdup(msg);
    token.line = lexer->line;
    token.column = lexer->column;
    return token;
}

static Token readString(Lexer* lexer, char quote) {
    int start = lexer->pos;
    while (peek(lexer) != quote && peek(lexer) != '\0') {
        if (peek(lexer) == '\\') advance(lexer); // Skip escape
        advance(lexer);
    }
    
    if (peek(lexer) == '\0') {
        return errorToken(lexer, "Unterminated string");
    }
    
    int len = lexer->pos - start;
    char* value = (char*)malloc(len + 1);
    strncpy(value, lexer->source + start, len);
    value[len] = '\0';
    
    advance(lexer); // Closing quote
    
    Token token = makeToken(lexer, TOK_STRING, value);
    free(value);
    return token;
}

static Token readLongString(Lexer* lexer) {
    // Count = signs
    int eqCount = 0;
    while (peek(lexer) == '=') { advance(lexer); eqCount++; }
    if (peek(lexer) != '[') return errorToken(lexer, "Invalid long string");
    advance(lexer);
    
    // Skip initial newline
    if (peek(lexer) == '\n') advance(lexer);
    
    int start = lexer->pos;
    
    // Find closing ]=*]
    while (peek(lexer) != '\0') {
        if (peek(lexer) == ']') {
            int endPos = lexer->pos;
            advance(lexer);
            int eq = 0;
            while (peek(lexer) == '=' && eq < eqCount) { advance(lexer); eq++; }
            if (eq == eqCount && peek(lexer) == ']') {
                advance(lexer);
                int len = endPos - start;
                char* value = (char*)malloc(len + 1);
                strncpy(value, lexer->source + start, len);
                value[len] = '\0';
                Token token = makeToken(lexer, TOK_STRING, value);
                free(value);
                return token;
            }
        } else {
            advance(lexer);
        }
    }
    
    return errorToken(lexer, "Unterminated long string");
}

static Token readNumber(Lexer* lexer) {
    int start = lexer->pos - 1; // Already consumed first digit
    
    // Hex number
    if (lexer->source[start] == '0' && (peek(lexer) == 'x' || peek(lexer) == 'X')) {
        advance(lexer);
        while (isxdigit(peek(lexer))) advance(lexer);
    } else {
        while (isdigit(peek(lexer))) advance(lexer);
        if (peek(lexer) == '.' && isdigit(peekNext(lexer))) {
            advance(lexer);
            while (isdigit(peek(lexer))) advance(lexer);
        }
        if (peek(lexer) == 'e' || peek(lexer) == 'E') {
            advance(lexer);
            if (peek(lexer) == '+' || peek(lexer) == '-') advance(lexer);
            while (isdigit(peek(lexer))) advance(lexer);
        }
    }
    
    int len = lexer->pos - start;
    char* value = (char*)malloc(len + 1);
    strncpy(value, lexer->source + start, len);
    value[len] = '\0';
    
    Token token = makeToken(lexer, TOK_NUMBER, value);
    free(value);
    return token;
}

static Token readName(Lexer* lexer) {
    int start = lexer->pos - 1;
    while (isalnum(peek(lexer)) || peek(lexer) == '_') advance(lexer);
    
    int len = lexer->pos - start;
    char* value = (char*)malloc(len + 1);
    strncpy(value, lexer->source + start, len);
    value[len] = '\0';
    
    // Check for keyword
    TokenType type = TOK_NAME;
    for (int i = 0; keywords[i] != NULL; i++) {
        if (strcmp(value, keywords[i]) == 0) {
            type = keywordTypes[i];
            break;
        }
    }
    
    Token token = makeToken(lexer, type, value);
    free(value);
    return token;
}

Token NextToken(Lexer* lexer) {
    skipWhitespace(lexer);
    
    if (lexer->pos >= lexer->length) {
        return makeToken(lexer, TOK_EOF, NULL);
    }
    
    char c = advance(lexer);
    
    // Names and keywords
    if (isalpha(c) || c == '_') return readName(lexer);
    
    // Numbers
    if (isdigit(c)) return readNumber(lexer);
    
    // Strings
    if (c == '"' || c == '\'') return readString(lexer, c);
    
    // Long strings
    if (c == '[' && (peek(lexer) == '[' || peek(lexer) == '=')) {
        return readLongString(lexer);
    }
    
    // Operators and punctuation
    switch (c) {
        case '+': return makeToken(lexer, TOK_PLUS, "+");
        case '-': return makeToken(lexer, TOK_MINUS, "-");
        case '*': return makeToken(lexer, TOK_STAR, "*");
        case '/': return makeToken(lexer, TOK_SLASH, "/");
        case '%': return makeToken(lexer, TOK_PERCENT, "%");
        case '^': return makeToken(lexer, TOK_CARET, "^");
        case '#': return makeToken(lexer, TOK_HASH, "#");
        case '(': return makeToken(lexer, TOK_LPAREN, "(");
        case ')': return makeToken(lexer, TOK_RPAREN, ")");
        case '{': return makeToken(lexer, TOK_LBRACE, "{");
        case '}': return makeToken(lexer, TOK_RBRACE, "}");
        case '[': return makeToken(lexer, TOK_LBRACKET, "[");
        case ']': return makeToken(lexer, TOK_RBRACKET, "]");
        case ';': return makeToken(lexer, TOK_SEMICOLON, ";");
        case ':': return makeToken(lexer, TOK_COLON, ":");
        case ',': return makeToken(lexer, TOK_COMMA, ",");
        case '.':
            if (peek(lexer) == '.') {
                advance(lexer);
                if (peek(lexer) == '.') {
                    advance(lexer);
                    return makeToken(lexer, TOK_DOTDOTDOT, "...");
                }
                return makeToken(lexer, TOK_DOTDOT, "..");
            }
            return makeToken(lexer, TOK_DOT, ".");
        case '=':
            if (peek(lexer) == '=') { advance(lexer); return makeToken(lexer, TOK_EQ, "=="); }
            return makeToken(lexer, TOK_ASSIGN, "=");
        case '<':
            if (peek(lexer) == '=') { advance(lexer); return makeToken(lexer, TOK_LE, "<="); }
            return makeToken(lexer, TOK_LT, "<");
        case '>':
            if (peek(lexer) == '=') { advance(lexer); return makeToken(lexer, TOK_GE, ">="); }
            return makeToken(lexer, TOK_GT, ">");
        case '~':
            if (peek(lexer) == '=') { advance(lexer); return makeToken(lexer, TOK_NE, "~="); }
            return errorToken(lexer, "Unexpected character '~'");
    }
    
    return errorToken(lexer, "Unexpected character");
}

Token PeekToken(Lexer* lexer) {
    int savedPos = lexer->pos;
    int savedLine = lexer->line;
    int savedCol = lexer->column;
    
    Token token = NextToken(lexer);
    
    lexer->pos = savedPos;
    lexer->line = savedLine;
    lexer->column = savedCol;
    
    return token;
}

const char* TokenTypeName(TokenType type) {
    switch (type) {
        case TOK_NUMBER: return "number";
        case TOK_STRING: return "string";
        case TOK_NAME: return "name";
        case TOK_TRUE: return "true";
        case TOK_FALSE: return "false";
        case TOK_NIL: return "nil";
        case TOK_AND: return "and";
        case TOK_OR: return "or";
        case TOK_NOT: return "not";
        case TOK_IF: return "if";
        case TOK_THEN: return "then";
        case TOK_ELSE: return "else";
        case TOK_ELSEIF: return "elseif";
        case TOK_END: return "end";
        case TOK_WHILE: return "while";
        case TOK_DO: return "do";
        case TOK_FOR: return "for";
        case TOK_IN: return "in";
        case TOK_REPEAT: return "repeat";
        case TOK_UNTIL: return "until";
        case TOK_FUNCTION: return "function";
        case TOK_LOCAL: return "local";
        case TOK_RETURN: return "return";
        case TOK_BREAK: return "break";
        case TOK_EOF: return "EOF";
        case TOK_ERROR: return "error";
        default: return "token";
    }
}
