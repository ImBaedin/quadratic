# Notes

- WorkOS TanStack Start currently installs from `@workos/authkit-tanstack-react-start`. Some newer docs and examples refer to `@workos-inc/authkit-tanstack-start`, but that package was not published to npm when this integration was refreshed.
- `@tanstack/ai@0.9.1` supports the repository agent loop cleanly via `chat()` + `toolDefinition()` + `maxIterations()`, but the top-level `chat()` activity options do not accept a `request` field even though lower-level `TextOptions` types include one.
