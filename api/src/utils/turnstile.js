// ═══════════════════════════════════════════════════════════════
// CLOUDFLARE TURNSTILE VERIFICATION
// ═══════════════════════════════════════════════════════════════

const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY || '0x4AAAAAACJF_LNjd9sAn4-qn7y_zhhRCKw';
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Verify a Turnstile token
 * @param {string} token - The token from the client
 * @param {string} ip - The client's IP address (optional)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function verifyTurnstile(token, ip = null) {
  if (!token) {
    return { success: false, error: 'No turnstile token provided' };
  }

  try {
    const formData = new URLSearchParams();
    formData.append('secret', TURNSTILE_SECRET_KEY);
    formData.append('response', token);
    if (ip) {
      formData.append('remoteip', ip);
    }

    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const data = await response.json();

    if (data.success) {
      return { success: true };
    } else {
      console.log('[Turnstile] Verification failed:', data['error-codes']);
      return { 
        success: false, 
        error: data['error-codes']?.join(', ') || 'Verification failed' 
      };
    }
  } catch (error) {
    console.error('[Turnstile] Error verifying token:', error);
    return { success: false, error: 'Verification service error' };
  }
}

module.exports = { verifyTurnstile };
