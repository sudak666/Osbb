// Supabase Edge Function: ШІ-асистент журналу/складу — відповідає на запитання
// простою мовою, підставляючи актуальні дані з Supabase як контекст для LLM.
//
// Мета: ключ провайдера LLM лишається в секретах на сервері, ніколи не
// потрапляє в клієнтський код (osbb/index.html, sklad/index.html). Клієнт
// шле сюди лише { question, scope } — сама функція читає потрібні таблиці
// сервісним ключем (без RLS-обмежень: це внутрішній інструмент за PIN-екраном,
// той самий рівень довіри, що й решта функцій — fetch-item-prices/notify-telegram).
//
// Це read-only інструмент: асистент лише відповідає на запитання, нічого не
// пише в базу і не створює заявки/записи. Дії з побічними ефектами (створити
// заявку голосом/текстом тощо) — свідомо поза межами цього проходу, бо це
// окрема, значно ризикованіша фіча (підтвердження, захист від помилкової
// інтерпретації наміру) і має розглядатись асистент.
//
// Деплой:
//   supabase functions deploy ai-assistant --project-ref vkwkyhjjjmcpmiakxohw --no-verify-jwt
//
// Секрет (свій ключ від console.anthropic.com):
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-... --project-ref vkwkyhjjjmcpmiakxohw
//
// SUPABASE_URL і SUPABASE_SERVICE_ROLE_KEY Supabase підставляє в кожну Edge
// Function автоматично — окремо задавати не треба.

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_QUESTION_LEN = 400;
const MAX_TOKENS = 500;

type Scope = 'journal' | 'sklad';

interface AssistantRequestBody {
  question?: unknown;
  scope?: unknown;
}

interface AnthropicContentBlock {
  type?: string;
  text?: string;
}

interface AnthropicResponse {
  content?: AnthropicContentBlock[];
  error?: { message?: string };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

async function restSelect(supabaseUrl: string, serviceKey: string, path: string): Promise<unknown> {
  const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  if (!res.ok) throw new Error(`Supabase REST ${path} failed: ${res.status}`);
  return res.json();
}

async function fetchSkladContext(supabaseUrl: string, serviceKey: string): Promise<string> {
  const items = await restSelect(
    supabaseUrl,
    serviceKey,
    'inventory_items?select=name,category,unit,quantity,is_internal&order=quantity.asc&limit=300',
  );
  return [
    'Поточний стан складу ОСББ "Микитська Слобода" (JSON-масив товарів).',
    'quantity — залишок; unit — одиниця виміру; is_internal — товар для внутрішнього використання (хознужди), не входить у баланс складу.',
    JSON.stringify(items),
  ].join('\n');
}

async function fetchJournalContext(supabaseUrl: string, serviceKey: string): Promise<string> {
  const monthKey = currentMonthKey();
  const [scheduleRows, dispatcherRows, garbageRows] = await Promise.all([
    restSelect(supabaseUrl, serviceKey, `schedule?month_key=eq.${monthKey}&select=data`),
    restSelect(supabaseUrl, serviceKey, `dispatcher?month_key=eq.${monthKey}&select=data`),
    restSelect(supabaseUrl, serviceKey, `garbage?month_key=eq.${monthKey}&select=data`),
  ]) as [Array<{ data?: unknown }>, Array<{ data?: unknown }>, Array<{ data?: unknown }>];

  return [
    `Поточний місяць журналу ОСББ "Микитська Слобода": ${monthKey}.`,
    'Графік чергувань (ключ об\'єкта — день місяця; ролі: electrician/janitor/plumber; working — чи вийшов на зміну; tasks — позначені завдання; ticketCount — кількість заявок за день):',
    JSON.stringify(scheduleRows[0]?.data ?? {}),
    'Диспетчерські виклики за день:',
    JSON.stringify(dispatcherRows[0]?.data ?? {}),
    'Сміття за день (types.bins — кількість вивезених баків тощо):',
    JSON.stringify(garbageRows[0]?.data ?? {}),
  ].join('\n');
}

function systemPromptFor(scope: Scope): string {
  const base = 'Відповідай українською мовою, коротко (2-4 речення), лише на основі наданих нижче даних. ' +
    'Якщо в даних немає відповіді — чесно скажи, що не вистачає інформації, не вигадуй чисел і фактів.';
  if (scope === 'journal') {
    return `Ти — асистент журналу чергувань ОСББ "Микитська Слобода" (електрик/двірник/сантехнік, сміття, диспетчер). ${base}`;
  }
  return `Ти — асистент складу ОСББ "Микитська Слобода" (залишки товарів, категорії, внутрішнє використання). ${base}`;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return json({ error: 'AI assistant is not configured (missing ANTHROPIC_API_KEY)' }, 500);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return json({ error: 'Server misconfigured (missing Supabase service credentials)' }, 500);
  }

  let body: AssistantRequestBody;
  try {
    body = await req.json() as AssistantRequestBody;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const question = String(body.question || '').trim().slice(0, MAX_QUESTION_LEN);
  const scope: Scope = body.scope === 'journal' ? 'journal' : 'sklad';
  if (!question) return json({ error: 'question is required' }, 400);

  try {
    const context = scope === 'journal'
      ? await fetchJournalContext(supabaseUrl, serviceKey)
      : await fetchSkladContext(supabaseUrl, serviceKey);

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPromptFor(scope),
        messages: [
          { role: 'user', content: `Дані:\n${context}\n\nЗапитання: ${question}` },
        ],
      }),
    });
    const aiData = await aiRes.json() as AnthropicResponse;
    if (!aiRes.ok) {
      return json({ error: aiData.error?.message || `Anthropic API error ${aiRes.status}` }, 502);
    }
    const answer = (aiData.content || [])
      .filter((block) => block.type === 'text' && block.text)
      .map((block) => block.text)
      .join('')
      .trim();
    if (!answer) return json({ error: 'Порожня відповідь від асистента' }, 502);
    return json({ ok: true, answer });
  } catch (e) {
    return json({ error: String(e) }, 502);
  }
});
