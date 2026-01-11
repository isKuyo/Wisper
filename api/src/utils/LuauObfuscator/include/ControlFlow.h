#ifndef CONTROL_FLOW_H
#define CONTROL_FLOW_H

#include "Common.h"

// ============================================
// AGGRESSIVE CONTROL FLOW MODULE
// ============================================

#define MAX_STATES 128
#define MAX_TRANSITIONS 256

// State types for flattening
typedef enum {
    STATE_REAL,
    STATE_FAKE,
    STATE_REDIRECT,
    STATE_ENCRYPTED,
    STATE_COMPUTED
} StateType;

// State node
typedef struct {
    int id;
    StateType type;
    int nextReal;       // Real next state
    int nextFake;       // Fake transition
    int condition;      // Condition type
    unsigned int stateKey;  // Encrypted state value
} StateNode;

// Control flow context
typedef struct {
    StateNode states[MAX_STATES];
    int stateCount;
    int entryState;
    int exitState;
    int dispatcherVariant;  // Which dispatcher style
    unsigned int stateXorKey;
    int redundantJumps;
    int fakeLoops;
} ControlFlowContext;

// Function declarations
ControlFlowContext* CreateControlFlowContext();
void AddState(ControlFlowContext* ctx, StateType type, int nextReal);
void InsertFakeStates(ControlFlowContext* ctx, int count);
void InsertRedundantJumps(ControlFlowContext* ctx, int count);
void EncryptStateTransitions(ControlFlowContext* ctx, unsigned int key);
char* GenerateCFDispatcher(ControlFlowContext* ctx, int variant);
char* GenerateStateDecryptor(ControlFlowContext* ctx);
void FreeControlFlowContext(ControlFlowContext* ctx);

#endif
