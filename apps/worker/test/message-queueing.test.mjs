import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('worker starts direct dispatch instead of an outbound queue',async()=>{
 const source=await readFile(new URL('../src/index.js',import.meta.url),'utf8');
 assert.match(source,/startDirectDispatch/);assert.doesNotMatch(source,/createMessageQueue|pumpReadyMessages|redisUrl/);
});
