import test from 'node:test';
import assert from 'node:assert/strict';

import { buildRpcUrl, createRpcClient, createSupabaseRestClient, parseRpcResponseText, SUPABASE_KEY, SUPABASE_URL } from '../src/supabase-api.js';

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
  await storage.upload('folder/a.jpg', new Blob(['photo']), { contentType: 'image/jpeg' });
  await storage.remove(['folder/a.jpg']);
  assert.equal(calls[0].init.headers.Prefer, 'resolution=merge-duplicates,return=representation');
  assert.equal(calls[1].url, 'https://example.supabase.co/rest/v1/rpc/verify_lock_pin');
  assert.equal(calls[2].init.headers['x-upsert'], 'true');
  assert.equal(calls[3].init.body, '{"prefixes":["folder/a.jpg"]}');
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
