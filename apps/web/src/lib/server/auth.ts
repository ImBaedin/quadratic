import { getAuth, getAuthkit } from "@workos/authkit-tanstack-react-start";

export interface PlatformSession {
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  organizationId?: string;
  role?: string;
  permissions: string[];
  entitlements: string[];
  featureFlags: string[];
}

function normalizeAuth(auth: {
  user: {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    profilePictureUrl?: string | null;
  } | null;
  organizationId?: string;
  role?: string;
  permissions?: string[];
  entitlements?: string[];
  featureFlags?: string[];
}): PlatformSession | null {
  if (!auth.user) {
    return null;
  }

  return {
    userId: auth.user.id,
    email: auth.user.email,
    firstName: auth.user.firstName ?? undefined,
    lastName: auth.user.lastName ?? undefined,
    avatarUrl: auth.user.profilePictureUrl ?? undefined,
    organizationId: auth.organizationId,
    role: auth.role,
    permissions: auth.permissions ?? [],
    entitlements: auth.entitlements ?? [],
    featureFlags: auth.featureFlags ?? [],
  };
}

export async function getSession(request?: Request): Promise<PlatformSession | null> {
  if (request) {
    const authkit = await getAuthkit();
    const { auth } = await authkit.withAuth(request);
    return normalizeAuth({
      user: auth.user,
      organizationId: auth.claims?.org_id,
      role: auth.claims?.role,
      permissions: auth.claims?.permissions,
      entitlements: auth.claims?.entitlements,
      featureFlags: auth.claims?.feature_flags,
    });
  }

  return normalizeAuth(await getAuth());
}

export async function requireSession(request?: Request) {
  const session = await getSession(request);
  if (!session) {
    throw new Response("Unauthorized", { status: 401 });
  }

  return session;
}
