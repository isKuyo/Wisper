/**
 * Wisper Hub Obfuscator - Encryption Module
 * Multi-layer XOR encryption with key rotation
 */

const crypto = require('crypto');
const { randomInt, randomBytes } = require('./core');

// ═══════════════════════════════════════════════════════════════════════════
// KEY GENERATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate encryption keys
 */
function generateKeys() {
  return {
    // Primary XOR key (32 bytes)
    key1: [...randomBytes(32)],
    // Secondary XOR key (16 bytes)
    key2: [...randomBytes(16)],
    // Rotation amounts (8 values, 0-7)
    rotations: [...randomBytes(8)].map(b => b % 8),
    // Addition key (8 bytes)
    addKey: [...randomBytes(8)],
    // Seed for additional operations
    seed: randomInt(0x1000, 0xFFFF)
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ENCRYPTION LAYERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * XOR bytes with key
 */
function xorLayer(data, key) {
  const result = [];
  for (let i = 0; i < data.length; i++) {
    result.push(data[i] ^ key[i % key.length]);
  }
  return result;
}

/**
 * Rotate bits left
 */
function rotateLeft(byte, amount) {
  amount = amount % 8;
  return ((byte << amount) | (byte >> (8 - amount))) & 0xFF;
}

/**
 * Rotate bits right
 */
function rotateRight(byte, amount) {
  amount = amount % 8;
  return ((byte >> amount) | (byte << (8 - amount))) & 0xFF;
}

/**
 * Rotation layer
 */
function rotationLayer(data, rotations) {
  const result = [];
  for (let i = 0; i < data.length; i++) {
    const rot = rotations[i % rotations.length];
    result.push(rotateLeft(data[i], rot));
  }
  return result;
}

/**
 * Addition layer
 */
function additionLayer(data, addKey) {
  const result = [];
  for (let i = 0; i < data.length; i++) {
    result.push((data[i] + addKey[i % addKey.length]) & 0xFF);
  }
  return result;
}

/**
 * Position-based XOR layer
 */
function positionXorLayer(data, seed) {
  const result = [];
  for (let i = 0; i < data.length; i++) {
    const posKey = ((i * 7) + seed) & 0xFF;
    result.push(data[i] ^ posKey);
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// MULTI-LAYER ENCRYPTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Encrypt data with multiple layers
 */
function encrypt(data, keys) {
  let bytes = Buffer.isBuffer(data) 
    ? [...data] 
    : typeof data === 'string' 
      ? [...Buffer.from(data, 'utf8')]
      : [...data];
  
  // Layer 1: XOR with key1
  bytes = xorLayer(bytes, keys.key1);
  
  // Layer 2: Bit rotation
  bytes = rotationLayer(bytes, keys.rotations);
  
  // Layer 3: XOR with key2
  bytes = xorLayer(bytes, keys.key2);
  
  // Layer 4: Addition
  bytes = additionLayer(bytes, keys.addKey);
  
  // Layer 5: Position-based XOR
  bytes = positionXorLayer(bytes, keys.seed);
  
  return bytes;
}

/**
 * Decrypt data (reverse all layers)
 */
function decrypt(data, keys) {
  let bytes = [...data];
  
  // Reverse Layer 5: Position-based XOR (same operation)
  const result5 = [];
  for (let i = 0; i < bytes.length; i++) {
    const posKey = ((i * 7) + keys.seed) & 0xFF;
    result5.push(bytes[i] ^ posKey);
  }
  bytes = result5;
  
  // Reverse Layer 4: Subtraction
  const result4 = [];
  for (let i = 0; i < bytes.length; i++) {
    let val = (bytes[i] - keys.addKey[i % keys.addKey.length]) & 0xFF;
    if (val < 0) val += 256;
    result4.push(val);
  }
  bytes = result4;
  
  // Reverse Layer 3: XOR with key2 (same operation)
  bytes = xorLayer(bytes, keys.key2);
  
  // Reverse Layer 2: Rotate right
  const result2 = [];
  for (let i = 0; i < bytes.length; i++) {
    const rot = keys.rotations[i % keys.rotations.length];
    result2.push(rotateRight(bytes[i], rot));
  }
  bytes = result2;
  
  // Reverse Layer 1: XOR with key1 (same operation)
  bytes = xorLayer(bytes, keys.key1);
  
  return Buffer.from(bytes);
}

// ═══════════════════════════════════════════════════════════════════════════
// GENERATE LUA DECRYPTOR
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate Lua decryption code
 */
function generateDecryptor(keys, vars) {
  const key1Hex = keys.key1.map(b => b.toString(16).padStart(2, '0')).join('');
  const key2Hex = keys.key2.map(b => b.toString(16).padStart(2, '0')).join('');
  const rotStr = keys.rotations.join(',');
  const addStr = keys.addKey.join(',');
  
  return `
local ${vars.k1h}="${key1Hex}"
local ${vars.k2h}="${key2Hex}"
local ${vars.rot}={${rotStr}}
local ${vars.add}={${addStr}}
local ${vars.seed}=${keys.seed}
local ${vars.h2b}=function(${vars.h})
local ${vars.r}={}
for ${vars.i}=1,#${vars.h},2 do
${vars.r}[#${vars.r}+1]=tonumber(${vars.h}:sub(${vars.i},${vars.i}+1),16)
end
return ${vars.r}
end
local ${vars.k1}=${vars.h2b}(${vars.k1h})
local ${vars.k2}=${vars.h2b}(${vars.k2h})
local ${vars.xor}=function(${vars.a},${vars.b})
local ${vars.r}=0
local ${vars.p}=1
for ${vars.j}=0,7 do
local ${vars.ba}=math.floor(${vars.a}/${vars.p})%2
local ${vars.bb}=math.floor(${vars.b}/${vars.p})%2
if ${vars.ba}~=${vars.bb} then ${vars.r}=${vars.r}+${vars.p} end
${vars.p}=${vars.p}*2
end
return ${vars.r}
end
local ${vars.ror}=function(${vars.byte},${vars.amt})
${vars.amt}=${vars.amt}%8
local ${vars.r}=math.floor(${vars.byte}/2^${vars.amt})
${vars.r}=${vars.r}+(${vars.byte}%(2^${vars.amt}))*2^(8-${vars.amt})
return ${vars.r}%256
end
local ${vars.decrypt}=function(${vars.data})
local ${vars.r}={}
for ${vars.i}=1,#${vars.data} do
local ${vars.v}=${vars.data}[${vars.i}]
local ${vars.pk}=((${vars.i}-1)*7+${vars.seed})%256
${vars.v}=${vars.xor}(${vars.v},${vars.pk})
${vars.v}=(${vars.v}-${vars.add}[(${vars.i}-1)%#${vars.add}+1])%256
if ${vars.v}<0 then ${vars.v}=${vars.v}+256 end
${vars.v}=${vars.xor}(${vars.v},${vars.k2}[(${vars.i}-1)%#${vars.k2}+1])
${vars.v}=${vars.ror}(${vars.v},${vars.rot}[(${vars.i}-1)%#${vars.rot}+1])
${vars.v}=${vars.xor}(${vars.v},${vars.k1}[(${vars.i}-1)%#${vars.k1}+1])
${vars.r}[${vars.i}]=string.char(${vars.v})
end
return table.concat(${vars.r})
end`;
}

module.exports = {
  generateKeys,
  encrypt,
  decrypt,
  generateDecryptor,
  xorLayer,
  rotationLayer,
  additionLayer
};
