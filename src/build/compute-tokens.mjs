import { hexToRgb, rgbToHex, rgbString, mix, tint, shade, contrastRatio, colorContrast, accessibleShade, WHITE } from './color-math.mjs';

/** Every colour role the outputs need, for light and dark. All values are hex strings. */
// Bootstrap gives .text-light-emphasis / .text-dark-emphasis fixed grays ($gray-100/300/700), not derived shades
const FIXED_EMPHASIS = { light: { light: '#495057', dark: '#F8F9FA' }, dark: { light: '#495057', dark: '#DEE2E6' } };

/** opts.group: a department colour (keeps v1's accessible emphasis); opts.name: Bootstrap special-cases `light` and `dark`. */
export function computeColor(hex, d, { name = '', group = false } = {}) {
  const c = hexToRgb(hex);
  const fg = { light: hexToRgb(d['color-contrast-light']), dark: hexToRgb(d['color-contrast-dark']), min: d['min-contrast-ratio'] };
  const onBase = colorContrast(c, fg);
  // light text on this colour -> states get darker; Bootstrap hard-codes shade for .btn-light and tint for .btn-dark
  const lightOnColor = name === 'light' ? true : name === 'dark' ? false : onBase === fg.light;
  const H = rgbToHex;

  const tb = name === 'light' || name === 'dark' ? c : tint(c, 80); // Bootstrap $table-variants use the colour itself for these two
  const tc = colorContrast(tb, fg);
  // emphasis keeps v1 behaviour (parity): Bootstrap default shade, or the v1 accessible shade when white-on-colour fails AA
  // v1 applied the accessible-shade fix to group colours only; system/status colours kept Bootstrap's shade
  const emphasis = group && contrastRatio(c, WHITE) < fg.min
    ? accessibleShade(c, WHITE, fg.min, { start: d['accessible-shade-start'] }).rgb
    : shade(c, d['light-emphasis-shade-weight']);

  // body-text link: v1 used the colour itself, or its accessible shade when it fails AA on white (kept as is for parity)
  const link = contrastRatio(c, WHITE) >= fg.min ? c : emphasis;
  // Emphasis text sits on the subtle background (light) and on the subtle background AND the page (dark), so it has to
  // pass there. v1 never checked (decision Q16): step the colour darker/lighter until it does.
  const subtleRgb = tint(c, d['subtle-bg-tint-weight']);
  const darkSubtleRgb = shade(c, d['subtle-bg-shade-weight']);
  const surface = hexToRgb(d['dark-surface']);
  const fit = (start, passes, move) => { for (let w = 0; w <= 100; w += 5) { const e = move(start, w); if (passes(e)) return e; } return move(start, 100); };
  const fixed = FIXED_EMPHASIS[name];
  const lightEmphasis = fixed ? hexToRgb(fixed.light) : fit(emphasis, (e) => contrastRatio(e, subtleRgb) >= fg.min, shade);
  const darkStart = tint(c, d['dark-emphasis-tint-weight']);
  const darkEmphasis = fixed ? hexToRgb(fixed.dark) : fit(darkStart, (e) => contrastRatio(e, darkSubtleRgb) >= fg.min && contrastRatio(e, surface) >= fg.min, tint);
  const darkLink = tint(c, d['dark-emphasis-tint-weight']);

  const light = {
    base: hex.toUpperCase(),
    rgb: rgbString(c),
    contrast: H(onBase),
    hoverContrast: H(colorContrast(lightOnColor ? shade(c, 15) : tint(c, 15), fg)), // Bootstrap picks text from the state background
    activeContrast: H(colorContrast(lightOnColor ? shade(c, 20) : tint(c, 20), fg)),
    hoverBg: H(lightOnColor ? shade(c, 15) : tint(c, 15)),
    hoverBorder: H(lightOnColor ? shade(c, 20) : tint(c, 10)),
    activeBg: H(lightOnColor ? shade(c, 20) : tint(c, 20)),
    activeBorder: H(lightOnColor ? shade(c, 25) : tint(c, 10)),
    focusRgb: rgbString(mix(onBase, c, 15)),
    focusBorder: H(tint(c, 50)),
    subtle: H(tint(c, d['subtle-bg-tint-weight'])),
    borderSubtle: H(tint(c, d['subtle-border-tint-weight'])),
    faint: H(tint(c, d['faint-bg-tint-weight'])),
    faintBorder: H(tint(c, d['faint-border-tint-weight'])),
    shaded: H(shade(c, d['shaded-bg-shade-weight'])),
    shadedBorder: H(shade(c, d['shaded-border-shade-weight'])),
    body: H(tint(c, d['body-bg-tint-weight'])),
    bodyBorder: H(tint(c, d['body-border-tint-weight'])),
    emphasis: H(lightEmphasis),
    link: H(link),
    linkRgb: rgbString(link),
    linkHover: H(shade(link, 20)),
    linkHoverRgb: rgbString(shade(link, 20)),
    linkFocusRgb: rgbString(mix(colorContrast(link, fg), link, 15)),
    linkHelperHover: H(lightOnColor ? shade(c, 20) : tint(c, 20)), // Bootstrap .link-<colour>:hover
    linkHelperHoverRgb: rgbString(lightOnColor ? shade(c, 20) : tint(c, 20)),
    rangeActive: H(tint(c, 70)),
    text: H(accessibleShade(c, WHITE, fg.min).rgb), // new in v2: minimal darkening that passes AA on white
    tableBg: H(tb),
    tableColor: H(tc),
    tableBorder: H(mix(tc, tb, 20)),
    tableStriped: H(mix(tc, tb, 5)),
    tableActive: H(mix(tc, tb, 10)),
    tableHover: H(mix(tc, tb, 7.5)),
  };
  const dark = {
    subtle: H(shade(c, d['subtle-bg-shade-weight'])),
    borderSubtle: H(shade(c, d['subtle-border-shade-weight'])),
    faint: H(shade(c, d['faint-bg-shade-weight'])),
    faintBorder: H(shade(c, d['faint-border-shade-weight'])),
    body: H(shade(c, d['body-bg-shade-weight'])),
    bodyBorder: H(shade(c, d['body-border-shade-weight'])),
    emphasis: H(darkEmphasis),
    link: H(darkLink),
    linkRgb: rgbString(darkLink),
    linkHover: H(tint(darkLink, 20)),
    linkHoverRgb: rgbString(tint(darkLink, 20)),
  };
  return { light, dark };
}

export function computeAll({ groups, system, status, design }) {
  const colors = {};
  for (const [slug, g] of Object.entries(groups)) {
    const base = groups[`${slug.replace(/-[0-9a-z]+$/, '')}-0`]?.hex ?? g.hex; // department base colour
    const bc = hexToRgb(base);
    colors[slug] = { kind: 'group', ...computeColor(g.hex, design, { group: true, name: 'primary' }), baseBg: { light: rgbToHex(tint(bc, design['base-bg-tint-strength'])), dark: rgbToHex(shade(bc, design['base-bg-shade-strength'])) } };
  }
  for (const [name, hex] of Object.entries(system)) colors[name] = { kind: 'system', ...computeColor(hex, design, { name }) };
  for (const [n, s] of Object.entries(status)) colors[`status-${n}`] = { kind: 'status', ...computeColor(s.hex, design, { name: `status-${n}` }) };
  return colors;
}
