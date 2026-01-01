/**
 * Wisper Hub Obfuscator - Control Flow Module
 * Control flow flattening and obfuscation
 */

const { randomInt, randomChoice, obfuscateNumber } = require('./core');

// ═══════════════════════════════════════════════════════════════════════════
// OPAQUE PREDICATES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate opaque predicate (always true)
 */
function opaqueTrue(vars) {
  const predicates = [
    () => `(${vars.x}*${vars.x}>=0)`,
    () => `(${vars.x}==${vars.x})`,
    () => `(type(${vars.x})~="nil" or true)`,
    () => `(1>0)`,
    () => `(${obfuscateNumber(randomInt(1, 100))}>${obfuscateNumber(0)})`,
    () => `(not not true)`,
    () => `(${vars.x} and true or true)`,
    () => `((${vars.x} or 0)+1>0)`
  ];
  return randomChoice(predicates)();
}

/**
 * Generate opaque predicate (always false)
 */
function opaqueFalse(vars) {
  const predicates = [
    () => `(${vars.x}~=${vars.x})`,
    () => `(type(nil)=="number")`,
    () => `(1<0)`,
    () => `(${obfuscateNumber(0)}>${obfuscateNumber(100)})`,
    () => `(not true)`,
    () => `(false and true)`,
    () => `(${vars.x}==nil and ${vars.x}~=nil)`
  ];
  return randomChoice(predicates)();
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTROL FLOW FLATTENING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate state machine wrapper
 */
function generateStateMachine(blocks, vars) {
  // Shuffle block order
  const shuffledIndices = [];
  for (let i = 0; i < blocks.length; i++) {
    shuffledIndices.push(i);
  }
  for (let i = shuffledIndices.length - 1; i > 0; i--) {
    const j = randomInt(0, i);
    [shuffledIndices[i], shuffledIndices[j]] = [shuffledIndices[j], shuffledIndices[i]];
  }
  
  // Create state mapping
  const stateMap = {};
  shuffledIndices.forEach((originalIdx, newIdx) => {
    stateMap[originalIdx] = randomInt(1000, 9999);
  });
  stateMap[blocks.length] = 0; // Exit state
  
  let code = `local ${vars.state}=${obfuscateNumber(stateMap[0])}\n`;
  code += `while ${vars.state}~=0 do\n`;
  
  // Generate switch-case
  shuffledIndices.forEach((originalIdx) => {
    const stateNum = stateMap[originalIdx];
    const nextState = stateMap[originalIdx + 1];
    
    code += `if ${vars.state}==${obfuscateNumber(stateNum)} then\n`;
    code += blocks[originalIdx] + '\n';
    code += `${vars.state}=${obfuscateNumber(nextState)}\n`;
    code += `else`;
  });
  
  // Close all elseifs
  code += ` end`;
  for (let i = 1; i < blocks.length; i++) {
    code += ` end`;
  }
  code += `\nend`;
  
  return code;
}

// ═══════════════════════════════════════════════════════════════════════════
// DEAD CODE BRANCHES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Wrap code with dead branch
 */
function wrapWithDeadBranch(code, vars) {
  const deadCode = generateDeadCode(vars);
  
  if (Math.random() > 0.5) {
    // Dead code first
    return `if ${opaqueFalse(vars)} then\n${deadCode}\nelse\n${code}\nend`;
  } else {
    // Dead code second
    return `if ${opaqueTrue(vars)} then\n${code}\nelse\n${deadCode}\nend`;
  }
}

/**
 * Generate dead code that looks real
 */
function generateDeadCode(vars) {
  const templates = [
    () => `local ${vars.dead1}=${obfuscateNumber(randomInt(1, 1000))}\n${vars.dead1}=${vars.dead1}*2`,
    () => `for ${vars.dead1}=1,0 do end`,
    () => `if false then error("unreachable") end`,
    () => `local ${vars.dead1}={}\nfor ${vars.dead2}=1,0 do ${vars.dead1}[${vars.dead2}]=0 end`,
    () => `local ${vars.dead1}=function()return nil end`,
    () => `while false do break end`,
    () => `repeat break until true`
  ];
  
  return randomChoice(templates)();
}

// ═══════════════════════════════════════════════════════════════════════════
// LOOP OBFUSCATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Convert for loop to while loop
 */
function forToWhile(init, limit, step, body, vars) {
  return `local ${vars.i}=${init}
while ${vars.i}<=${limit} do
${body}
${vars.i}=${vars.i}+${step}
end`;
}

/**
 * Add fake iterations
 */
function addFakeIterations(loopBody, vars) {
  const fakeCheck = `if ${opaqueFalse(vars)} then break end\n`;
  return fakeCheck + loopBody;
}

module.exports = {
  opaqueTrue,
  opaqueFalse,
  generateStateMachine,
  wrapWithDeadBranch,
  generateDeadCode,
  forToWhile,
  addFakeIterations
};
