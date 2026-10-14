import { hexToRgb, contrastRatio } from './color-math.mjs';

/** Check every colour role pairing the outputs rely on. Returns failures not covered by an unexpired allow-list entry. */
export function checkContrast(colors, design, allow = {}, today = new Date()) {
  const min = design['min-contrast-ratio'];
  const failures = [];
  const ratio = (a, b) => contrastRatio(hexToRgb(a), hexToRgb(b));
  const check = (name, pair, a, b) => {
    const r = ratio(a, b);
    if (r < min) failures.push({ id: `${name}:${pair}`, ratio: +r.toFixed(2), min });
  };
  for (const [name, { light: l, dark: dk }] of Object.entries(colors)) {
    check(name, 'contrast-on-base', l.contrast, l.base);
    check(name, 'contrast-on-hover', l.hoverContrast, l.hoverBg);
    check(name, 'contrast-on-active', l.activeContrast, l.activeBg);
    check(name, 'emphasis-on-subtle', l.emphasis, l.subtle);
    check(name, 'text-on-white', l.text, '#FFFFFF');
    check(name, 'dark-emphasis-on-dark-subtle', dk.emphasis, dk.subtle);
    check(name, 'dark-emphasis-on-dark-surface', dk.emphasis, design['dark-surface']);
  }
  const blocking = [], allowed = [], expired = [];
  for (const f of failures) {
    const a = allow[f.id];
    if (!a) blocking.push(f);
    else if (new Date(a.expires) < today) expired.push({ ...f, reason: a.reason, expires: a.expires });
    else allowed.push(f);
  }
  const stale = Object.keys(allow).filter((id) => !failures.some((f) => f.id === id)); // fixed since: remove the entry
  return { blocking, allowed, expired, stale, total: failures.length };
}
