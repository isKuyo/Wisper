/**
 * Wisper Hub Obfuscator - Core Module
 * Base utilities, constants, and variable generation
 */

const crypto = require('crypto');

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

// Custom alphabet for encoding (85 chars, safe for Lua)
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!#$%&()*+-/:;<=>?@[]^_`{|}~';

// Variable name characters
const VAR_FIRST = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_';
const VAR_REST = VAR_FIRST + '0123456789';

// Lua reserved words
const LUA_RESERVED = new Set([
  'and', 'break', 'do', 'else', 'elseif', 'end', 'false', 'for', 
  'function', 'goto', 'if', 'in', 'local', 'nil', 'not', 'or', 
  'repeat', 'return', 'then', 'true', 'until', 'while'
]);

// Number formats for obfuscation
const NUM_FORMATS = {
  decimal: (n) => String(n),
  hex: (n) => `0x${n.toString(16).toUpperCase()}`,
  hexLower: (n) => `0x${n.toString(16)}`,
  binary: (n) => `0b${n.toString(2)}`,
  octal: (n) => `0${n.toString(8)}`,
  scientific: (n) => n.toExponential(),
  withUnderscore: (n) => {
    const hex = n.toString(16).toUpperCase();
    if (hex.length >= 4) {
      return `0x${hex.slice(0, 2)}_${hex.slice(2)}`;
    }
    return `0x${hex}`;
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice(arr) {
  return arr[randomInt(0, arr.length - 1)];
}

function shuffle(arr) {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(0, i);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function randomBytes(length) {
  return crypto.randomBytes(length);
}

function randomHex(length) {
  return crypto.randomBytes(length).toString('hex');
}

// ═══════════════════════════════════════════════════════════════════════════
// VARIABLE NAME GENERATOR
// ═══════════════════════════════════════════════════════════════════════════

class NameGenerator {
  constructor() {
    this.used = new Set();
    this.counter = 0;
  }

  // Generate short variable name (1-3 chars)
  short() {
    let name;
    let attempts = 0;
    do {
      if (attempts < 52) {
        name = VAR_FIRST[randomInt(0, VAR_FIRST.length - 1)];
      } else if (attempts < 52 * 53) {
        name = VAR_FIRST[randomInt(0, VAR_FIRST.length - 1)] + 
               VAR_REST[randomInt(0, VAR_REST.length - 1)];
      } else {
        name = VAR_FIRST[randomInt(0, VAR_FIRST.length - 1)] + 
               VAR_REST[randomInt(0, VAR_REST.length - 1)] +
               VAR_REST[randomInt(0, VAR_REST.length - 1)];
      }
      attempts++;
    } while (this.used.has(name) || LUA_RESERVED.has(name));
    this.used.add(name);
    return name;
  }

  // Generate unique name with prefix
  unique(prefix = '_') {
    const name = `${prefix}${this.counter++}`;
    this.used.add(name);
    return name;
  }

  // Generate confusing name (looks like hex/binary)
  confusing() {
    const styles = [
      () => `_${randomHex(2)}`,
      () => `_0x${randomHex(2)}`,
      () => `__${randomHex(3)}`,
      () => `_${VAR_FIRST[randomInt(0, 25)]}${randomInt(10, 99)}`,
      () => `${VAR_FIRST[randomInt(0, 25)]}${VAR_FIRST[randomInt(26, 51)]}${randomInt(0, 9)}`
    ];
    let name;
    do {
      name = randomChoice(styles)();
    } while (this.used.has(name) || LUA_RESERVED.has(name));
    this.used.add(name);
    return name;
  }

  // Reserve a name
  reserve(name) {
    this.used.add(name);
  }

  // Check if name is used
  isUsed(name) {
    return this.used.has(name);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// NUMBER OBFUSCATION
// ═══════════════════════════════════════════════════════════════════════════

function obfuscateNumber(n) {
  if (n < 0) {
    return `-${obfuscateNumber(-n)}`;
  }
  
  if (n === 0) return randomChoice(['0', '0x0', '0b0', '(1-1)', '(0*1)']);
  if (n === 1) return randomChoice(['1', '0x1', '0b1', '(2-1)', '(1*1)']);
  
  const formats = Object.values(NUM_FORMATS);
  const format = randomChoice(formats);
  
  // Sometimes add underscore separators
  let result = format(n);
  if (result.startsWith('0x') && result.length > 4 && Math.random() > 0.5) {
    const hex = result.slice(2);
    if (hex.length >= 4) {
      result = `0x${hex.slice(0, -2)}_${hex.slice(-2)}`;
    }
  }
  
  return result;
}

// Create complex expression that evaluates to n
function complexNumber(n) {
  const ops = [
    () => `(${n + randomInt(1, 100)}-${randomInt(1, 100)})`,
    () => `(${Math.floor(n / 2)}*2${n % 2 ? '+1' : ''})`,
    () => `(${n * 2}/2)`,
    () => {
      const a = randomInt(1, 50);
      return `(${n + a}-${a})`;
    },
    () => {
      const a = randomInt(2, 10);
      const b = n * a;
      return `(${b}/${a})`;
    }
  ];
  return randomChoice(ops)();
}

// ═══════════════════════════════════════════════════════════════════════════
// STRING UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

function stringToBytes(str) {
  return Buffer.from(str, 'utf8');
}

function bytesToHex(bytes) {
  return Buffer.isBuffer(bytes) 
    ? bytes.toString('hex') 
    : Buffer.from(bytes).toString('hex');
}

function hexToBytes(hex) {
  return Buffer.from(hex, 'hex');
}

// Escape string for Lua
function escapeLuaString(str) {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/\0/g, '\\0');
}

// Convert string to byte escape sequence
function stringToEscapes(str) {
  let result = '';
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (Math.random() > 0.3) {
      result += `\\${code}`;
    } else {
      result += `\\x${code.toString(16).padStart(2, '0')}`;
    }
  }
  return result;
}

module.exports = {
  // Constants
  ALPHABET,
  VAR_FIRST,
  VAR_REST,
  LUA_RESERVED,
  NUM_FORMATS,
  
  // Utilities
  randomInt,
  randomChoice,
  shuffle,
  randomBytes,
  randomHex,
  
  // Classes
  NameGenerator,
  
  // Number functions
  obfuscateNumber,
  complexNumber,
  
  // String functions
  stringToBytes,
  bytesToHex,
  hexToBytes,
  escapeLuaString,
  stringToEscapes
};
