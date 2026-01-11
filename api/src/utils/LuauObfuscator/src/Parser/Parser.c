#include "../../include/Parser.h"
#include <stdlib.h>
#include <string.h>
#include <stdio.h>

static void advance(Parser* parser);
static ASTNode* parseExpression(Parser* parser);
static ASTNode* parseStatement(Parser* parser);
static ASTNode* parseBlock(Parser* parser);
static ASTNode* parsePrimaryExpr(Parser* parser);
static ASTNode* parseSuffixedExpr(Parser* parser);

NodeList CreateNodeList() {
    NodeList list;
    list.items = NULL;
    list.count = 0;
    list.capacity = 0;
    return list;
}

void AddNode(NodeList* list, ASTNode* node) {
    if (list->count >= list->capacity) {
        list->capacity = list->capacity == 0 ? 4 : list->capacity * 2;
        list->items = (ASTNode**)realloc(list->items, sizeof(ASTNode*) * list->capacity);
    }
    list->items[list->count++] = node;
}

void FreeNodeList(NodeList* list) {
    for (int i = 0; i < list->count; i++) {
        FreeAST(list->items[i]);
    }
    free(list->items);
    list->items = NULL;
    list->count = 0;
    list->capacity = 0;
}

static ASTNode* createNode(NodeType type, int line) {
    ASTNode* node = (ASTNode*)calloc(1, sizeof(ASTNode));
    node->type = type;
    node->line = line;
    return node;
}

Parser* CreateParser(const char* source) {
    Parser* parser = (Parser*)malloc(sizeof(Parser));
    parser->lexer = CreateLexer(source);
    parser->hadError = 0;
    parser->errorMsg[0] = '\0';
    advance(parser);
    return parser;
}

void FreeParser(Parser* parser) {
    if (parser) {
        FreeLexer(parser->lexer);
        free(parser);
    }
}

static void advance(Parser* parser) {
    parser->previous = parser->current;
    parser->current = NextToken(parser->lexer);
    
    if (parser->current.type == TOK_ERROR) {
        parser->hadError = 1;
        snprintf(parser->errorMsg, 256, "Line %d: %s", 
            parser->current.line, parser->current.value);
    }
}

static int check(Parser* parser, TokenType type) {
    return parser->current.type == type;
}

static int match(Parser* parser, TokenType type) {
    if (check(parser, type)) {
        advance(parser);
        return 1;
    }
    return 0;
}

static void expect(Parser* parser, TokenType type, const char* msg) {
    if (!match(parser, type)) {
        parser->hadError = 1;
        snprintf(parser->errorMsg, 256, "Line %d: Expected %s, got %s", 
            parser->current.line, msg, TokenTypeName(parser->current.type));
    }
}

void FreeAST(ASTNode* node) {
    if (!node) return;
    
    switch (node->type) {
        case NODE_STRING:
        case NODE_NAME:
            free(node->data.string);
            break;
        case NODE_BINOP:
            FreeAST(node->data.binop.left);
            FreeAST(node->data.binop.right);
            break;
        case NODE_UNOP:
            FreeAST(node->data.unop.operand);
            break;
        case NODE_LOCAL:
            FreeNodeList(&node->data.local.names);
            FreeNodeList(&node->data.local.values);
            break;
        case NODE_ASSIGN:
            FreeNodeList(&node->data.assign.targets);
            FreeNodeList(&node->data.assign.values);
            break;
        case NODE_CALL:
            FreeAST(node->data.call.func);
            FreeNodeList(&node->data.call.args);
            break;
        case NODE_METHOD_CALL:
            FreeAST(node->data.methodcall.object);
            free(node->data.methodcall.method);
            FreeNodeList(&node->data.methodcall.args);
            break;
        case NODE_INDEX:
            FreeAST(node->data.index.object);
            FreeAST(node->data.index.key);
            break;
        case NODE_DOT_INDEX:
            FreeAST(node->data.dotindex.object);
            free(node->data.dotindex.field);
            break;
        case NODE_IF:
            FreeAST(node->data.ifstmt.condition);
            FreeAST(node->data.ifstmt.thenBlock);
            FreeNodeList(&node->data.ifstmt.elseifs);
            FreeAST(node->data.ifstmt.elseBlock);
            break;
        case NODE_WHILE:
            FreeAST(node->data.whilestmt.condition);
            FreeAST(node->data.whilestmt.body);
            break;
        case NODE_FOR_NUM:
            free(node->data.fornum.var);
            FreeAST(node->data.fornum.start);
            FreeAST(node->data.fornum.limit);
            FreeAST(node->data.fornum.step);
            FreeAST(node->data.fornum.body);
            break;
        case NODE_FOR_IN:
            FreeNodeList(&node->data.forin.names);
            FreeNodeList(&node->data.forin.iterators);
            FreeAST(node->data.forin.body);
            break;
        case NODE_FUNCTION:
        case NODE_LOCAL_FUNCTION:
            free(node->data.func.name);
            FreeNodeList(&node->data.func.params);
            FreeAST(node->data.func.body);
            break;
        case NODE_RETURN:
            FreeNodeList(&node->data.ret.values);
            break;
        case NODE_TABLE:
            FreeNodeList(&node->data.table.fields);
            break;
        case NODE_TABLE_FIELD:
            FreeAST(node->data.field.key);
            FreeAST(node->data.field.value);
            break;
        case NODE_BLOCK:
        case NODE_CHUNK:
            FreeNodeList(&node->data.block.statements);
            break;
        default:
            break;
    }
    free(node);
}

static ASTNode* parseNumber(Parser* parser) {
    ASTNode* node = createNode(NODE_NUMBER, parser->previous.line);
    node->data.number = atof(parser->previous.value);
    return node;
}

static ASTNode* parseString(Parser* parser) {
    ASTNode* node = createNode(NODE_STRING, parser->previous.line);
    node->data.string = strdup(parser->previous.value);
    return node;
}

static ASTNode* parseName(Parser* parser) {
    ASTNode* node = createNode(NODE_NAME, parser->previous.line);
    node->data.string = strdup(parser->previous.value);
    return node;
}

static ASTNode* parseTableConstructor(Parser* parser) {
    ASTNode* node = createNode(NODE_TABLE, parser->previous.line);
    node->data.table.fields = CreateNodeList();
    
    int arrayIndex = 1;
    
    while (!check(parser, TOK_RBRACE) && !check(parser, TOK_EOF)) {
        ASTNode* field = createNode(NODE_TABLE_FIELD, parser->current.line);
        
        if (check(parser, TOK_LBRACKET)) {
            // [expr] = expr
            advance(parser);
            field->data.field.key = parseExpression(parser);
            expect(parser, TOK_RBRACKET, "]");
            expect(parser, TOK_ASSIGN, "=");
            field->data.field.value = parseExpression(parser);
        } else if (check(parser, TOK_NAME) && PeekToken(parser->lexer).type == TOK_ASSIGN) {
            // name = expr
            advance(parser);
            ASTNode* key = createNode(NODE_STRING, parser->previous.line);
            key->data.string = strdup(parser->previous.value);
            field->data.field.key = key;
            expect(parser, TOK_ASSIGN, "=");
            field->data.field.value = parseExpression(parser);
        } else {
            // Array element
            ASTNode* key = createNode(NODE_NUMBER, parser->current.line);
            key->data.number = arrayIndex++;
            field->data.field.key = key;
            field->data.field.value = parseExpression(parser);
        }
        
        AddNode(&node->data.table.fields, field);
        
        if (!match(parser, TOK_COMMA) && !match(parser, TOK_SEMICOLON)) {
            break;
        }
    }
    
    expect(parser, TOK_RBRACE, "}");
    return node;
}

static ASTNode* parseFunctionBody(Parser* parser) {
    expect(parser, TOK_LPAREN, "(");
    
    ASTNode* node = createNode(NODE_FUNCTION, parser->previous.line);
    node->data.func.name = NULL;
    node->data.func.params = CreateNodeList();
    node->data.func.isVararg = 0;
    
    // Parse parameters
    while (!check(parser, TOK_RPAREN) && !check(parser, TOK_EOF)) {
        if (match(parser, TOK_DOTDOTDOT)) {
            node->data.func.isVararg = 1;
            break;
        }
        
        expect(parser, TOK_NAME, "parameter name");
        ASTNode* param = createNode(NODE_NAME, parser->previous.line);
        param->data.string = strdup(parser->previous.value);
        AddNode(&node->data.func.params, param);
        
        if (!match(parser, TOK_COMMA)) break;
    }
    
    expect(parser, TOK_RPAREN, ")");
    node->data.func.body = parseBlock(parser);
    expect(parser, TOK_END, "end");
    
    return node;
}

static ASTNode* parsePrimaryExpr(Parser* parser) {
    if (check(parser, TOK_EOF)) {
        return createNode(NODE_NIL, parser->current.line);
    }
    
    if (match(parser, TOK_LPAREN)) {
        ASTNode* expr = parseExpression(parser);
        expect(parser, TOK_RPAREN, ")");
        return expr;
    }
    
    if (match(parser, TOK_NAME)) {
        return parseName(parser);
    }
    
    // Don't error on block-ending tokens
    if (check(parser, TOK_END) || check(parser, TOK_ELSE) || 
        check(parser, TOK_ELSEIF) || check(parser, TOK_UNTIL)) {
        return createNode(NODE_NIL, parser->current.line);
    }
    
    parser->hadError = 1;
    snprintf(parser->errorMsg, 256, "Line %d: Expected expression, got %s", 
        parser->current.line, TokenTypeName(parser->current.type));
    return createNode(NODE_NIL, parser->current.line);
}

static NodeList parseArgs(Parser* parser) {
    NodeList args = CreateNodeList();
    
    if (check(parser, TOK_STRING)) {
        advance(parser);
        AddNode(&args, parseString(parser));
        return args;
    }
    
    if (check(parser, TOK_LBRACE)) {
        advance(parser);
        AddNode(&args, parseTableConstructor(parser));
        return args;
    }
    
    expect(parser, TOK_LPAREN, "(");
    
    while (!check(parser, TOK_RPAREN) && !check(parser, TOK_EOF)) {
        AddNode(&args, parseExpression(parser));
        if (!match(parser, TOK_COMMA)) break;
    }
    
    expect(parser, TOK_RPAREN, ")");
    return args;
}

static ASTNode* parseSuffixedExpr(Parser* parser) {
    ASTNode* expr = parsePrimaryExpr(parser);
    
    while (1) {
        if (match(parser, TOK_DOT)) {
            expect(parser, TOK_NAME, "field name");
            ASTNode* newExpr = createNode(NODE_DOT_INDEX, parser->previous.line);
            newExpr->data.dotindex.object = expr;
            newExpr->data.dotindex.field = strdup(parser->previous.value);
            expr = newExpr;
        } else if (match(parser, TOK_LBRACKET)) {
            ASTNode* newExpr = createNode(NODE_INDEX, parser->current.line);
            newExpr->data.index.object = expr;
            newExpr->data.index.key = parseExpression(parser);
            expect(parser, TOK_RBRACKET, "]");
            expr = newExpr;
        } else if (match(parser, TOK_COLON)) {
            expect(parser, TOK_NAME, "method name");
            char* method = strdup(parser->previous.value);
            NodeList args = parseArgs(parser);
            
            ASTNode* newExpr = createNode(NODE_METHOD_CALL, parser->previous.line);
            newExpr->data.methodcall.object = expr;
            newExpr->data.methodcall.method = method;
            newExpr->data.methodcall.args = args;
            expr = newExpr;
        } else if (check(parser, TOK_LPAREN) || check(parser, TOK_STRING) || check(parser, TOK_LBRACE)) {
            NodeList args = parseArgs(parser);
            ASTNode* newExpr = createNode(NODE_CALL, parser->previous.line);
            newExpr->data.call.func = expr;
            newExpr->data.call.args = args;
            expr = newExpr;
        } else {
            break;
        }
    }
    
    return expr;
}

static ASTNode* parseSimpleExpr(Parser* parser) {
    if (match(parser, TOK_NUMBER)) return parseNumber(parser);
    if (match(parser, TOK_STRING)) return parseString(parser);
    if (match(parser, TOK_TRUE)) {
        ASTNode* node = createNode(NODE_BOOL, parser->previous.line);
        node->data.boolean = 1;
        return node;
    }
    if (match(parser, TOK_FALSE)) {
        ASTNode* node = createNode(NODE_BOOL, parser->previous.line);
        node->data.boolean = 0;
        return node;
    }
    if (match(parser, TOK_NIL)) return createNode(NODE_NIL, parser->previous.line);
    if (match(parser, TOK_DOTDOTDOT)) return createNode(NODE_VARARG, parser->previous.line);
    if (match(parser, TOK_LBRACE)) return parseTableConstructor(parser);
    if (match(parser, TOK_FUNCTION)) return parseFunctionBody(parser);
    
    return parseSuffixedExpr(parser);
}

static ASTNode* parseUnaryExpr(Parser* parser) {
    if (match(parser, TOK_NOT) || match(parser, TOK_MINUS) || match(parser, TOK_HASH)) {
        ASTNode* node = createNode(NODE_UNOP, parser->previous.line);
        strcpy(node->data.unop.op, parser->previous.value);
        node->data.unop.operand = parseUnaryExpr(parser);
        return node;
    }
    return parseSimpleExpr(parser);
}

static int getBinopPrecedence(TokenType type) {
    switch (type) {
        case TOK_OR: return 1;
        case TOK_AND: return 2;
        case TOK_LT: case TOK_GT: case TOK_LE: case TOK_GE: case TOK_NE: case TOK_EQ: return 3;
        case TOK_DOTDOT: return 4;
        case TOK_PLUS: case TOK_MINUS: return 5;
        case TOK_STAR: case TOK_SLASH: case TOK_PERCENT: return 6;
        case TOK_CARET: return 8;
        default: return 0;
    }
}

static ASTNode* parseBinopExpr(Parser* parser, int minPrec) {
    ASTNode* left = parseUnaryExpr(parser);
    
    while (1) {
        int prec = getBinopPrecedence(parser->current.type);
        if (prec < minPrec) break;
        
        Token op = parser->current;
        advance(parser);
        
        int nextPrec = prec;
        if (op.type == TOK_CARET || op.type == TOK_DOTDOT) {
            // Right associative
        } else {
            nextPrec = prec + 1;
        }
        
        ASTNode* right = parseBinopExpr(parser, nextPrec);
        
        ASTNode* node = createNode(NODE_BINOP, op.line);
        strcpy(node->data.binop.op, op.value);
        node->data.binop.left = left;
        node->data.binop.right = right;
        left = node;
    }
    
    return left;
}

static ASTNode* parseExpression(Parser* parser) {
    return parseBinopExpr(parser, 1);
}

static ASTNode* parseIfStatement(Parser* parser) {
    ASTNode* node = createNode(NODE_IF, parser->previous.line);
    node->data.ifstmt.condition = parseExpression(parser);
    expect(parser, TOK_THEN, "then");
    node->data.ifstmt.thenBlock = parseBlock(parser);
    node->data.ifstmt.elseifs = CreateNodeList();
    node->data.ifstmt.elseBlock = NULL;
    
    while (match(parser, TOK_ELSEIF)) {
        ASTNode* elseif = createNode(NODE_IF, parser->previous.line);
        elseif->data.ifstmt.condition = parseExpression(parser);
        expect(parser, TOK_THEN, "then");
        elseif->data.ifstmt.thenBlock = parseBlock(parser);
        elseif->data.ifstmt.elseifs = CreateNodeList();
        elseif->data.ifstmt.elseBlock = NULL;
        AddNode(&node->data.ifstmt.elseifs, elseif);
    }
    
    if (match(parser, TOK_ELSE)) {
        node->data.ifstmt.elseBlock = parseBlock(parser);
    }
    
    expect(parser, TOK_END, "end");
    return node;
}

static ASTNode* parseWhileStatement(Parser* parser) {
    ASTNode* node = createNode(NODE_WHILE, parser->previous.line);
    node->data.whilestmt.condition = parseExpression(parser);
    expect(parser, TOK_DO, "do");
    node->data.whilestmt.body = parseBlock(parser);
    expect(parser, TOK_END, "end");
    return node;
}

static ASTNode* parseForStatement(Parser* parser) {
    expect(parser, TOK_NAME, "variable name");
    char* firstName = strdup(parser->previous.value);
    
    if (match(parser, TOK_ASSIGN)) {
        // Numeric for
        ASTNode* node = createNode(NODE_FOR_NUM, parser->previous.line);
        node->data.fornum.var = firstName;
        node->data.fornum.start = parseExpression(parser);
        expect(parser, TOK_COMMA, ",");
        node->data.fornum.limit = parseExpression(parser);
        
        if (match(parser, TOK_COMMA)) {
            node->data.fornum.step = parseExpression(parser);
        } else {
            ASTNode* one = createNode(NODE_NUMBER, parser->current.line);
            one->data.number = 1;
            node->data.fornum.step = one;
        }
        
        expect(parser, TOK_DO, "do");
        node->data.fornum.body = parseBlock(parser);
        expect(parser, TOK_END, "end");
        return node;
    } else {
        // Generic for
        ASTNode* node = createNode(NODE_FOR_IN, parser->previous.line);
        node->data.forin.names = CreateNodeList();
        node->data.forin.iterators = CreateNodeList();
        
        ASTNode* nameNode = createNode(NODE_NAME, parser->previous.line);
        nameNode->data.string = firstName;
        AddNode(&node->data.forin.names, nameNode);
        
        while (match(parser, TOK_COMMA)) {
            expect(parser, TOK_NAME, "variable name");
            ASTNode* n = createNode(NODE_NAME, parser->previous.line);
            n->data.string = strdup(parser->previous.value);
            AddNode(&node->data.forin.names, n);
        }
        
        expect(parser, TOK_IN, "in");
        
        AddNode(&node->data.forin.iterators, parseExpression(parser));
        while (match(parser, TOK_COMMA)) {
            AddNode(&node->data.forin.iterators, parseExpression(parser));
        }
        
        expect(parser, TOK_DO, "do");
        node->data.forin.body = parseBlock(parser);
        expect(parser, TOK_END, "end");
        return node;
    }
}

static ASTNode* parseRepeatStatement(Parser* parser) {
    ASTNode* node = createNode(NODE_WHILE, parser->previous.line); // Reuse while node
    node->data.whilestmt.body = parseBlock(parser);
    expect(parser, TOK_UNTIL, "until");
    
    // Negate condition for repeat-until
    ASTNode* cond = parseExpression(parser);
    ASTNode* notNode = createNode(NODE_UNOP, cond->line);
    strcpy(notNode->data.unop.op, "not");
    notNode->data.unop.operand = cond;
    node->data.whilestmt.condition = notNode;
    
    return node;
}

static ASTNode* parseFunctionStatement(Parser* parser, int isLocal) {
    ASTNode* node = createNode(isLocal ? NODE_LOCAL_FUNCTION : NODE_FUNCTION, parser->previous.line);
    
    expect(parser, TOK_NAME, "function name");
    node->data.func.name = strdup(parser->previous.value);
    
    // Handle method syntax: function obj:method()
    while (match(parser, TOK_DOT)) {
        expect(parser, TOK_NAME, "field name");
        char* newName = (char*)malloc(strlen(node->data.func.name) + strlen(parser->previous.value) + 2);
        sprintf(newName, "%s.%s", node->data.func.name, parser->previous.value);
        free(node->data.func.name);
        node->data.func.name = newName;
    }
    
    if (match(parser, TOK_COLON)) {
        expect(parser, TOK_NAME, "method name");
        char* newName = (char*)malloc(strlen(node->data.func.name) + strlen(parser->previous.value) + 2);
        sprintf(newName, "%s:%s", node->data.func.name, parser->previous.value);
        free(node->data.func.name);
        node->data.func.name = newName;
    }
    
    expect(parser, TOK_LPAREN, "(");
    node->data.func.params = CreateNodeList();
    node->data.func.isVararg = 0;
    
    while (!check(parser, TOK_RPAREN) && !check(parser, TOK_EOF)) {
        if (match(parser, TOK_DOTDOTDOT)) {
            node->data.func.isVararg = 1;
            break;
        }
        expect(parser, TOK_NAME, "parameter name");
        ASTNode* param = createNode(NODE_NAME, parser->previous.line);
        param->data.string = strdup(parser->previous.value);
        AddNode(&node->data.func.params, param);
        if (!match(parser, TOK_COMMA)) break;
    }
    
    expect(parser, TOK_RPAREN, ")");
    node->data.func.body = parseBlock(parser);
    expect(parser, TOK_END, "end");
    
    return node;
}

static ASTNode* parseLocalStatement(Parser* parser) {
    if (match(parser, TOK_FUNCTION)) {
        return parseFunctionStatement(parser, 1);
    }
    
    ASTNode* node = createNode(NODE_LOCAL, parser->previous.line);
    node->data.local.names = CreateNodeList();
    node->data.local.values = CreateNodeList();
    
    do {
        expect(parser, TOK_NAME, "variable name");
        ASTNode* name = createNode(NODE_NAME, parser->previous.line);
        name->data.string = strdup(parser->previous.value);
        AddNode(&node->data.local.names, name);
    } while (match(parser, TOK_COMMA));
    
    if (match(parser, TOK_ASSIGN)) {
        do {
            AddNode(&node->data.local.values, parseExpression(parser));
        } while (match(parser, TOK_COMMA));
    }
    
    return node;
}

static ASTNode* parseReturnStatement(Parser* parser) {
    ASTNode* node = createNode(NODE_RETURN, parser->previous.line);
    node->data.ret.values = CreateNodeList();
    
    if (!check(parser, TOK_END) && !check(parser, TOK_ELSE) && 
        !check(parser, TOK_ELSEIF) && !check(parser, TOK_UNTIL) && !check(parser, TOK_EOF)) {
        do {
            AddNode(&node->data.ret.values, parseExpression(parser));
        } while (match(parser, TOK_COMMA));
    }
    
    return node;
}

static ASTNode* parseStatement(Parser* parser) {
    if (check(parser, TOK_EOF)) return NULL;
    if (match(parser, TOK_SEMICOLON)) return NULL;
    if (match(parser, TOK_IF)) return parseIfStatement(parser);
    if (match(parser, TOK_WHILE)) return parseWhileStatement(parser);
    if (match(parser, TOK_FOR)) return parseForStatement(parser);
    if (match(parser, TOK_REPEAT)) return parseRepeatStatement(parser);
    if (match(parser, TOK_FUNCTION)) return parseFunctionStatement(parser, 0);
    if (match(parser, TOK_LOCAL)) return parseLocalStatement(parser);
    if (match(parser, TOK_RETURN)) return parseReturnStatement(parser);
    if (match(parser, TOK_BREAK)) return createNode(NODE_BREAK, parser->previous.line);
    if (match(parser, TOK_DO)) {
        ASTNode* block = parseBlock(parser);
        expect(parser, TOK_END, "end");
        return block;
    }
    
    // Check for EOF or block-ending tokens
    if (check(parser, TOK_EOF) || check(parser, TOK_END) || check(parser, TOK_ELSE) || 
        check(parser, TOK_ELSEIF) || check(parser, TOK_UNTIL)) {
        return NULL;
    }
    
    // Only names can start expression statements (function calls or assignments)
    if (!check(parser, TOK_NAME) && !check(parser, TOK_LPAREN)) {
        return NULL;
    }
    
    // Expression statement or assignment
    ASTNode* expr = parseSuffixedExpr(parser);
    
    if (match(parser, TOK_ASSIGN) || match(parser, TOK_COMMA)) {
        // Assignment
        ASTNode* node = createNode(NODE_ASSIGN, expr->line);
        node->data.assign.targets = CreateNodeList();
        node->data.assign.values = CreateNodeList();
        
        AddNode(&node->data.assign.targets, expr);
        
        while (parser->previous.type == TOK_COMMA) {
            AddNode(&node->data.assign.targets, parseSuffixedExpr(parser));
            if (!match(parser, TOK_COMMA)) break;
        }
        
        if (parser->previous.type != TOK_ASSIGN) {
            expect(parser, TOK_ASSIGN, "=");
        }
        
        do {
            AddNode(&node->data.assign.values, parseExpression(parser));
        } while (match(parser, TOK_COMMA));
        
        return node;
    }
    
    // Just an expression (function call)
    return expr;
}

static ASTNode* parseBlock(Parser* parser) {
    ASTNode* block = createNode(NODE_BLOCK, parser->current.line);
    block->data.block.statements = CreateNodeList();
    
    while (!check(parser, TOK_END) && !check(parser, TOK_ELSE) && 
           !check(parser, TOK_ELSEIF) && !check(parser, TOK_UNTIL) && !check(parser, TOK_EOF)) {
        ASTNode* stmt = parseStatement(parser);
        if (stmt) AddNode(&block->data.block.statements, stmt);
        match(parser, TOK_SEMICOLON);
    }
    
    return block;
}

ASTNode* Parse(Parser* parser) {
    ASTNode* chunk = createNode(NODE_CHUNK, 1);
    chunk->data.block.statements = CreateNodeList();
    
    while (!check(parser, TOK_EOF) && !parser->hadError) {
        ASTNode* stmt = parseStatement(parser);
        if (stmt) {
            AddNode(&chunk->data.block.statements, stmt);
        } else if (!check(parser, TOK_EOF)) {
            // If no statement and not EOF, skip unknown token
            if (!parser->hadError) {
                advance(parser);
            }
        }
        match(parser, TOK_SEMICOLON);
    }
    
    if (parser->hadError) {
        fprintf(stderr, "[PARSER ERROR] %s\n", parser->errorMsg);
    }
    
    return chunk;
}
