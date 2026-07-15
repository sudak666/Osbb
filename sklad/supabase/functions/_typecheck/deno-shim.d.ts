// Мінімальний shim глобального Deno API, якого потребують ці Edge Functions,
// щоб їх можна було типоперевірити звичайним tsc у CI без встановлення Deno CLI.
// Не претендує на повноту типів Deno — лише те, що реально використовується
// в notify-telegram/fetch-item-prices.
declare namespace Deno {
  function serve(handler: (req: Request) => Response | Promise<Response>): void;
  const env: { get(key: string): string | undefined };
}
