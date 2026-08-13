import test from 'node:test';
import assert from 'node:assert/strict';

import { buildRpcUrl, createRpcClient, createSupabaseRestClient, numericIdFromInsertResponse, parseRpcResponseText, SUPABASE_KEY, SUPABASE_URL } from '../src/supabase-api.js';

test('buildRpcUrl trims trailing slash and encodes RPC function names', () => {
  assert.equal(
    buildRpcUrl('verify lock/pin', 'https://example.supabase.co/'),
    'https://example.supabase.co/rest/v1/rpc/verify%20lock%2Fpin'
  );
});

test('parseRpcResponseText returns null for empty RPC responses', () => {
  assert.equal(parseRpcResponseText(''), null);
  assert.deepEqual(parseRpcResponseText('{"ok":true}'), { ok: true });
});

test('Supabase transport rejects oversized responses and unsafe resource paths', async () => {
  assert.throws(() => parseRpcResponseText('x'.repeat(1_000_001)), /too large/);
  const client = createSupabaseRestClient({ fetcher: async () => ({ ok: true, status: 200, statusText: 'OK', text: async () => '[]' }) });
  assert.throws(() => client.from('../photos'), /Invalid table name/);
  assert.throws(() => client.storage.from('../photos'), /Invalid storage bucket/);
  const storage = client.storage.from('photos');
  assert.throws(() => storage.getPublicUrl('../secret'), /Invalid storage path/);
  assert.deepEqual(await storage.upload('folder/../secret', new Blob(['x'])), {
    data: null,
    error: { code: 'STORAGE_ERROR', message: 'Invalid storage path' },
  });
});

test('Supabase transport bounds untrusted error text', async () => {
  const client = createSupabaseRestClient({
    fetcher: async () => ({ ok: false, status: 500, statusText: 'Error', text: async () => '<img onerror=alert(1)>' + 'x'.repeat(10_000) }),
  });
  const result = await client.from('photos').select();
  assert.equal(result.error.code, 'FETCH_ERROR');
  assert.equal(result.error.message.startsWith('500: <img onerror=alert(1)>'), true);
  assert.equal(result.error.message.length <= 4005, true);
});

test('numericIdFromInsertResponse validates inserted record IDs', () => {
  assert.equal(numericIdFromInsertResponse({ id: 7 }), 7);
  assert.equal(numericIdFromInsertResponse({ id: '7' }), null);
  assert.equal(numericIdFromInsertResponse({ id: Number.NaN }), null);
  assert.equal(numericIdFromInsertResponse([]), null);
  assert.equal(numericIdFromInsertResponse(null), null);
});

test('createRpcClient sends Supabase RPC requests with auth headers and JSON body', async () => {
  const calls = [];
  const rpc = createRpcClient({
    supabaseUrl: 'https://example.supabase.co/',
    supabaseKey: 'test-key',
    fetcher: async (url, init) => {
      calls.push({ url, init });
      return { ok: true, statusText: 'OK', text: async () => '{"valid":true}' };
    },
  });

  const result = await rpc('verify_lock_pin', { attempt: '1234' });

  assert.deepEqual(result, { valid: true });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://example.supabase.co/rest/v1/rpc/verify_lock_pin');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers.apikey, 'test-key');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer test-key');
  assert.equal(calls[0].init.headers['Content-Type'], 'application/json');
  assert.equal(calls[0].init.body, '{"attempt":"1234"}');
});

test('createRpcClient raises Supabase error text before status text', async () => {
  const rpc = createRpcClient({
    fetcher: async () => ({ ok: false, statusText: 'Bad Request', text: async () => 'rpc failed' }),
  });

  await assert.rejects(() => rpc('verify_lock_pin', { attempt: '0000' }), /rpc failed/);
});

test('createSupabaseRestClient виконує select-фільтри й повертає single', async () => {
  const calls = [];
  const client = createSupabaseRestClient({
    supabaseUrl: 'https://example.supabase.co/',
    supabaseKey: 'test-key',
    fetcher: async (url, init) => {
      calls.push({ url, init });
      return { ok: true, status: 200, statusText: 'OK', text: async () => '[{"id":7}]' };
    },
  });
  const result = await client.from('photos').select('id,url').eq('month_key', '2026-7').order('id', { ascending: false }).limit(1).single();
  assert.deepEqual(result, { data: { id: 7 }, error: null });
  assert.equal(calls[0].url, 'https://example.supabase.co/rest/v1/photos?month_key=eq.2026-7&order=id.desc&limit=1&select=id,url');
  assert.equal(calls[0].init.headers.apikey, 'test-key');
});

test('createSupabaseRestClient обмежує записи діапазоном дат', async () => {
  const calls = [];
  const client = createSupabaseRestClient({ supabaseUrl:'https://example.supabase.co', fetcher:async (url,init)=>{calls.push({url,init});return {ok:true,status:200,statusText:'OK',text:async()=> '[]'};} });
  await client.from('completed_work').select('id,work_date').gte('work_date','2026-08-01').lte('work_date','2026-08-31');
  assert.equal(calls[0].url,'https://example.supabase.co/rest/v1/completed_work?work_date=gte.2026-08-01&work_date=lte.2026-08-31&select=id,work_date');
});

test('createSupabaseRestClient підтримує maybeSingle для необовʼязкових налаштувань', async () => {
  const client = createSupabaseRestClient({
    fetcher: async () => ({ ok: true, status: 200, statusText: 'OK', text: async () => '[]' }),
  });
  assert.deepEqual(await client.from('work_shift_settings').select('*').eq('id', 1).maybeSingle(), {
    data: null,
    error: null,
  });
  assert.deepEqual(await client.from('work_shift_settings').select('*').eq('id', 1).single(), {
    data: null,
    error: { code: 'PGRST116' },
  });
});

test('createSupabaseRestClient підтримує upsert, RPC і storage', async () => {
  const calls = [];
  const client = createSupabaseRestClient({
    supabaseUrl: 'https://example.supabase.co',
    supabaseKey: 'test-key',
    fetcher: async (url, init) => {
      calls.push({ url, init });
      return { ok: true, status: 200, statusText: 'OK', text: async () => url.includes('/rpc/') ? 'true' : '[]' };
    },
  });
  await client.from('dispatcher').upsert({ month_key: '2026-7', data: {} });
  assert.equal(await client.rpc('verify_lock_pin', { attempt: '1234' }), true);
  const storage = client.storage.from('photos');
  assert.equal(storage.getPublicUrl('folder/a.jpg').data.publicUrl, 'https://example.supabase.co/storage/v1/object/public/photos/folder/a.jpg');
  assert.deepEqual(await storage.upload('folder/a.jpg', new Blob(['photo']), { contentType: 'image/jpeg' }), {
    data: { path: 'folder/a.jpg' },
    error: null,
  });
  await storage.remove(['folder/a.jpg']);
  assert.equal(calls[0].init.headers.Prefer, 'resolution=merge-duplicates,return=representation');
  assert.equal(calls[1].url, 'https://example.supabase.co/rest/v1/rpc/verify_lock_pin');
  assert.equal(calls[2].init.headers['x-upsert'], 'true');
  assert.equal(calls[3].init.body, '{"prefixes":["folder/a.jpg"]}');
});

test('storage upload повертає структуровану помилку без rejected promise', async () => {
  const client = createSupabaseRestClient({
    fetcher: async () => ({ ok: false, status: 404, statusText: 'Not Found', text: async () => 'Bucket not found' }),
  });

  assert.deepEqual(await client.storage.from('photos').upload('items/a.jpg', new Blob(['photo']), { upsert: false }), {
    data: null,
    error: { code: 'STORAGE_ERROR', message: '404: Bucket not found' },
  });
});

test('createSupabaseRestClient виконує update через PATCH з фільтром', async () => {
  const calls = [];
  const client = createSupabaseRestClient({
    supabaseUrl: 'https://example.supabase.co',
    supabaseKey: 'test-key',
    fetcher: async (url, init) => {
      calls.push({ url, init });
      return { ok: true, status: 200, statusText: 'OK', text: async () => '[{"id":7,"quantity":4}]' };
    },
  });

  const result = await client.from('inventory_items').update({ quantity: 4 }).eq('id', 7);

  assert.deepEqual(result, { data: [{ id: 7, quantity: 4 }], error: null });
  assert.equal(calls[0].url, 'https://example.supabase.co/rest/v1/inventory_items?id=eq.7');
  assert.equal(calls[0].init.method, 'PATCH');
  assert.equal(calls[0].init.headers.Prefer, 'return=representation');
  assert.equal(calls[0].init.body, '{"quantity":4}');
});

test('rpcResult повертає Supabase-сумісний результат для Sklad flows', async () => {
  const successClient = createSupabaseRestClient({
    fetcher: async () => ({ ok: true, status: 200, statusText: 'OK', text: async () => '[{"new_quantity":3}]' }),
  });
  assert.deepEqual(await successClient.rpcResult('issue_item', {
    p_item_id: 7,
    p_qty: 2,
    p_person: 'Іван',
  }), {
    data: [{ new_quantity: 3 }],
    error: null,
  });

  const failedClient = createSupabaseRestClient({
    fetcher: async () => ({ ok: false, status: 409, statusText: 'Conflict', text: async () => 'insufficient_stock' }),
  });
  assert.deepEqual(await failedClient.rpcResult('issue_item', {
    p_item_id: 7,
    p_qty: 20,
    p_person: 'Іван',
  }), {
    data: null,
    error: { code: 'FETCH_ERROR', message: '409: insufficient_stock' },
  });
});

test('createSupabaseRestClient повертає структуровану помилку таблиці', async () => {
  const client = createSupabaseRestClient({
    fetcher: async () => ({ ok: false, status: 503, statusText: 'Unavailable', text: async () => 'offline' }),
  });
  assert.deepEqual(await client.from('photos').select(), {
    data: null,
    error: { code: 'FETCH_ERROR', message: '503: offline' },
  });
});

test('default Supabase constants stay browser-safe publishable values', () => {
  assert.equal(SUPABASE_URL, 'https://vkwkyhjjjmcpmiakxohw.supabase.co');
  assert.equal(SUPABASE_KEY.startsWith('sb_publishable_'), true);
});
