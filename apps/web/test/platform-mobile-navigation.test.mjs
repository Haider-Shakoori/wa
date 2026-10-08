import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read=(path)=>readFile(new URL(path,import.meta.url),'utf8');

test('platform mobile drawer exposes all navigation groups without hiding sections',async()=>{
  const page=await read('../app/platform/page.tsx');
  for(const section of ['Operations','Commercial','System','Overview','Clients','Sessions','Subscriptions','Security','Administrators','Diagnostics']){
    assert.ok(page.includes(section),section);
  }
  assert.match(page,/aria-controls="platform-admin-navigation"/);
  assert.match(page,/aria-expanded=\{mobileNavOpen\}/);
  assert.match(page,/aria-label="Close platform navigation"/);
  assert.match(page,/mobileNavCloseRef/);
  assert.match(page,/event\.key==='Escape'/);
  assert.match(page,/setActive\(item\);setMobileNavOpen\(false\)/);
});
test('mobile drawer overrides legacy cramped bottom navigation, has full scrolling and safe areas',async()=>{
  const css=await read('../app/globals.css');
  assert.match(css,/@media\(max-width:900px\)/);
  assert.match(css,/platform-admin-sidebar-open/);
  assert.match(css,/platform-mobile-menu-toggle/);
  assert.match(css,/platform-mobile-menu-backdrop/);
  assert.match(css,/100dvh/);
  assert.match(css,/safe-area-inset-bottom/);
  assert.match(css,/overscroll-behavior:contain/);
  assert.match(css,/prefers-reduced-motion/);
});
