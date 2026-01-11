#ifndef POLYMORPHIC_H
#define POLYMORPHIC_H

#include "Common.h"

// ============================================
// POLYMORPHIC FUNCTIONS MODULE
// ============================================

#define MAX_VARIANTS 5
#define MAX_TEMPLATES 50

// Template types
typedef enum {
    TMPL_DECODER,
    TMPL_DISPATCHER,
    TMPL_LOADER,
    TMPL_CHECKER,
    TMPL_DUMMY
} TemplateType;

// Code template
typedef struct {
    TemplateType type;
    char* variants[MAX_VARIANTS];
    int variantCount;
    int argOrder[8];  // Argument order shuffling
} CodeTemplate;

// Polymorphic context
typedef struct {
    CodeTemplate templates[MAX_TEMPLATES];
    int templateCount;
    int buildSeed;
    int variantChoices[MAX_TEMPLATES];
} PolymorphicContext;

// Function declarations
PolymorphicContext* CreatePolymorphicContext(int seed);
void AddTemplate(PolymorphicContext* ctx, TemplateType type, const char* code);
char* GetRandomVariant(PolymorphicContext* ctx, TemplateType type);
char* ShuffleArguments(PolymorphicContext* ctx, const char* code);
char* GeneratePolymorphicFunction(PolymorphicContext* ctx, TemplateType type);
void FreePolymorphicContext(PolymorphicContext* ctx);

#endif
