import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

/**
 * package.json gốc không khai `type` nên Node coi mọi file .js là CommonJS.
 * Thiếu marker {"type":"module"} thì bản build ESM sẽ bị đọc nhầm thành CommonJS
 * và ném `Cannot use import statement outside a module`.
 */
const writeMarker = async (directory, type) => {
  const target = fileURLToPath(
    new URL(`../dist/${directory}/package.json`, import.meta.url),
  );
  await writeFile(target, `${JSON.stringify({ type }, null, 2)}\n`, 'utf8');
};

await Promise.all([
  writeMarker('cjs', 'commonjs'),
  writeMarker('esm', 'module'),
]);
