/**
 * Wisper Hub Advanced Obfuscator - Luraph Style
 * 
 * Features:
 * - Multi-layer XOR encryption
 * - Custom encoding
 * - Control flow obfuscation
 * - String table encoding
 * - Anti-debug protection
 * - Dead code injection
 * - Single-line compact output
 * - Zero visible loadstring
 */

const { generate } = require('./generator');
const { NameGenerator } = require('./core');
const { generateKeys, encrypt, decrypt } = require('./encryption');
const { encodeCustom } = require('./encoding');

// ═══════════════════════════════════════════════════════════════════════════
// MAIN OBFUSCATION FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Obfuscate Lua code
 * @param {string} code - Original Lua code
 * @param {object} options - Obfuscation options
 * @returns {object} Obfuscated code and metadata
 */
function obfuscate(code, options = {}) {
  const {
    level = 'medium',
    addJunk = true,
    addAntiDebug = true,
    minifyOutput = true
  } = options;
  
  const startTime = Date.now();
  
  // Generate obfuscated code
  const obfuscatedCode = generate(code, {
    level,
    addJunk,
    addAntiDebug,
    minifyOutput
  });
  
  return {
    code: obfuscatedCode,
    stats: {
      originalSize: code.length,
      obfuscatedSize: obfuscatedCode.length,
      ratio: (obfuscatedCode.length / code.length).toFixed(2),
      level,
      time: Date.now() - startTime
    }
  };
}

/**
 * Light obfuscation - minimal protection, fast
 */
function obfuscateLight(code, options = {}) {
  return obfuscate(code, { 
    ...options, 
    level: 'light',
    addAntiDebug: false
  });
}

/**
 * Medium obfuscation - balanced protection
 */
function obfuscateMedium(code, options = {}) {
  return obfuscate(code, { 
    ...options, 
    level: 'medium' 
  });
}

/**
 * Heavy obfuscation - maximum protection
 */
function obfuscateHeavy(code, options = {}) {
  return obfuscate(code, { 
    ...options, 
    level: 'heavy',
    addJunk: true,
    addAntiDebug: true
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  // Main functions
  obfuscate,
  obfuscateLight,
  obfuscateMedium,
  obfuscateHeavy,
  
  // Utilities (for advanced usage)
  NameGenerator,
  generateKeys,
  encrypt,
  decrypt,
  encodeCustom
};
