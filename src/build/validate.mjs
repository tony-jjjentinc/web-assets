import fs from 'node:fs';
import { loadTokens } from './tokens-io.mjs';
import { computeAll } from './compute-tokens.mjs';
import { checkContrast } from './contrast.mjs';

/** Validate tokens + contrast. Returns { tokens, colors, report }; throws on any blocking problem. */
export function validateAll(dir = 'tokens') {
  const tokens = loadTokens(dir);
  const colors = computeAll(tokens);
  const allow = fs.existsSync(`${dir}/contrast-allow.json`) ? JSON.parse(fs.readFileSync(`${dir}/contrast-allow.json`, 'utf8')) : {};
  const report = checkContrast(colors, tokens.design, allow);
  const problems = [
    ...report.blocking.map((f) => `contrast ${f.id} = ${f.ratio}:1 (< ${f.min})`),
    ...report.expired.map((f) => `contrast allow-list entry expired ${f.expires}: ${f.id} (${f.reason})`),
    ...report.stale.map((id) => `contrast allow-list entry no longer needed, remove it: ${id}`),
  ];
  if (problems.length) throw new Error(`${problems.length} problem(s):\n  ` + problems.join('\n  '));
  return { tokens, colors, report };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const { colors, report } = validateAll();
    console.log(`OK: ${Object.keys(colors).length} colours, ${report.allowed.length} allow-listed contrast exceptions`);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
