import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('.benchmark-dist', { recursive: true });
await writeFile('.benchmark-dist/package.json', '{"type":"commonjs"}\n', 'utf8');
