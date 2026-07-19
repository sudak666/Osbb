import test from 'node:test';
import assert from 'node:assert/strict';

import { buildRpcUrl, createRpcClient, parseRpcResponseText, SUPABASE_KEY, SUPABASE_URL } from '../src/supabase-api.js';

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

test('default Supabase constants stay browser-safe publishable values', () => {
  assert.equal(SUPABASE_URL, 'https://vkwkyhjjjmcpmiakxohw.supabase.co');
  assert.equal(SUPABASE_KEY.startsWith('sb_publishable_'), true);
});
