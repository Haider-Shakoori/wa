import { existsSync, lstatSync, readlinkSync, readdirSync, realpathSync, rmSync, symlinkSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

/**
 * Next standalone output created by pnpm can contain absolute symlinks to
 * the GitHub runner's workspace. Rewrite links only when they point INSIDE
 * the supplied standalone tree, then validate every link remains within it.
 */
export function rebaseStandaloneLinks(sourceStandaloneRoot, releaseStandaloneRoot) {
  const source = resolve(sourceStandaloneRoot);
  const target = resolve(releaseStandaloneRoot);
  let updated = 0;
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isSymbolicLink()) {
        const value = readlinkSync(path);
        if (isAbsolute(value)) {
          if (value !== source && !value.startsWith(source + sep)) {
            throw new Error('Standalone symlink points outside Next build: ' + relative(target, path));
          }
          const destination = join(target, relative(source, value));
          const newLink = relative(dirname(path), destination);
          rmSync(path);
          symlinkSync(newLink, path);
          updated += 1;
        }
        const resolved = resolve(dirname(path), readlinkSync(path));
        if (!resolved.startsWith(target + sep) && resolved !== target) {
          throw new Error('Standalone symlink escapes release: ' + relative(target, path));
        }
        if (!existsSync(path)) {
          throw new Error('Standalone symlink target missing: ' + relative(target, path));
        }
      } else if (entry.isDirectory()) {
        walk(path);
      }
    }
  }
  walk(target);
  return updated;
}
