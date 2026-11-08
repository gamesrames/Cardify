// Declarações mínimas para o código que só roda no Deno (Edge Functions).
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};
