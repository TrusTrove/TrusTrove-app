const fs = require('fs');
const path = require('path');

const validG = 'GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB';
const validC = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4';

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      if (!file.includes('node_modules')) results = results.concat(walk(file));
    } else {
      if (file.includes('.test.ts') || file.includes('.test.tsx') || file.includes('e2e/')) results.push(file);
    }
  });
  return results;
}

const testFiles = walk('packages/sdk/src').concat(walk('apps/web/components')).concat(walk('apps/web/e2e'));

testFiles.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/GDJ5P54V3JUGGB274BFRVDBL6YNYL6U7SFT6DVK22C5SXZD7H2Y6OQ7D/g, validG);
  content = content.replace(/CC73Z6F3H66F74D23T44WMM2HFRB6XJ7Z6I7C523M2M24C5G3K35NBYU/g, validC);
  fs.writeFileSync(file, content);
});
console.log('Fixed test files');
