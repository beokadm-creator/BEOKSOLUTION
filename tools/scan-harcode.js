#!/usr/bin/env node
// Lightweight scan for console usage and environment variable reads in src/
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
function walk(dir){
  let files = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) files = files.concat(walk(full));
    else if (full.endsWith('.js') || full.endsWith('.ts') || full.endsWith('.jsx') || full.endsWith('.tsx')) files.push(full);
  }
  return files;
}
const files = walk(path.join(root, 'src'));
const findings = [];
files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  if (/console\.(log|debug|info|warn|error)/.test(content)) findings.push({type:'console', file:f});
  if (/process\.env/.test(content)) findings.push({type:'env', file:f});
});
console.log('Hard-coded/log usage scan:');
findings.forEach(f => console.log(`- ${f.type} usage in ${f.file}`));
if (findings.length === 0) console.log('- No obvious console/env hints found.');
