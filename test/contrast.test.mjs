import { describe, it, expect } from 'vitest';
import { checkContrast } from '../src/build/contrast.mjs';
import { validateAll } from '../src/build/validate.mjs';

const design = { 'min-contrast-ratio': 4.5, 'dark-surface': '#000000' };
const colors = { c: { light: { contrast: '#777777', hoverContrast: '#FFFFFF', activeContrast: '#FFFFFF', base: '#FFFFFF', hoverBg: '#000000', activeBg: '#000000', emphasis: '#000000', subtle: '#FFFFFF', text: '#000000' }, dark: { emphasis: '#FFFFFF', subtle: '#000000' } } };

describe('contrast gate', () => {
  it('blocks a failing pairing', () => expect(checkContrast(colors, design).blocking.map((f) => f.id)).toContain('c:contrast-on-base'));
  it('allows a listed failure until it expires', () => {
    const allow = { 'c:contrast-on-base': { reason: 'x', expires: '2030-01-01' } };
    expect(checkContrast(colors, design, allow, new Date('2029-01-01')).blocking).toEqual([]);
    expect(checkContrast(colors, design, allow, new Date('2031-01-01')).expired).toHaveLength(1);
  });
  it('flags allow-list entries that are no longer needed', () => expect(checkContrast(colors, design, { 'c:gone': { reason: 'x', expires: '2030-01-01' } }).stale).toEqual(['c:gone']));
  it('the real tokens pass with the committed allow-list', () => expect(() => validateAll()).not.toThrow());
});
