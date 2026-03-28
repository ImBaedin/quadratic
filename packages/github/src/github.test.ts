import { describe, expect, test } from "bun:test";

import {
  computeGitHubWebhookSignature,
  normalizeGitHubRepository,
  verifyGitHubWebhookSignature,
} from "./index";

describe("GitHub webhook verification", () => {
  test("verifies matching sha256 signatures", () => {
    const payload = JSON.stringify({ zen: "ship it" });
    const secret = "top-secret";
    const signature = computeGitHubWebhookSignature(secret, payload);

    expect(
      verifyGitHubWebhookSignature({
        secret,
        payload,
        signatureHeader: signature,
      }),
    ).toBe(true);
  });

  test("rejects mismatched signatures", () => {
    expect(
      verifyGitHubWebhookSignature({
        secret: "top-secret",
        payload: "{}",
        signatureHeader: "sha256=deadbeef",
      }),
    ).toBe(false);
  });
});

describe("GitHub repository normalization", () => {
  test("normalizes GitHub API repository shapes", () => {
    const repository = normalizeGitHubRepository({
      id: 42,
      name: "quadratic",
      full_name: "acme/quadratic",
      private: true,
      default_branch: "main",
      archived: false,
      visibility: "private",
      html_url: "https://github.com/acme/quadratic",
      owner: {
        login: "acme",
      },
    });

    expect(repository.fullName).toBe("acme/quadratic");
    expect(repository.defaultBranch).toBe("main");
  });
});
