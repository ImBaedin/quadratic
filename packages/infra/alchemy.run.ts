import alchemy from "alchemy";
import { TanStackStart } from "alchemy/cloudflare";
import { config } from "dotenv";

config({ path: "../../.env" });
config({ path: "./.env" });
config({ path: "../../apps/web/.env" });

const app = await alchemy("quadratic");

export const web = await TanStackStart("web", {
  cwd: "../../apps/web",
  bindings: {
    VITE_CONVEX_URL: alchemy.env.VITE_CONVEX_URL!,
    APP_URL: alchemy.env.APP_URL!,
    CONVEX_URL: alchemy.env.CONVEX_URL ?? alchemy.env.VITE_CONVEX_URL!,
    WORKOS_CLIENT_ID: alchemy.env.WORKOS_CLIENT_ID!,
    WORKOS_API_KEY: alchemy.env.WORKOS_API_KEY!,
    WORKOS_COOKIE_PASSWORD: alchemy.env.WORKOS_COOKIE_PASSWORD!,
    WORKOS_REDIRECT_URI: alchemy.env.WORKOS_REDIRECT_URI!,
    WORKOS_LOGOUT_REDIRECT_URI: alchemy.env.WORKOS_LOGOUT_REDIRECT_URI!,
    GITHUB_APP_ID: alchemy.env.GITHUB_APP_ID!,
    GITHUB_APP_CLIENT_ID: alchemy.env.GITHUB_APP_CLIENT_ID!,
    GITHUB_APP_CLIENT_SECRET: alchemy.env.GITHUB_APP_CLIENT_SECRET!,
    GITHUB_APP_PRIVATE_KEY: alchemy.env.GITHUB_APP_PRIVATE_KEY!,
    GITHUB_APP_WEBHOOK_SECRET: alchemy.env.GITHUB_APP_WEBHOOK_SECRET!,
    GITHUB_APP_NAME: alchemy.env.GITHUB_APP_NAME!,
    GITHUB_APP_INSTALL_URL: alchemy.env.GITHUB_APP_INSTALL_URL!,
  },
});

console.log(`Web    -> ${web.url}`);

await app.finalize();
