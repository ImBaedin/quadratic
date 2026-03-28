<!-- convex-ai-start -->
This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.
<!-- convex-ai-end -->

- The web app talks to Convex through `ConvexHttpClient`, which can only call public `api.*` functions. If server-side application code needs to trigger task internals like planning bootstrap or result application, add a thin public wrapper mutation/action that delegates to `internal.*`; the web server cannot call `internal.*` directly.
- Repository orchestration now runs through scheduled Convex `internalAction`s in `convex/orchestration.ts`. Those actions mint a GitHub installation token, call the external repo-actions service synchronously, and send `metadata.installationToken` plus task/run context to the service.
