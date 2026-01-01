/**
 * Wisper Hub Obfuscator - Junk Code Module
 * Dead code injection and fake operations
 */

const { randomInt, randomChoice, obfuscateNumber, randomHex } = require('./core');

// ═══════════════════════════════════════════════════════════════════════════
// JUNK VARIABLES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate junk variable declarations
 */
function generateJunkVariables(count, nameGen) {
  const lines = [];
  
  for (let i = 0; i < count; i++) {
    const name = nameGen.confusing();
    const type = randomInt(0, 6);
    
    switch (type) {
      case 0: // Number
        lines.push(`local ${name}=${obfuscateNumber(randomInt(0, 99999))}`);
        break;
      case 1: // String
        lines.push(`local ${name}="${randomHex(randomInt(4, 12))}"`);
        break;
      case 2: // Boolean
        lines.push(`local ${name}=${Math.random() > 0.5 ? 'true' : 'false'}`);
        break;
      case 3: // Nil
        lines.push(`local ${name}=nil`);
        break;
      case 4: // Empty table
        lines.push(`local ${name}={}`);
        break;
      case 5: // Empty function
        lines.push(`local ${name}=function()end`);
        break;
      case 6: // Expression
        const a = randomInt(1, 100);
        const b = randomInt(1, 100);
        lines.push(`local ${name}=(${obfuscateNumber(a)}*${obfuscateNumber(b)})`);
        break;
    }
  }
  
  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════
// JUNK FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate dead functions
 */
function generateJunkFunctions(count, nameGen) {
  const functions = [];
  
  for (let i = 0; i < count; i++) {
    const name = nameGen.confusing();
    const params = [];
    const paramCount = randomInt(0, 3);
    
    for (let j = 0; j < paramCount; j++) {
      params.push(nameGen.short());
    }
    
    const bodyType = randomInt(0, 4);
    let body;
    
    switch (bodyType) {
      case 0: // Return constant
        body = `return ${obfuscateNumber(randomInt(0, 1000))}`;
        break;
      case 1: // Return nil
        body = `return nil`;
        break;
      case 2: // Empty loop
        body = `for _=1,0 do end`;
        break;
      case 3: // Math operation
        body = `local _=${obfuscateNumber(randomInt(1, 100))}*${obfuscateNumber(randomInt(1, 100))}\nreturn _`;
        break;
      case 4: // Nested function
        body = `local _=function()end\nreturn _`;
        break;
    }
    
    functions.push(`local function ${name}(${params.join(',')})
${body}
end`);
  }
  
  return functions.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════
// JUNK OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate junk operations that do nothing
 */
function generateJunkOperations(count, vars) {
  const ops = [];
  
  for (let i = 0; i < count; i++) {
    const type = randomInt(0, 5);
    
    switch (type) {
      case 0: // Nil assignment
        ops.push(`${vars[randomInt(0, vars.length - 1)]}=nil`);
        break;
      case 1: // Self assignment
        const v = vars[randomInt(0, vars.length - 1)];
        ops.push(`${v}=${v}`);
        break;
      case 2: // Empty if
        ops.push(`if false then end`);
        break;
      case 3: // Empty loop
        ops.push(`for _=1,0 do end`);
        break;
      case 4: // Pcall nothing
        ops.push(`pcall(function()end)`);
        break;
      case 5: // Type check
        ops.push(`_=type(nil)`);
        break;
    }
  }
  
  return ops.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════
// FAKE API CALLS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate fake API calls
 */
function generateFakeAPICalls(count, nameGen) {
  const calls = [];
  const apis = [
    'math.random()',
    'math.floor(0)',
    'math.ceil(0)',
    'math.abs(0)',
    'string.len("")',
    'string.sub("",1,0)',
    'table.concat({})',
    'type(nil)',
    'tostring(0)',
    'tonumber("0")',
    'pairs({})',
    'ipairs({})',
    'pcall(function()end)',
    'select(1,nil)',
    'rawget({},nil)',
    'rawset({},1,nil)',
    'setmetatable({},nil)',
    'getmetatable({})'
  ];
  
  for (let i = 0; i < count; i++) {
    const name = nameGen.confusing();
    const api = randomChoice(apis);
    calls.push(`local ${name}=${api}`);
  }
  
  return calls.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════
// GARBAGE GENERATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate garbage collection trigger
 */
function generateGarbageTrigger(vars) {
  return `
local ${vars.trash}={}
for ${vars.i}=1,${obfuscateNumber(randomInt(100, 500))} do
${vars.trash}[${vars.i}]={${obfuscateNumber(randomInt(0, 1000))},${obfuscateNumber(randomInt(0, 1000))}}
end
${vars.trash}=nil
if collectgarbage then pcall(collectgarbage,"collect") end`;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMBINED JUNK
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate all junk code
 */
function generateAllJunk(nameGen, level = 'medium') {
  const counts = {
    light: { vars: 3, funcs: 1, apis: 2 },
    medium: { vars: 8, funcs: 3, apis: 5 },
    heavy: { vars: 15, funcs: 6, apis: 10 }
  };
  
  const c = counts[level] || counts.medium;
  
  let code = '';
  code += generateJunkVariables(c.vars, nameGen) + '\n';
  code += generateJunkFunctions(c.funcs, nameGen) + '\n';
  code += generateFakeAPICalls(c.apis, nameGen) + '\n';
  
  return code;
}

module.exports = {
  generateJunkVariables,
  generateJunkFunctions,
  generateJunkOperations,
  generateFakeAPICalls,
  generateGarbageTrigger,
  generateAllJunk
};
