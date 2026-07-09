// Supabase Edge Function: пересилає текстове повідомлення в Telegram.
//
// Мета: тримати TELEGRAM_BOT_TOKEN у секретах на сервері, щоб він ніколи
// не потрапляв у публічний клієнтський код (sklad/index.html). Клієнт шле
// сюди лише готовий текст повідомлення — сама функція викликає Telegram
// Bot API з токеном, якого клієнт ніколи не бачить.
//
// Деплой (виконати один раз, з Supabase CLI, увійшовши в акаунт):
//   supabase functions deploy notify-telegram --project-ref vkwkyhjjjmcpmiakxohw --no-verify-jwt
//
// Секрети (замініть на свої реальні токен і chat_id від @BotFather / бота):
//   supabase secrets set TELEGRAM_BOT_TOKEN=xxxxxxxxxx:yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy --project-ref vkwkyhjjjmcpmiakxohw
//   supabase secrets set TELEGRAM_CHAT_ID=123456789 --project-ref vkwkyhjjjmcpmiakxohw
//
// Примітка: --no-verify-jwt потрібен тому, що клієнт використовує новий формат
// ключів Supabase (sb_publishable_...), який не є JWT і не пройде стандартну
// перевірку Supabase Edge Functions.

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const token = Deno.env.get('TELEGRAM_BOT_TOKEN');
  const chatId = Deno.env.get('TELEGRAM_CHAT_ID');
  if (!token || !chatId) {
    return json({ error: 'Telegram is not configured (missing secrets)' }, 500);
  }

  let text = '';
  try {
    const raw = await req.text();
    const body = raw ? JSON.parse(raw) : {};
    text = typeof body?.text === 'string' ? body.text.trim() : '';
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  if (!text) return json({ error: 'text is required' }, 400);
  if (text.length > 4000) text = text.slice(0, 4000);

  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    const tgData = await tgRes.json();
    if (!tgRes.ok || !tgData.ok) {
      return json({ error: tgData.description || 'Telegram API error' }, 502);
    }
    return json({ ok: true });
  } catch (e) {
    return json({ error: String(e) }, 502);
  }
});
