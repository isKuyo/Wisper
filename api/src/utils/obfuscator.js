// ═══════════════════════════════════════════════════════════════
// LUAU OBFUSCATOR WRAPPER
// Wrapper for the C-based LuauObfuscator binary
// ═══════════════════════════════════════════════════════════════

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

// Path to the obfuscator binary
const OBFUSCATOR_PATH = process.env.NODE_ENV === 'production'
  ? path.join('/app', 'obfuscator', 'Obfuscator')
  : path.join(__dirname, 'LuauObfuscator', 'bin', 'Obfuscator.exe');

/**
 * Obfuscate Lua code using the LuauObfuscator binary
 * @param {string} code - The Lua source code to obfuscate
 * @param {object} options - Options for obfuscation
 * @returns {object} - Result with obfuscated code
 * @throws {Error} - If obfuscation fails (NO FALLBACK)
 */
function obfuscate(code, options = {}) {
  const { userId = 'unknown', keyId = 'unknown', sessionId = '' } = options;
  
  // Generate unique temp file names
  const tempId = crypto.randomBytes(8).toString('hex');
  const tempDir = os.tmpdir();
  const inputFile = path.join(tempDir, `obf_input_${tempId}.lua`);
  const outputFile = path.join(tempDir, `obf_output_${tempId}.lua`);
  
  try {
    // Add watermark comment to track usage (embedded in obfuscated code)
    const watermark = `-- Wisper Hub | User: ${userId} | Session: ${sessionId.substring(0, 8)}\n`;
    const codeWithWatermark = watermark + code;
    
    // Write input file
    fs.writeFileSync(inputFile, codeWithWatermark, 'utf8');
    
    // Check if obfuscator binary exists
    if (!fs.existsSync(OBFUSCATOR_PATH)) {
      throw new Error(`Obfuscator binary not found at: ${OBFUSCATOR_PATH}`);
    }
    
    // Execute obfuscator - NO FALLBACK, must succeed
    execSync(`"${OBFUSCATOR_PATH}" "${inputFile}" "${outputFile}"`, {
      timeout: 60000, // 60 second timeout
      stdio: 'pipe'
    });
    
    // Read output file
    if (!fs.existsSync(outputFile)) {
      throw new Error('Obfuscator did not produce output file');
    }
    
    const obfuscatedCode = fs.readFileSync(outputFile, 'utf8');
    
    if (!obfuscatedCode || obfuscatedCode.trim().length === 0) {
      throw new Error('Obfuscator produced empty output');
    }
    
    return {
      success: true,
      code: obfuscatedCode,
      stats: {
        originalSize: code.length,
        obfuscatedSize: obfuscatedCode.length
      }
    };
  } catch (error) {
    console.error('[Obfuscator] FATAL ERROR:', error.message);
    throw error; // Re-throw - NO FALLBACK to original code
  } finally {
    // Cleanup temp files
    try {
      if (fs.existsSync(inputFile)) fs.unlinkSync(inputFile);
      if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

module.exports = { obfuscate };
