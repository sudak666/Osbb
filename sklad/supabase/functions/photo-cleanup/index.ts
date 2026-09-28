// Supabase Edge Function: видаляє з бакета photos файли, на які вже ніщо не
// посилається (див. sklad/supabase/034_photo_orphans.sql).
//
// Без авторизації навмисно: функція видаляє лише «сиріт», яких база вже не
// використовує, і не приймає від клієнта жодних імен файлів. Клієнт викликає
// її після видалення/заміни фото (fire-and-forget).
//
// Деплой: supabase functions deploy photo-cleanup --project-ref vkwkyhjjjmcpmiakxohw --no-verify-jwt

// Модуль, а не скрипт: інакше tsc у CI бачить CORS_HEADERS/json з jira-issues у тому ж глобальному просторі.
export {};

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = (Deno.env.get('SUPABASE_URL') || '').replace(/\/$/, '');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!supabaseUrl || !serviceKey) return json({ error: 'Server misconfigured' }, 500);

  let dryRun = false;
  try {
    const body: unknown = await req.json();
    dryRun = typeof body === 'object' && body !== null && (body as Record<string, unknown>).dryRun === true;
  } catch {
    dryRun = false;
  }

  const auth = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };
  const orphansResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/photo_orphans`, {
    method: 'POST', headers: auth, body: JSON.stringify({ p_min_age_minutes: 10 }),
  });
  if (!orphansResponse.ok) return json({ error: 'orphan lookup failed', status: orphansResponse.status }, 502);
  const orphans: unknown = await orphansResponse.json();
  const names = Array.isArray(orphans) ? orphans.filter((name): name is string => typeof name === 'string' && name.length > 0 && !name.includes('..')) : [];
  if (dryRun || !names.length) return json({ ok: true, dryRun, names });

  const removeResponse = await fetch(`${supabaseUrl}/storage/v1/object/photos`, {
    method: 'DELETE', headers: auth, body: JSON.stringify({ prefixes: names }),
  });
  if (!removeResponse.ok) return json({ error: 'storage delete failed', status: removeResponse.status }, 502);
  return json({ ok: true, deleted: names.length });
});
