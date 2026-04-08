export function responseFromError(
  error: unknown,
  args?: {
    context?: string;
    fallbackMessage?: string;
    status?: number;
  },
) {
  const context = args?.context ?? "Request failed";
  const fallbackMessage = args?.fallbackMessage ?? "Request failed";
  const status = args?.status ?? 500;

  if (error instanceof Response) {
    return error;
  }

  const message = error instanceof Error ? error.message : fallbackMessage;
  console.error(`[platform] ${context}`, error);

  return new Response(`${fallbackMessage}: ${message}`, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
    },
  });
}
