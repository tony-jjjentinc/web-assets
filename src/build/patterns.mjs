import fs from 'node:fs';

export const PATTERN_SRC = 'assets/images/source/patterns';

/** Patterns = every svg in the source directory; tokens/patterns.json only adds display settings (size, repeat). */
export function listPatterns(settings, dir = PATTERN_SRC) {
  return fs.readdirSync(dir).filter((f) => f.endsWith('.svg')).sort().map((f) => {
    const name = f.replace(/\.svg$/, '');
    return { name, size: settings[name]?.['background-size'], repeat: settings[name]?.['background-repeat'] ?? 'repeat' };
  });
}
