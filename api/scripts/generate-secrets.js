#!/usr/bin/env node
/**
 * Generate secure secrets for production
 * Run: node scripts/generate-secrets.js
 * 
 * This script outputs environment variables that you can copy to Railway/Vercel
 */

const crypto = require('crypto');

const secrets = {
  JWT_SECRET: crypto.randomBytes(64).toString('hex'),
  API_SECRET_KEY: crypto.randomBytes(32).toString('hex'),
  HWID_SALT: crypto.randomBytes(16).toString('hex'),
};

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('   WISPER HUB - GENERATED SECRETS');
console.log('   Copy these to your Railway environment variables');
console.log('═══════════════════════════════════════════════════════════════\n');

for (const [key, value] of Object.entries(secrets)) {
  console.log(`${key}=${value}`);
}

console.log('\n═══════════════════════════════════════════════════════════════\n');
