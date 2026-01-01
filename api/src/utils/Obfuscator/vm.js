/**
 * Wisper Hub Obfuscator - Virtual Machine Module
 * Custom bytecode VM for code execution
 */

const { randomInt, obfuscateNumber, NameGenerator } = require('./core');

// ═══════════════════════════════════════════════════════════════════════════
// VM OPCODES
// ═══════════════════════════════════════════════════════════════════════════

const OPCODES = {
  NOP: 0x00,
  LOAD_CONST: 0x01,
  LOAD_VAR: 0x02,
  STORE_VAR: 0x03,
  ADD: 0x04,
  SUB: 0x05,
  MUL: 0x06,
  DIV: 0x07,
  CALL: 0x08,
  RETURN: 0x09,
  JUMP: 0x0A,
  JUMP_IF: 0x0B,
  JUMP_NOT: 0x0C,
  PUSH: 0x0D,
  POP: 0x0E,
  DUP: 0x0F,
  EXEC: 0x10,
  CONCAT: 0x11,
  INDEX: 0x12,
  NEWINDEX: 0x13,
  EQ: 0x14,
  LT: 0x15,
  LE: 0x16,
  NOT: 0x17,
  AND: 0x18,
  OR: 0x19,
  HALT: 0xFF
};

// ═══════════════════════════════════════════════════════════════════════════
// VM GENERATOR
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate the VM runtime in Lua
 */
function generateVMRuntime(vars) {
  // Shuffle opcodes for this instance
  const opcodeMap = {};
  const usedCodes = new Set();
  
  Object.entries(OPCODES).forEach(([name, code]) => {
    let newCode;
    do {
      newCode = randomInt(0, 255);
    } while (usedCodes.has(newCode));
    usedCodes.add(newCode);
    opcodeMap[name] = newCode;
  });

  return `
local ${vars.vm}={}
${vars.vm}.OP={
NOP=${obfuscateNumber(opcodeMap.NOP)},
LOAD=${obfuscateNumber(opcodeMap.LOAD_CONST)},
STORE=${obfuscateNumber(opcodeMap.STORE_VAR)},
ADD=${obfuscateNumber(opcodeMap.ADD)},
SUB=${obfuscateNumber(opcodeMap.SUB)},
MUL=${obfuscateNumber(opcodeMap.MUL)},
DIV=${obfuscateNumber(opcodeMap.DIV)},
CALL=${obfuscateNumber(opcodeMap.CALL)},
RET=${obfuscateNumber(opcodeMap.RETURN)},
JMP=${obfuscateNumber(opcodeMap.JUMP)},
JMPT=${obfuscateNumber(opcodeMap.JUMP_IF)},
JMPF=${obfuscateNumber(opcodeMap.JUMP_NOT)},
PUSH=${obfuscateNumber(opcodeMap.PUSH)},
POP=${obfuscateNumber(opcodeMap.POP)},
EXEC=${obfuscateNumber(opcodeMap.EXEC)},
HALT=${obfuscateNumber(opcodeMap.HALT)}
}
${vars.vm}.stack={}
${vars.vm}.vars={}
${vars.vm}.pc=1
${vars.vm}.push=function(${vars.v})
${vars.vm}.stack[#${vars.vm}.stack+1]=${vars.v}
end
${vars.vm}.pop=function()
local ${vars.v}=${vars.vm}.stack[#${vars.vm}.stack]
${vars.vm}.stack[#${vars.vm}.stack]=nil
return ${vars.v}
end
${vars.vm}.run=function(${vars.bytecode},${vars.consts})
${vars.vm}.pc=1
${vars.vm}.stack={}
while ${vars.vm}.pc<=#${vars.bytecode} do
local ${vars.op}=${vars.bytecode}[${vars.vm}.pc]
if ${vars.op}==${vars.vm}.OP.HALT then
break
elseif ${vars.op}==${vars.vm}.OP.LOAD then
${vars.vm}.pc=${vars.vm}.pc+1
local ${vars.idx}=${vars.bytecode}[${vars.vm}.pc]
${vars.vm}.push(${vars.consts}[${vars.idx}])
elseif ${vars.op}==${vars.vm}.OP.STORE then
${vars.vm}.pc=${vars.vm}.pc+1
local ${vars.idx}=${vars.bytecode}[${vars.vm}.pc]
${vars.vm}.vars[${vars.idx}]=${vars.vm}.pop()
elseif ${vars.op}==${vars.vm}.OP.ADD then
local ${vars.b}=${vars.vm}.pop()
local ${vars.a}=${vars.vm}.pop()
${vars.vm}.push(${vars.a}+${vars.b})
elseif ${vars.op}==${vars.vm}.OP.SUB then
local ${vars.b}=${vars.vm}.pop()
local ${vars.a}=${vars.vm}.pop()
${vars.vm}.push(${vars.a}-${vars.b})
elseif ${vars.op}==${vars.vm}.OP.MUL then
local ${vars.b}=${vars.vm}.pop()
local ${vars.a}=${vars.vm}.pop()
${vars.vm}.push(${vars.a}*${vars.b})
elseif ${vars.op}==${vars.vm}.OP.DIV then
local ${vars.b}=${vars.vm}.pop()
local ${vars.a}=${vars.vm}.pop()
${vars.vm}.push(${vars.a}/${vars.b})
elseif ${vars.op}==${vars.vm}.OP.EXEC then
local ${vars.code}=${vars.vm}.pop()
local ${vars.fn}=(loadstring or load)(${vars.code})
if ${vars.fn} then
local ${vars.ok},${vars.res}=pcall(${vars.fn})
${vars.vm}.push(${vars.res})
end
elseif ${vars.op}==${vars.vm}.OP.JMP then
${vars.vm}.pc=${vars.vm}.pc+1
${vars.vm}.pc=${vars.bytecode}[${vars.vm}.pc]
goto continue
elseif ${vars.op}==${vars.vm}.OP.JMPT then
${vars.vm}.pc=${vars.vm}.pc+1
local ${vars.addr}=${vars.bytecode}[${vars.vm}.pc]
if ${vars.vm}.pop() then
${vars.vm}.pc=${vars.addr}
goto continue
end
elseif ${vars.op}==${vars.vm}.OP.JMPF then
${vars.vm}.pc=${vars.vm}.pc+1
local ${vars.addr}=${vars.bytecode}[${vars.vm}.pc]
if not ${vars.vm}.pop() then
${vars.vm}.pc=${vars.addr}
goto continue
end
elseif ${vars.op}==${vars.vm}.OP.PUSH then
${vars.vm}.pc=${vars.vm}.pc+1
${vars.vm}.push(${vars.bytecode}[${vars.vm}.pc])
elseif ${vars.op}==${vars.vm}.OP.POP then
${vars.vm}.pop()
elseif ${vars.op}==${vars.vm}.OP.RET then
return ${vars.vm}.pop()
end
${vars.vm}.pc=${vars.vm}.pc+1
::continue::
end
return ${vars.vm}.stack[1]
end`;
}

// ═══════════════════════════════════════════════════════════════════════════
// BYTECODE COMPILER (Simple)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compile code to VM bytecode (simplified - just wraps in EXEC)
 */
function compileToVM(code) {
  // For now, we just use EXEC to run the decrypted code
  // A full compiler would parse Lua and generate real bytecode
  return {
    bytecode: [OPCODES.LOAD_CONST, 1, OPCODES.EXEC, OPCODES.HALT],
    constants: [code]
  };
}

/**
 * Generate bytecode array for Lua
 */
function generateBytecodeArray(bytecode, vars) {
  const obfuscated = bytecode.map(b => obfuscateNumber(b));
  return `local ${vars.bytecode}={${obfuscated.join(',')}}`;
}

/**
 * Generate constants array for Lua
 */
function generateConstantsArray(constants, vars) {
  const escaped = constants.map((c, i) => {
    if (typeof c === 'string') {
      // Use long string format for code
      return `[${i + 1}]=[=[${c}]=]`;
    }
    return `[${i + 1}]=${obfuscateNumber(c)}`;
  });
  return `local ${vars.consts}={${escaped.join(',')}}`;
}

module.exports = {
  OPCODES,
  generateVMRuntime,
  compileToVM,
  generateBytecodeArray,
  generateConstantsArray
};
