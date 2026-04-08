import { describe, expect, test } from "bun:test";

import {
  decodeWorkosSession,
  encodeAuthState,
  encodeWorkosSession,
  normalizeWorkosMembership,
  normalizeWorkosUser,
} from "./index";

describe("WorkOS normalization", () => {
  test("normalizes a WorkOS user payload", () => {
    const user = normalizeWorkosUser({
      id: "user_123",
      email: "ada@example.com",
      first_name: "Ada",
      last_name: "Lovelace",
      profile_picture_url: "https://example.com/avatar.png",
    });

    expect(user.firstName).toBe("Ada");
    expect(user.avatarUrl).toBe("https://example.com/avatar.png");
  });

  test("normalizes a membership payload and defaults invalid roles to member", () => {
    const membership = normalizeWorkosMembership({
      id: "membership_123",
      organization_id: "org_123",
      user_id: "user_123",
      role: "viewer",
    });

    expect(membership.role).toBe("member");
  });
});

describe("WorkOS session helpers", () => {
  test("round trips signed session cookies", () => {
    const cookie = encodeWorkosSession(
      {
        userId: "user_123",
        email: "ada@example.com",
        organizationIds: ["org_123"],
      },
      "12345678901234567890123456789012",
    );

    expect(decodeWorkosSession(cookie, "12345678901234567890123456789012")?.userId).toBe(
      "user_123",
    );
  });

  test("encodes auth state", () => {
    expect(
      Buffer.from(
        encodeAuthState({
          returnTo: "/workspace/acme",
        }),
        "base64url",
      )
        .toString("utf8")
        .includes("workspace"),
    ).toBe(true);
  });
});
