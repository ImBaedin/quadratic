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

    void fetch(url)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(await response.text());
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
          setState({ data: null, error: error.message, loading: false });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  return state;
}
