/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agentRuns from "../agentRuns.js";
import type * as githubInstallations from "../githubInstallations.js";
import type * as healthCheck from "../healthCheck.js";
import type * as internal_jobIngestion from "../internal/jobIngestion.js";
import type * as internal_workspaceSync from "../internal/workspaceSync.js";
import type * as invites from "../invites.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_roles from "../lib/roles.js";
import type * as memberships from "../memberships.js";
import type * as repositories from "../repositories.js";
import type * as users from "../users.js";
import type * as workspaces from "../workspaces.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agentRuns: typeof agentRuns;
  githubInstallations: typeof githubInstallations;
  healthCheck: typeof healthCheck;
  "internal/jobIngestion": typeof internal_jobIngestion;
  "internal/workspaceSync": typeof internal_workspaceSync;
  invites: typeof invites;
  "lib/auth": typeof lib_auth;
  "lib/roles": typeof lib_roles;
  memberships: typeof memberships;
  repositories: typeof repositories;
  users: typeof users;
  workspaces: typeof workspaces;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
