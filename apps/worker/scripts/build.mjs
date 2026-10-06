import { cp, mkdir, rm } from 'node:fs/promises';

const source = new URL('../src/', import.meta.url);
const dist = new URL('../dist/', import.meta.url);

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(source, dist, { recursive: true });
