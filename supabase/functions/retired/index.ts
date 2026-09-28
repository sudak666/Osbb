// Заглушка для Edge Functions, які клієнт більше не викликає:
// notify-telegram (сповіщення шлють DB-тригери, див. 008/029), create-jira-issue,
// ai-assistant, fetch-item-prices. Їх не можна видалити через Supabase MCP,
// тому під тими самими іменами деплоїться цей код з verify_jwt = true:
// відкритий endpoint більше не пересилає запити в Telegram/Jira/платні API.
//
// Деплой (для кожного імені):
//   supabase functions deploy <name> --project-ref vkwkyhjjjmcpmiakxohw
// Повне видалення:
//   supabase functions delete <name> --project-ref vkwkyhjjjmcpmiakxohw

Deno.serve((): Response => new Response(JSON.stringify({ error: 'This endpoint has been retired' }), {
  status: 410,
  headers: { 'Content-Type': 'application/json' },
}));
