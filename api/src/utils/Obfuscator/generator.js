const crypto = require('crypto');
const { generateKeys, encrypt } = require('./encryption');

const CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const RESERVED = new Set(['and','break','do','else','elseif','end','false','for','function','goto','if','in','local','nil','not','or','repeat','return','then','true','until','while']);

// Base85 alphabet for encoding (similar to Luraph style)
const B85_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!#$%&()*+-;<=>?@^_`{|}~';

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

function N(n) {
  if (n < 0) return '-' + N(-n);
  if (n === 0) return randomChoice(['0', '0x0', '0B0', '0X0']);
  const r = Math.random();
  if (r < 0.15) return n.toString();
  if (r < 0.35) {
    const hex = n.toString(16).toUpperCase();
    if (hex.length >= 3 && Math.random() > 0.4) {
      const pos = randomInt(1, hex.length - 1);
      return '0X' + hex.slice(0, pos) + '_' + hex.slice(pos);
    }
    return '0X' + hex;
  }
  if (r < 0.55) {
    const bin = n.toString(2);
    if (bin.length >= 5 && Math.random() > 0.4) {
      const pos = randomInt(2, bin.length - 2);
      return '0B' + bin.slice(0, pos) + '__' + bin.slice(pos);
    }
    return '0B' + bin;
  }
  if (r < 0.75) {
    return '0x' + n.toString(16);
  }
  // Mixed case hex
  const hex = n.toString(16);
  let result = '0x';
  for (let i = 0; i < hex.length; i++) {
    result += Math.random() > 0.5 ? hex[i].toUpperCase() : hex[i];
  }
  return result;
}

// Encode bytes to base85-like string (looks like Luraph output)
function encodeToB85(bytes) {
  let result = '';
  for (let i = 0; i < bytes.length; i += 4) {
    let val = 0;
    for (let j = 0; j < 4 && i + j < bytes.length; j++) {
      val = val * 256 + bytes[i + j];
    }
    // Encode to 5 base85 chars
    let chunk = '';
    for (let j = 0; j < 5; j++) {
      chunk = B85_CHARS[val % 85] + chunk;
      val = Math.floor(val / 85);
    }
    result += chunk;
  }
  return result;
}

// Decode base85 string back to bytes (for the Lua decoder)
function getB85DecoderLua(nm) {
  const t = nm.v(), s = nm.v(), r = nm.v(), i = nm.v(), v = nm.v();
  const c = nm.v(), p = nm.v(), b = nm.v(), j = nm.v();
  // This generates Lua code that decodes base85
  return `local ${t}="${B85_CHARS}";local ${s}={};for ${i}=1,#${t} do ${s}[${t}:sub(${i},${i})]=${i}-1;end;` +
    `local function ${r}(${v})local ${c}={};local ${p}=1;while ${p}<=#${v} do ` +
    `local ${b}=0;for ${j}=0,4 do local ${nm.v()}=${v}:sub(${p}+${j},${p}+${j});` +
    `if ${s}[${nm.v()}] then ${b}=${b}*85+${s}[${nm.v()}];end;end;` +
    `for ${j}=3,0,-1 do ${c}[#${c}+1]=math.floor(${b}/256^${j})%256;end;${p}=${p}+5;end;return ${c};end;`;
}

// Suffixes that look like method names
const SUFFIXES = ['W', 'B', 'X', 'Z', 'Q', 'V', 'K', 'J', 'H', 'N', 'M', 'P', 'R', 'S', 'T', 'Y'];

class Names {
  constructor() { 
    this.used = new Set(); 
    this.keyIndex = 0;
  }
  v() {
    let n, a = 0;
    do {
      if (a < 52) n = CHARS[randomInt(0, 51)];
      else n = CHARS[randomInt(0, 51)] + CHARS[randomInt(0, 51)];
      a++;
    } while (this.used.has(n) || RESERVED.has(n));
    this.used.add(n);
    return n;
  }
  k() {
    const styles = [
      () => CHARS[randomInt(26, 51)],
      () => CHARS[randomInt(0, 51)] + randomChoice(SUFFIXES),
      () => CHARS[randomInt(0, 25)],
      () => '_' + CHARS[randomInt(26, 51)],
      () => CHARS[randomInt(26, 51)] + CHARS[randomInt(26, 51)],
      () => CHARS[randomInt(0, 25)] + randomChoice(SUFFIXES),
    ];
    let key, a = 0;
    do {
      key = randomChoice(styles)();
      a++;
      if (a > 100) key = '_' + CHARS[randomInt(26, 51)] + this.keyIndex++;
    } while (this.used.has(key) || RESERVED.has(key));
    this.used.add(key);
    return key;
  }
}

// Generate complex junk functions that look like real VM code (safe - no nil access)
function genFake(nm) {
  const vars = [nm.v(), nm.v(), nm.v(), nm.v(), nm.v(), nm.v()];
  const [u, E, x, R, H, V] = vars;
  
  const templates = [
    // Simple math operations
    `function(${u},${E})local ${x}=${N(randomInt(100,200))};local ${R}=${N(randomInt(50,100))};return ${x}+${R}*${N(randomInt(2,5))};end`,
    // Loop counter
    `function(${u})local ${E}=${N(0)};for ${x}=${N(1)},${N(randomInt(5,15))} do ${E}=${E}+${x};end;return ${E};end`,
    // Conditional return
    `function(${u},${E},${x})if ${u} then return ${E} or ${N(randomInt(100,500))};end;return ${x} or ${N(randomInt(200,600))};end`,
    // While loop
    `function(${u})local ${E}=${N(randomInt(200,255))};while ${E}>${N(randomInt(190,199))} do ${E}=${E}-${N(1)};end;return ${E};end`,
    // Nested conditionals
    `function(${u},${E})local ${x}=${N(randomInt(50,100))};if ${x}>${N(randomInt(40,49))} then if ${x}<${N(randomInt(101,150))} then return ${x};end;end;return ${N(0)};end`,
    // Math floor/ceil
    `function(${u},${E})local ${x}=math.floor(${N(randomInt(100,500))}/${N(randomInt(2,10))});return ${x}+${N(randomInt(1,50))};end`,
    // String length
    `function(${u})local ${E}="${randomChoice(['abc','xyz','test','data','code'])}";return #${E}*${N(randomInt(2,8))};end`,
    // Table creation
    `function()local ${u}={${N(randomInt(1,10))},${N(randomInt(11,20))},${N(randomInt(21,30))}};return #${u};end`,
    // Bit operations
    `function(${u},${E})local ${x}=bit32.bxor(${N(randomInt(100,200))},${N(randomInt(50,100))});return ${x};end`,
    // Multiple returns
    `function(${u})return ${N(randomInt(1,100))},${N(randomInt(101,200))},${N(randomInt(201,300))};end`,
    // Pcall wrapper
    `function(${u})local ${E},${x}=pcall(function()return ${N(randomInt(100,500))};end);return ${x};end`,
    // Modulo operation
    `function(${u},${E})local ${x}=${N(randomInt(1000,5000))}%${N(randomInt(100,500))};return ${x};end`,
  ];
  
  return randomChoice(templates);
}

// Generate function that hides data inside complex logic (no visible return {})
function genHiddenDataFunc(nm, data, isArray = true) {
  const [u, E, x, R, H, V, W] = [nm.v(), nm.v(), nm.v(), nm.v(), nm.v(), nm.v(), nm.v()];
  const k1 = nm.k(), k2 = nm.k();
  
  if (!isArray) {
    // Single value hidden in complex function
    const val = N(data);
    const templates = [
      `function()local ${u}=${N(randomInt(80,120))};while ${u}>${N(randomInt(70,79))} do return ${val};end;return ${val};end`,
      `function()local ${u}=${N(randomInt(100,200))};if ${u}>${N(randomInt(50,99))} then return ${val};end;return ${val};end`,
      `function()for ${u}=${N(1)},${N(1)} do return ${val};end;return ${val};end`,
    ];
    return randomChoice(templates);
  }
  
  // Build array through loop (hides the actual values better)
  const buildLoop = () => {
    let code = `function()local ${R}={};local ${H}={`;
    // Encode values with XOR to hide them
    const xorKey = randomInt(50, 200);
    code += data.map(b => N(b ^ xorKey)).join(',');
    code += `};for ${V}=1,#${H} do ${R}[${V}]=bit32.bxor(${H}[${V}],${N(xorKey)});end;`;
    code += `return ${R};end`;
    return code;
  };
  
  // Build through string.byte (very hidden)
  const buildFromString = () => {
    const str = String.fromCharCode(...data);
    const escaped = str.split('').map(c => '\\' + c.charCodeAt(0)).join('');
    return `function()local ${x}="${escaped}";local ${R}={};for ${V}=1,#${x} do ${R}[${V}]=string.byte(${x},${V});end;return ${R};end`;
  };
  
  // Build through math operations
  const buildMath = () => {
    const offset = randomInt(100, 200);
    let code = `function()local ${R}={};local ${H}={`;
    code += data.map(b => N(b + offset)).join(',');
    code += `};local ${V}=${N(offset)};for ${W}=1,#${H} do ${R}[${W}]=${H}[${W}]-${V};end;`;
    code += `return ${R};end`;
    return code;
  };
  
  // Complex conditional with hidden array
  const buildConditional = () => {
    const arrStr = '{' + data.map(b => N(b)).join(',') + '}';
    return `function()local ${H}=${arrStr};return ${H};end`;
  };
  
  return randomChoice([buildLoop, buildFromString, buildMath, buildConditional])();
}

// Generate payload string hidden in complex function
function genPayloadFunc(nm, payload) {
  const [u, E, x, R, H, V] = [nm.v(), nm.v(), nm.v(), nm.v(), nm.v(), nm.v()];
  const eqCount = randomInt(0, 3);
  const eq = '='.repeat(eqCount);
  const str = `[${eq}[${payload}]${eq}]`;
  
  const templates = [
    // Simple return with local
    `function()local ${u}=${str};return ${u};end`,
    // Nested function with closure
    `function()return(function()local ${u}=${str};return ${u};end)();end`,
    // Loop-based return
    `function()for ${u}=${N(1)},${N(1)} do local ${E}=${str};return ${E};end;end`,
    // Error handler pattern
    `function()local ${u},${E}=pcall(function()return ${str};end);if ${u} then return ${E};end;return ${str};end`,
    // Conditional return
    `function()local ${u}=${N(randomInt(100,150))};if ${u}>${N(randomInt(90,99))} then return ${str};end;return ${str};end`,
    // While loop return
    `function()local ${u}=${N(randomInt(80,120))};while ${u}>${N(randomInt(70,79))} do return ${str};end;return ${str};end`,
  ];
  return randomChoice(templates);
}

function generate(originalCode, options) {
  options = options || {};
  const level = options.level || 'medium';
  const nm = new Names();
  const keys = generateKeys();
  const encrypted = encrypt(originalCode, keys);
  
  // Store encrypted bytes directly (more reliable than base85)
  const encryptedBytes = [...encrypted];
  
  const entries = [];
  
  // Add standard library references with random names
  const libRefs = [
    'table.move', 'bit32', 'coroutine', 'tostring', 'getfenv', 
    'setmetatable', 'string.sub', 'string.gsub', 'string.byte', 
    'string.char', 'table.concat', 'rawget', 'bit32.bxor', 'math.floor',
    'table.insert', 'string.len', 'type', 'select', 'pcall', 'pairs',
    'ipairs', 'next', 'rawset', 'unpack', 'error', 'assert'
  ];
  const usedLibs = shuffle(libRefs).slice(0, randomInt(10, 16));
  usedLibs.forEach(lib => entries.push([nm.k(), lib]));
  
  // Add key data hidden in functions (Luraph style)
  const k1Key = nm.k(), k2Key = nm.k(), rotKey = nm.k(), addKey = nm.k(), seedKey = nm.k(), dataKey = nm.k();
  
  // Generate hidden data functions
  const genDataFunc = (data) => {
    const fv = [nm.v(), nm.v(), nm.v(), nm.v()];
    const arrStr = data.map(b => N(b)).join(',');
    const templates = [
      `function(${fv[0]},${fv[1]})local ${fv[2]}={${arrStr}};if ${fv[0]} then ${fv[1]}=${fv[2]};end;return ${fv[2]};end`,
      `function(${fv[0]})local ${fv[1]}={${arrStr}};return ${fv[1]};end`,
      `function()local ${fv[0]}={${arrStr}};return ${fv[0]};end`,
    ];
    return randomChoice(templates);
  };
  
  const genSeedFunc = (seed) => {
    const fv = [nm.v(), nm.v()];
    const val = N(seed);
    return `function()local ${fv[0]}=${val};return ${fv[0]};end`;
  };
  
  entries.push([k1Key, genDataFunc([...keys.key1])]);
  entries.push([k2Key, genDataFunc([...keys.key2])]);
  entries.push([rotKey, genDataFunc([...keys.rotations])]);
  entries.push([addKey, genDataFunc([...keys.addKey])]);
  entries.push([seedKey, genSeedFunc(keys.seed)]);
  entries.push([dataKey, genDataFunc(encryptedBytes)]);
  
  // Add many junk functions
  const junkCount = level === 'light' ? 12 : level === 'medium' ? 25 : 45;
  for (let i = 0; i < junkCount; i++) {
    entries.push([nm.k(), genFake(nm)]);
  }
  
  // Build the main decoder function (hidden among other functions)
  const mtKey = nm.k();
  const v = {};
  for (const name of ['u','E','x','i','b','j','a','c','k','r','L','G','F','D','K','P','Q','W','T','S','M','O','Z','Y']) {
    v[name] = nm.v();
  }
  
  // Build decoder - call functions to get data
  let mt = `function(${v.u})`;
  
  // Get keys by calling functions
  mt += `local ${v.K}=${v.u}.${k1Key}();local ${v.Q}=${v.u}.${k2Key}();`;
  mt += `local ${v.W}=${v.u}.${rotKey}();local ${v.P}=${v.u}.${addKey}();local ${v.D}=${v.u}.${seedKey}();`;
  mt += `local ${v.M}=${v.u}.${dataKey}();`;
  
  // Decryption loop
  mt += `local ${v.E}={};`;
  mt += `for ${v.i}=1,#${v.M} do local ${v.b}=${v.M}[${v.i}];`;
  mt += `local ${v.a}=((${v.i}-1)*7+${v.D})%256;local ${v.c}=0;local ${v.k}=1;`;
  mt += `for ${v.j}=0,7 do local ${v.r}=math.floor(${v.b}/${v.k})%2;local ${v.L}=math.floor(${v.a}/${v.k})%2;if ${v.r}~=${v.L} then ${v.c}=${v.c}+${v.k};end;${v.k}=${v.k}*2;end;${v.b}=${v.c};`;
  mt += `${v.b}=(${v.b}-${v.P}[(${v.i}-1)%#${v.P}+1])%256;if ${v.b}<0 then ${v.b}=${v.b}+256;end;`;
  mt += `${v.c}=0;${v.k}=1;for ${v.j}=0,7 do ${v.r}=math.floor(${v.b}/${v.k})%2;${v.L}=math.floor(${v.Q}[(${v.i}-1)%#${v.Q}+1]/${v.k})%2;if ${v.r}~=${v.L} then ${v.c}=${v.c}+${v.k};end;${v.k}=${v.k}*2;end;${v.b}=${v.c};`;
  mt += `local ${v.G}=${v.W}[(${v.i}-1)%#${v.W}+1];${v.b}=math.floor(${v.b}/2^${v.G})+(${v.b}%(2^${v.G}))*2^(8-${v.G});${v.b}=${v.b}%256;`;
  mt += `${v.c}=0;${v.k}=1;for ${v.j}=0,7 do ${v.r}=math.floor(${v.b}/${v.k})%2;${v.L}=math.floor(${v.K}[(${v.i}-1)%#${v.K}+1]/${v.k})%2;if ${v.r}~=${v.L} then ${v.c}=${v.c}+${v.k};end;${v.k}=${v.k}*2;end;`;
  mt += `${v.E}[${v.i}]=string.char(${v.c});end;`;
  
  // Final assembly and execution (use loadstring directly)
  mt += `local ${v.r}=table.concat(${v.E});`;
  mt += `return loadstring(${v.r})();end`;
  
  entries.push([mtKey, mt]);
  
  // Shuffle all entries
  const shuffled = shuffle(entries);
  
  // Build output - create table and call decoder with self-reference
  const tblVar = nm.v();
  let out = `(function()local ${tblVar}={`;
  shuffled.forEach((e, idx) => {
    if (idx > 0) out += ',';
    out += e[0] + '=' + e[1];
  });
  out += `};return ${tblVar}.${mtKey}(${tblVar});end)()`;
  
  // Wrap in additional layer for heavy obfuscation
  if (level === 'heavy') {
    const w = nm.v();
    out = `(function()local ${w}=${out};return ${w};end)()`;
  }
  
  return out;
}

module.exports = { generate, N, encodeToB85 };
