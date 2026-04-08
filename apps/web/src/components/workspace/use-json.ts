import { useEffect, useState } from "react";

export function useJson<T>(url: string) {
  const [state, setState] = useState<{
    data: T | null;
    error: string | null;
    loading: boolean;
  }>({
    data: null,
    error: null,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    void fetch(url, {
      headers: {
        accept: "application/json",
      },
    })
      .then(async (response) => {
        if (!response.ok) {
          const body = (await response.text()).trim();
          throw new Error(
            body
              ? `${response.status} ${response.statusText}: ${body}`
              : `${response.status} ${response.statusText}`,
          );
        }
        return (await response.json()) as T;
      })
      .then((data) => {
        if (!cancelled) {
          setState({ data, error: null, loading: false });
        }
      })
      .catch((error: Error) => {
        if (!cancelled) {
          const message =
            error.message === "Failed to fetch"
              ? `Request to ${url} failed before a response was received.`
              : error.message;
          setState({ data: null, error: `${url}: ${message}`, loading: false });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  return state;
}
