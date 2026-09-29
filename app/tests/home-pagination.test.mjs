// Run with: node --test tests/home-pagination.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../src/pages/HomePage.vue', import.meta.url), 'utf8')
  .match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1];
const compiled = ts.transpileModule(source + '\nglobalThis.page = { state, load, loadMore, changeOrdering, loadTrigger, allSelected };', {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const flush = () => new Promise(resolve => setImmediate(resolve));
const items = (start, count) => Array.from({ length: count }, (_, i) => ({ key: `key:${start + i}`, size: 1, ttl: -1, type: 'string' }));

function mount() {
  const requests = [], watches = [], mounted = [], unmounted = [], timers = new Map();
  const store = { state: { server: 'first', database: 0, updateInterval: -1 } };
  let observer;
  const request = (transport, args) => new Promise((resolve, reject) => requests.push({
    transport, args, reject,
    resolve: page => resolve(transport === 'http' ? { response: { ok: true }, data: page } : page)
  }));
  const modules = {
    vue: {
      reactive: value => value, ref: value => ({ value }), computed: value => value,
      nextTick: () => Promise.resolve(),
      watch: (source, callback, options) => { watches.push(callback); if (options?.immediate) callback(source()); },
      onMounted: callback => mounted.push(callback), onBeforeUnmount: callback => unmounted.push(callback)
    },
    '@/store': { store },
    '@/uses/api': { useApi: () => ({ endpoints: { getEntries: (...args) => request('http', args) } }) },
    '@/uses/websocket': { useWebsocket: () => ({ request: (...args) => request('ws', args) }) }
  };
  const context = vm.createContext({
    exports: {}, require: name => modules[name],
    window: { innerHeight: 800, setInterval: callback => { const id = timers.size + 1; timers.set(id, callback); return id; } },
    clearInterval: id => timers.delete(id),
    IntersectionObserver: class {
      constructor(callback) { observer = { callback, disconnected: false }; }
      observe() {}
      disconnect() { observer.disconnected = true; }
    }
  });
  vm.runInContext(compiled, context);
  context.page.loadTrigger.value = { getBoundingClientRect: () => ({ top: 5000 }) };
  mounted.forEach(callback => callback());
  return { ...context.page, store, requests, watches, timers, observer, unmount: () => unmounted.forEach(callback => callback()) };
}

test('scroll loads 500-key pages, prevents concurrent loads, retries and stops at the end', async () => {
  const page = mount();
  assert.equal(page.requests.length, 1);
  assert.equal(page.requests[0].args[4], 0);
  page.requests[0].resolve({ items: items(0, 500), has_more: true });
  await flush();
  page.observer.callback([{ isIntersecting: true }]);
  page.observer.callback([{ isIntersecting: true }]);
  assert.equal(page.requests.length, 2);
  assert.equal(page.requests[1].args[4], 500);
  page.requests[1].reject(new Error('Network failure'));
  await flush();
  assert.equal(page.state.items.length, 500);
  assert.ok(page.state.error);
  const retry = page.loadMore();
  assert.equal(page.requests[2].args[4], 500);
  page.requests[2].resolve({ items: [...items(499, 1), ...items(500, 2)], has_more: false });
  await retry;
  assert.equal(page.state.items.length, 502);
  await page.loadMore();
  assert.equal(page.requests.length, 3);
  page.unmount();
  assert.equal(page.observer.disconnected, true);
});

test('search, sorting and database changes discard stale responses and reset selection', async () => {
  const page = mount();
  page.state.selected = ['old'];
  page.state.pattern = 'new:*';
  page.load();
  page.requests[1].resolve({ items: items(10, 1), has_more: false });
  await flush();
  page.requests[0].resolve({ items: items(0, 500), has_more: true });
  await flush();
  assert.equal(page.state.items[0].key, 'key:10');
  assert.equal(page.state.selected.length, 0);
  assert.equal(page.requests[1].args[2], 'new:*');
  page.changeOrdering('size');
  assert.equal(page.requests[2].args[3], 'size:asc');
  page.store.state.database = 1;
  page.watches[0]();
  assert.equal(page.requests[3].args[1], 1);
  assert.equal(page.requests[3].args[4], 0);
  page.requests[2].reject(new Error('Stale failure'));
  page.requests[3].resolve({ items: [], has_more: false });
  await flush();
  assert.equal(page.state.error, '');
  assert.equal(page.allSelected.get(), false);
  page.unmount();
});

test('autorefresh replaces only loaded pages using batches of 500 and can be disabled', async () => {
  const page = mount();
  page.requests[0].resolve({ items: items(0, 500), has_more: true });
  await flush();
  const more = page.loadMore();
  page.requests[1].resolve({ items: items(500, 500), has_more: true });
  await more;
  page.state.pattern = 'unsubmitted';
  page.watches[1](1000);
  page.timers.values().next().value();
  assert.equal(page.requests[2].transport, 'ws');
  assert.equal(page.requests[2].args[1].limit, 500);
  assert.equal(page.requests[2].args[1].pattern, '*');
  page.requests[2].resolve({ items: items(1000, 500), has_more: true });
  await flush();
  assert.equal(page.requests[3].args[1].offset, 500);
  assert.equal(page.state.items[0].key, 'key:0');
  page.requests[3].resolve({ items: items(1500, 500), has_more: true });
  await flush();
  assert.equal(page.state.items.length, 1000);
  assert.equal(page.state.items[0].key, 'key:1000');
  assert.equal(page.requests.length, 4);
  page.watches[1](-1);
  assert.equal(page.timers.size, 0);
  page.unmount();
});
