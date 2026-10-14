// Classes v1 adds on top of stock Bootstrap (the surface core.css must cover). Run: node scripts/extract-v1-classes.mjs [v1Dir]
import fs from 'node:fs';
const v1 = process.argv[2] ?? '../assets_v1';
const classes = (file) => {
  const css = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/url\([^)]*\)/g, '').replace(/"[^"]*"|'[^']*'/g, '');
  return new Set([...css.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map((m) => m[1]));
};
const stock = classes('node_modules/bootstrap/dist/css/bootstrap.css');
const added = [...classes(`${v1}/colors/latest/jjjei_admin:0.css`)].filter((c) => !stock.has(c)).sort();
fs.writeFileSync('test/fixtures/v1-added-classes.json', JSON.stringify(added, null, 1) + '\n');
console.log(`${added.length} classes`);
