/**
 * Wisper Hub Obfuscator - String Encoding Module
 * String table encoding and obfuscation
 */

const { randomInt, randomChoice, stringToBytes } = require('./core');

// ═══════════════════════════════════════════════════════════════════════════
// STRING EXTRACTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Extract all strings from Lua code
 */
function extractStrings(code) {
  const strings = [];
  const regex = /(?<!\\)(['"])((?:\\.|(?!\1)[^\\])*)\1/g;
  let match;
  
  while ((match = regex.exec(code)) !== null) {
    strings.push({
      original: match[0],
      content: match[2],
      quote: match[1],
      index: match.index
    });
  }
  
  return strings;
}

// ═══════════════════════════════════════════════════════════════════════════
// STRING ENCODING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Encode string to byte array with XOR key
 */
function encodeString(str, key) {
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    const charCode = str.charCodeAt(i);
    const xorKey = key[(i % key.length)];
    bytes.push(charCode ^ xorKey);
  }
  return bytes;
}

/**
 * Create string table with encoded strings
 */
function createStringTable(strings, key) {
  const table = {};
  
  strings.forEach((str, idx) => {
    table[idx] = {
      encoded: encodeString(str.content, key),
      original: str.content,
      key: key
    };
  });
  
  return table;
}

// ═══════════════════════════════════════════════════════════════════════════
// GENERATE LUA STRING TABLE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate Lua string table and decoder
 */
function generateStringTable(stringTable, vars) {
  const key = stringTable[Object.keys(stringTable)[0]]?.key || [0x55];
  const keyStr = key.join(',');
  
  let tableCode = `local ${vars.strKey}={${keyStr}}\n`;
  tableCode += `local ${vars.strTable}={\n`;
  
  Object.entries(stringTable).forEach(([idx, data]) => {
    const bytesStr = data.encoded.join(',');
    tableCode += `[${idx}]={${bytesStr}},\n`;
  });
  
  tableCode += `}\n`;
  
  // Decoder function
  tableCode += `local ${vars.getStr}=function(${vars.idx})
local ${vars.t}=${vars.strTable}[${vars.idx}]
if not ${vars.t} then return"" end
local ${vars.r}={}
for ${vars.i}=1,#${vars.t} do
local ${vars.b}=${vars.t}[${vars.i}]
local ${vars.k}=${vars.strKey}[(${vars.i}-1)%#${vars.strKey}+1]
local ${vars.x}=0
local ${vars.p}=1
for ${vars.j}=0,7 do
local ${vars.ba}=math.floor(${vars.b}/${vars.p})%2
local ${vars.bb}=math.floor(${vars.k}/${vars.p})%2
if ${vars.ba}~=${vars.bb} then ${vars.x}=${vars.x}+${vars.p} end
${vars.p}=${vars.p}*2
end
${vars.r}[${vars.i}]=string.char(${vars.x})
end
return table.concat(${vars.r})
end\n`;
  
  return tableCode;
}

// ═══════════════════════════════════════════════════════════════════════════
// STRING OBFUSCATION METHODS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Convert string to escape sequence
 */
function toEscapeSequence(str) {
  let result = '"';
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (Math.random() > 0.5) {
      result += `\\${code}`;
    } else {
      result += `\\x${code.toString(16).padStart(2, '0')}`;
    }
  }
  result += '"';
  return result;
}

/**
 * Split string into concatenation
 */
function splitString(str) {
  if (str.length < 4) return `"${str}"`;
  
  const parts = [];
  let i = 0;
  while (i < str.length) {
    const len = randomInt(1, Math.min(5, str.length - i));
    parts.push(`"${str.slice(i, i + len)}"`);
    i += len;
  }
  
  return parts.join('..');
}

/**
 * Convert to long string format
 */
function toLongString(str) {
  const level = randomInt(0, 3);
  const eq = '='.repeat(level);
  return `[${eq}[${str}]${eq}]`;
}

module.exports = {
  extractStrings,
  encodeString,
  createStringTable,
  generateStringTable,
  toEscapeSequence,
  splitString,
  toLongString
};
