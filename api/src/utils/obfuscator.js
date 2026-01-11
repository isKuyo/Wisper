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
 */
function obfuscate(code, options = {}) {
  const { userId = 'unknown', keyId = 'unknown', sessionId = '' } = options;
  
  // Generate unique temp file names
  const tempId = crypto.randomBytes(8).toString('hex');
  const tempDir = os.tmpdir();
  const inputFile = path.join(tempDir, `obf_input_${tempId}.lua`);
  const outputFile = path.join(tempDir, `obf_output_${tempId}.lua`);
  
  try {
    // Add watermark comment to track usage
    const watermark = `-- Wisper Hub | User: ${userId} | Session: ${sessionId.substring(0, 8)}\n`;
    const codeWithWatermark = watermark + code;
    
    // Write input file
    fs.writeFileSync(inputFile, codeWithWatermark, 'utf8');
    
    // Check if obfuscator binary exists
    if (!fs.existsSync(OBFUSCATOR_PATH)) {
      console.warn('[Obfuscator] Binary not found, returning original code with watermark');
      return {
        success: true,
        code: codeWithWatermark,
        warning: 'Obfuscator binary not available'
      };
    }
    
    // Execute obfuscator
    try {
      execSync(`"${OBFUSCATOR_PATH}" "${inputFile}" "${outputFile}"`, {
        timeout: 30000, // 30 second timeout
        stdio: 'pipe'
      });
    } catch (execError) {
      console.error('[Obfuscator] Execution failed:', execError.message);
      // Return original code with watermark if obfuscation fails
      return {
        success: true,
        code: codeWithWatermark,
        warning: 'Obfuscation failed, returning original code'
      };
    }
    
    // Read output file
    if (fs.existsSync(outputFile)) {
      const obfuscatedCode = fs.readFileSync(outputFile, 'utf8');
      return {
        success: true,
        code: obfuscatedCode
      };
    } else {
      // Fallback to original code
      return {
        success: true,
        code: codeWithWatermark,
        warning: 'Output file not created'
      };
    }
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
