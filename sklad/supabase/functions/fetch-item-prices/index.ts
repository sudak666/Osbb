// Supabase Edge Function: searches approximate item prices on the internet.
//
// IMPORTANT for future agents/Claude:
// - This belongs to the Sklad Supabase project only: vkwkyhjjjmcpmiakxohw.
// - The main OSBB/journal project is separate; do not deploy this there.
// - API keys stay in Supabase secrets and never in sklad/index.html.
//
// Deploy:
//   supabase functions deploy fetch-item-prices --project-ref vkwkyhjjjmcpmiakxohw --no-verify-jwt
//
// Configure at least one provider secret:
//   supabase secrets set SERPAPI_KEY=... --project-ref vkwkyhjjjmcpmiakxohw
//   # optional fallback/provider depending on account:
//   supabase secrets set SHOPAPIS_KEY=... --project-ref vkwkyhjjjmcpmiakxohw

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type PriceResult = {
  title: string;
  price: number;
  source: string;
  link?: string;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function cleanText(value: unknown, max = 120) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function parsePrice(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const text = String(value || '')
    .replace(/\s/g, '')
    .replace(/грн|uah|₴/gi, '')
    .replace(',', '.');
  const match = text.match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  const price = Number(match[0]);
  return Number.isFinite(price) && price > 0 ? price : null;
}

function normalizeResults(rows: unknown[], provider: string): PriceResult[] {
  const seen = new Set<string>();
  const results: PriceResult[] = [];
  for (const raw of rows) {
    const row = raw as Record<string, unknown>;
    const price = parsePrice(row.extracted_price ?? row.price ?? row.current_price ?? row.value);
    const title = cleanText(row.title ?? row.name ?? row.product_title, 180);
    if (!price || !title) continue;
    const source = cleanText(row.source ?? row.seller ?? row.merchant ?? provider, 80) || provider;
    const link = cleanText(row.link ?? row.product_link ?? row.url, 500);
    const key = `${title.toLowerCase()}|${price}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({ title, price, source, link: link || undefined });
  }
  return results.sort((a, b) => a.price - b.price).slice(0, 8);
}

async function searchSerpApi(query: string): Promise<PriceResult[]> {
  const key = Deno.env.get('SERPAPI_KEY');
  if (!key) return [];
  const url = new URL('https://serpapi.com/search.json');
  url.searchParams.set('engine', 'google_shopping');
  url.searchParams.set('google_domain', 'google.com.ua');
  url.searchParams.set('gl', 'ua');
  url.searchParams.set('hl', 'uk');
  url.searchParams.set('q', query);
  url.searchParams.set('api_key', key);
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `SerpApi error ${res.status}`);
  return normalizeResults(data?.shopping_results || [], 'Google Shopping');
}

async function searchShopApis(query: string): Promise<PriceResult[]> {
  const key = Deno.env.get('SHOPAPIS_KEY');
  if (!key) return [];
  // ShopAPIS endpoints vary by plan/platform. Keep this as a conservative JSON
  // integration point; if the account uses another endpoint, only this function
  // needs to change, not the public client.
  const url = new URL('https://api.shopapis.com/search');
  url.searchParams.set('q', query);
  url.searchParams.set('country', 'ua');
  const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || data?.message || `ShopAPIS error ${res.status}`);
  return normalizeResults(data?.results || data?.items || [], 'ShopAPIS');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const name = cleanText(body.name, 140);
  const category = cleanText(body.category, 60);
  const unit = cleanText(body.unit, 30);
  if (!name) return json({ error: 'name is required' }, 400);

  const query = [name, category, unit, 'ціна Україна грн'].filter(Boolean).join(' ');
  try {
    const merged: PriceResult[] = [];
    for (const provider of [searchSerpApi, searchShopApis]) {
      try {
        merged.push(...await provider(query));
      } catch (e) {
        console.warn('price provider failed:', e);
      }
    }
    const results = normalizeResults(merged, 'Інтернет');
    if (!results.length && !Deno.env.get('SERPAPI_KEY') && !Deno.env.get('SHOPAPIS_KEY')) {
      return json({ error: 'Price search is not configured (missing SERPAPI_KEY or SHOPAPIS_KEY)' }, 500);
    }
    return json({ ok: true, query, results });
  } catch (e) {
    return json({ error: String(e) }, 502);
  }
});
