export function parseCookies(cookieHeader: string | null) {
  if (!cookieHeader) {
    return {};
  }

  return Object.fromEntries(
    cookieHeader.split(/;\s*/).flatMap((entry) => {
      const separatorIndex = entry.indexOf("=");
      if (separatorIndex === -1) {
        return [];
      }

      const key = entry.slice(0, separatorIndex);
      const value = entry.slice(separatorIndex + 1);
      return [[key, decodeURIComponent(value)]];
    }),
  );
}

export function serializeCookie(args: {
  name: string;
  value: string;
  path?: string;
  httpOnly?: boolean;
  sameSite?: "Lax" | "Strict" | "None";
  secure?: boolean;
  maxAge?: number;
}) {
  const parts = [`${args.name}=${encodeURIComponent(args.value)}`];

  if (args.path) {
    parts.push(`Path=${args.path}`);
  }
  if (args.httpOnly ?? true) {
    parts.push("HttpOnly");
  }
  if (args.sameSite ?? "Lax") {
    parts.push(`SameSite=${args.sameSite ?? "Lax"}`);
  }
  if (args.secure ?? true) {
    parts.push("Secure");
  }
  if (typeof args.maxAge === "number") {
    parts.push(`Max-Age=${args.maxAge}`);
  }

  return parts.join("; ");
}
