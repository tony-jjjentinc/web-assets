import fs from 'node:fs';
import Ajv from 'ajv/dist/2020.js';

const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));

/** Load and schema-validate tokens/*.json. Throws with every problem listed. */
export function loadTokens(dir = 'tokens') {
  const ajv = new Ajv({ allErrors: true });
  const out = {};
  const errors = [];
  for (const name of ['groups', 'system', 'status', 'design', 'patterns', 'loaders']) {
    out[name] = read(`${dir}/${name}.json`);
    const validate = ajv.compile(read(`${dir}/schema/${name}.schema.json`));
    if (!validate(out[name])) for (const e of validate.errors) errors.push(`${name}.json ${e.instancePath} ${e.message}`);
  }
  for (const [slug, g] of Object.entries(out.groups ?? {})) {
    if (g.aliasOf && !out.groups[g.aliasOf]) errors.push(`groups.json ${slug}: aliasOf "${g.aliasOf}" does not exist`);
  }
  if (errors.length) throw new Error('Invalid tokens:\n  ' + errors.join('\n  '));
  return out;
}
