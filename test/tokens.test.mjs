import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { loadTokens } from '../src/build/tokens-io.mjs';

const golden = JSON.parse(fs.readFileSync('test/fixtures/v1-golden.json', 'utf8'));
const { groups } = loadTokens();

describe('tokens', () => {
  it('schemas pass', () => expect(() => loadTokens()).not.toThrow());
  it('every v1 group maps to exactly one v2 slug with the same hex', () => {
    const byLegacy = Object.fromEntries(Object.entries(groups).map(([slug, g]) => [g.legacyId, [slug, g.hex]]));
    expect(Object.keys(byLegacy).sort()).toEqual(Object.keys(golden.groups).sort());
    for (const [id, g] of Object.entries(golden.groups)) expect(byLegacy[id][1].toUpperCase()).toBe(g.hex.toUpperCase());
  });
  it('slugs contain no colon', () => expect(Object.keys(groups).every((s) => !s.includes(':'))).toBe(true));
  it('rejects bad input', () => {
    fs.mkdirSync('build/bad/schema', { recursive: true });
    for (const f of fs.readdirSync('tokens/schema')) fs.copyFileSync(`tokens/schema/${f}`, `build/bad/schema/${f}`);
    for (const f of ['groups', 'system', 'status', 'design', 'patterns', 'loaders']) fs.copyFileSync(`tokens/${f}.json`, `build/bad/${f}.json`);
    fs.writeFileSync('build/bad/system.json', JSON.stringify({ success: 'green' }));
    expect(() => loadTokens('build/bad')).toThrow(/system.json/);
  });
});
