/**
 * Wisper Hub Obfuscator - Encoding Module
 * Base85 and custom alphabet encoding/decoding
 */

const { ALPHABET, randomInt } = require('./core');

// ═══════════════════════════════════════════════════════════════════════════
// BASE85 ENCODING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Encode bytes to Base85 string
 */
function encodeBase85(data) {
  const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data);
  let result = '';
  
  for (let i = 0; i < bytes.length; i += 4) {
    let value = 0n;
    let count = 0;
    
    for (let j = 0; j < 4 && i + j < bytes.length; j++) {
      value = value * 256n + BigInt(bytes[i + j]);
      count++;
    }
    
    // Pad with zeros if needed
    for (let j = count; j < 4; j++) {
      value = value * 256n;
    }
    
    // Convert to base85
    const chars = [];
    for (let j = 0; j < 5; j++) {
      chars.unshift(ALPHABET[Number(value % 85n)]);
      value = value / 85n;
    }
    
    // Only add the chars we need (count + 1)
    result += chars.slice(0, count + 1).join('');
  }
  
  return result;
}

/**
 * Decode Base85 string to bytes
 */
function decodeBase85(str) {
  const result = [];
  
  for (let i = 0; i < str.length; i += 5) {
    let value = 0n;
    let count = 0;
    
    for (let j = 0; j < 5 && i + j < str.length; j++) {
      const idx = ALPHABET.indexOf(str[i + j]);
      if (idx >= 0) {
        value = value * 85n + BigInt(idx);
        count++;
      }
    }
    
    // Pad if needed
    for (let j = count; j < 5; j++) {
      value = value * 85n + 84n; // 'u' in our alphabet
    }
    
    // Extract bytes (count - 1 bytes)
    const bytes = [];
    for (let j = 0; j < 4; j++) {
      bytes.unshift(Number(value % 256n));
      value = value / 256n;
    }
    
    // Only add the bytes we need
    const numBytes = count > 0 ? count - 1 : 0;
    for (let j = 0; j < numBytes && j < 4; j++) {
      result.push(bytes[j]);
    }
  }
  
  return Buffer.from(result);
}

// ═══════════════════════════════════════════════════════════════════════════
// GENERATE LUA DECODER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate Lua code for Base85 decoding
 */
function generateBase85Decoder(vars) {
  return `
local ${vars.alphabet}=[=[${ALPHABET}]=]
local ${vars.decode}=function(${vars.str})
local ${vars.result}={}
local ${vars.i}=1
while ${vars.i}<=#${vars.str} do
local ${vars.val}=0
local ${vars.cnt}=0
for ${vars.j}=0,4 do
local ${vars.ch}=${vars.str}:sub(${vars.i}+${vars.j},${vars.i}+${vars.j})
local ${vars.pos}=${vars.alphabet}:find(${vars.ch},1,true)
if ${vars.pos} then
${vars.val}=${vars.val}*85+(${vars.pos}-1)
${vars.cnt}=${vars.cnt}+1
end
end
for ${vars.j}=${vars.cnt},5 do ${vars.val}=${vars.val}*85+84 end
local ${vars.bytes}={}
for ${vars.j}=1,4 do
${vars.bytes}[5-${vars.j}]=${vars.val}%256
${vars.val}=math.floor(${vars.val}/256)
end
local ${vars.num}=${vars.cnt}>0 and ${vars.cnt}-1 or 0
for ${vars.j}=1,${vars.num} do
if ${vars.j}<=4 then ${vars.result}[#${vars.result}+1]=${vars.bytes}[${vars.j}] end
end
${vars.i}=${vars.i}+5
end
return ${vars.result}
end`;
}

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOM ENCODING (More compact)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Encode bytes to custom format with length prefix
 */
function encodeCustom(data) {
  const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data);
  
  // Use a simpler hex-based encoding that's more reliable
  let result = '';
  for (let i = 0; i < bytes.length; i++) {
    result += bytes[i].toString(16).padStart(2, '0');
  }
  
  return result;
}

/**
 * Generate Lua hex decoder (simpler, more reliable)
 */
function generateHexDecoder(vars) {
  return `
local ${vars.decode}=function(${vars.str})
local ${vars.result}={}
for ${vars.i}=1,#${vars.str},2 do
${vars.result}[#${vars.result}+1]=tonumber(${vars.str}:sub(${vars.i},${vars.i}+1),16)
end
return ${vars.result}
end`;
}

module.exports = {
  encodeBase85,
  decodeBase85,
  generateBase85Decoder,
  encodeCustom,
  generateHexDecoder
};
