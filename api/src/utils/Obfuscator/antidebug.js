/**
 * Wisper Hub Obfuscator - Anti-Debug Module
 * Advanced anti-debugging and protection techniques
 */

const { randomInt, obfuscateNumber } = require('./core');

// ═══════════════════════════════════════════════════════════════════════════
// ENVIRONMENT DETECTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate environment fingerprinting code
 */
function generateEnvFingerprint(vars) {
  return `
local ${vars.envSig}=0
if _VERSION then ${vars.envSig}=${vars.envSig}+1 end
if jit then ${vars.envSig}=${vars.envSig}+2 end
if game then ${vars.envSig}=${vars.envSig}+4 end
if script then ${vars.envSig}=${vars.envSig}+8 end
if workspace then ${vars.envSig}=${vars.envSig}+16 end`;
}

/**
 * Generate dangerous function detection
 */
function generateDangerousCheck(vars) {
  return `
local ${vars.dangerous}={"dumpstring","decompile","getscriptbytecode","debug_info","getgc","getupvalues","setupvalue","getfenv","setfenv"}
for _,${vars.n} in pairs(${vars.dangerous}) do
if rawget(_G,${vars.n}) or rawget(getfenv(),${vars.n}) then
${vars.die}()
end
end`;
}

// ═══════════════════════════════════════════════════════════════════════════
// DEBUG DETECTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate debug.getinfo detection (safe version)
 */
function generateDebugDetection(vars) {
  return `
local ${vars.checkDebug}=function()
if debug and debug.getinfo then
local ${vars.ok},${vars.info}=pcall(debug.getinfo,1)
if ${vars.ok} and ${vars.info} and ${vars.info}.source then
if ${vars.info}.source:lower():find("debug")then
return false
end
end
end
return true
end`;
}

/**
 * Generate timing check
 */
function generateTimingCheck(vars) {
  const iterations = randomInt(100000, 500000);
  const maxTime = 0.3;
  
  return `
local ${vars.checkTiming}=function()
local ${vars.start}=os.clock()
local ${vars.sum}=0
for ${vars.i}=1,${obfuscateNumber(iterations)} do
${vars.sum}=${vars.sum}+1
end
if os.clock()-${vars.start}>${maxTime} then
return false
end
return true
end`;
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOK DETECTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate function hook detection
 */
function generateHookDetection(vars) {
  const magicNumber = randomInt(0x10000, 0xFFFFF);
  
  return `
local ${vars.checkHooks}=function()
local ${vars.magic}=${obfuscateNumber(magicNumber)}
local ${vars.testFn}=function()return ${obfuscateNumber(magicNumber)} end
local ${vars.result}=${vars.testFn}()
if ${vars.result}~=${obfuscateNumber(magicNumber)} then
return false
end
return true
end`;
}

/**
 * Generate metatable protection check
 */
function generateMetatableCheck(vars) {
  return `
local ${vars.checkMt}=function()
local ${vars.test}={}
local ${vars.mt}={__index=function()return ${obfuscateNumber(randomInt(1000, 9999))} end}
setmetatable(${vars.test},${vars.mt})
local ${vars.v}=${vars.test}.nonexistent
if type(${vars.v})~="number" then
return false
end
return true
end`;
}

// ═══════════════════════════════════════════════════════════════════════════
// SELF-DESTRUCT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate self-destruct function
 */
function generateSelfDestruct(vars) {
  return `
local ${vars.die}=function()
local ${vars.trash}={}
for ${vars.i}=1,10000 do
${vars.trash}[${vars.i}]={math.random(),math.random(),math.random()}
end
if collectgarbage then pcall(collectgarbage,"collect") end
${vars.payload}=nil
${vars.decrypted}=nil
error("",0)
end`;
}

// ═══════════════════════════════════════════════════════════════════════════
// INTEGRITY CHECK
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate code integrity check
 */
function generateIntegrityCheck(vars, expectedChecksum) {
  return `
local ${vars.checkIntegrity}=function(${vars.code})
local ${vars.sum}=0
for ${vars.i}=1,#${vars.code} do
${vars.sum}=${vars.sum}*31+${vars.code}:byte(${vars.i})
${vars.sum}=${vars.sum}%${obfuscateNumber(0x7FFFFFFF)}
end
return ${vars.sum}==${obfuscateNumber(expectedChecksum)}
end`;
}

/**
 * Calculate checksum for code
 */
function calculateChecksum(code) {
  let sum = 0;
  for (let i = 0; i < code.length; i++) {
    sum = sum * 31 + code.charCodeAt(i);
    sum = sum % 0x7FFFFFFF;
  }
  return sum;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMBINED PROTECTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate all anti-debug protections
 */
function generateAllProtections(vars) {
  let code = '';
  
  // Self-destruct first (needed by other checks)
  code += generateSelfDestruct(vars) + '\n';
  
  // Environment check
  code += generateEnvFingerprint(vars) + '\n';
  
  // Debug detection
  code += generateDebugDetection(vars) + '\n';
  
  // Timing check
  code += generateTimingCheck(vars) + '\n';
  
  // Hook detection
  code += generateHookDetection(vars) + '\n';
  
  // Combined check function
  code += `
local ${vars.checkAll}=function()
if not ${vars.checkDebug}() then ${vars.die}() end
if not ${vars.checkHooks}() then ${vars.die}() end
return true
end
${vars.checkAll}()`;
  
  return code;
}

module.exports = {
  generateEnvFingerprint,
  generateDangerousCheck,
  generateDebugDetection,
  generateTimingCheck,
  generateHookDetection,
  generateMetatableCheck,
  generateSelfDestruct,
  generateIntegrityCheck,
  calculateChecksum,
  generateAllProtections
};
