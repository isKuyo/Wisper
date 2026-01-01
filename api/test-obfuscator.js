const { obfuscate } = require('./src/utils/Obfuscator');
const fs = require('fs');

// Test with different levels
const code = 'print("Hello World")';

console.log('=== TESTING OBFUSCATOR ===\n');

['light', 'medium', 'heavy'].forEach(level => {
  console.log(`--- Level: ${level.toUpperCase()} ---`);
  const result = obfuscate(code, { level });
  console.log(`Size: ${result.stats.originalSize} -> ${result.stats.obfuscatedSize} (${result.stats.ratio}x)`);
  console.log(`Time: ${result.stats.time}ms`);
  console.log(`Preview: ${result.code.substring(0, 200)}...`);
  console.log('');
});

// Save medium level to file
const result = obfuscate(code, { level: 'medium' });
fs.writeFileSync('output.lua', result.code);
console.log('Saved medium level to output.lua');

// Also test with longer code
const longerCode = `
local x = 10
local y = 20
local function add(a, b)
  return a + b
end
print("Result:", add(x, y))
`;

console.log('\n=== LONGER CODE TEST ===');
const result2 = obfuscate(longerCode, { level: 'medium' });
console.log(`Size: ${result2.stats.originalSize} -> ${result2.stats.obfuscatedSize} (${result2.stats.ratio}x)`);
fs.writeFileSync('output-long.lua', result2.code);
console.log('Saved to output-long.lua');
