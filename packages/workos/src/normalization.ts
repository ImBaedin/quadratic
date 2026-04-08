import { z } from "zod";

export const normalizedWorkosUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  avatarUrl: z.string().url().optional(),
});

export type NormalizedWorkosUser = z.infer<typeof normalizedWorkosUserSchema>;

export const normalizedWorkosOrganizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string().optional(),
});

export type NormalizedWorkosOrganization = z.infer<typeof normalizedWorkosOrganizationSchema>;

export const normalizedWorkosMembershipSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  userId: z.string(),
  role: z.enum(["owner", "admin", "member"]).catch("member"),
  status: z.string().optional(),
});

export type NormalizedWorkosMembership = z.infer<typeof normalizedWorkosMembershipSchema>;

export const normalizedWorkosInvitationSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  organizationId: z.string(),
  role: z.enum(["owner", "admin", "member"]).catch("member"),
  status: z.string(),
});

export type NormalizedWorkosInvitation = z.infer<typeof normalizedWorkosInvitationSchema>;

export function normalizeWorkosUser(input: unknown): NormalizedWorkosUser {
  const schema = z.object({
    id: z.string(),
    email: z.string().email(),
    first_name: z.string().optional().nullable(),
    last_name: z.string().optional().nullable(),
    profile_picture_url: z.string().url().optional().nullable(),
  });

  const user = schema.parse(input);
  return normalizedWorkosUserSchema.parse({
    id: user.id,
    email: user.email,
    firstName: user.first_name ?? undefined,
    lastName: user.last_name ?? undefined,
    avatarUrl: user.profile_picture_url ?? undefined,
  });
}

export function normalizeWorkosOrganization(input: unknown): NormalizedWorkosOrganization {
  const schema = z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string().optional().nullable(),
  });

  const organization = schema.parse(input);
  return normalizedWorkosOrganizationSchema.parse({
    id: organization.id,
    name: organization.name,
    slug: organization.slug ?? undefined,
  });
}

export function normalizeWorkosMembership(input: unknown): NormalizedWorkosMembership {
  const schema = z
    .object({
      id: z.string(),
      organization_id: z.string().optional(),
      organizationId: z.string().optional(),
      organization: z
        .object({
          id: z.string(),
        })
        .optional(),
      user_id: z.string().optional(),
      userId: z.string().optional(),
      user: z
        .object({
          id: z.string(),
        })
        .optional(),
      role: z.string().optional(),
      role_slug: z.string().optional(),
      roleSlug: z.string().optional(),
      status: z.string().optional(),
    })
    .transform((membership, ctx) => {
      const organizationId =
        membership.organization_id ?? membership.organizationId ?? membership.organization?.id;
      const userId = membership.user_id ?? membership.userId ?? membership.user?.id;

      if (!organizationId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["organization_id"],
          message: "Missing organization id on WorkOS membership payload",
        });
      }

      if (!userId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["user_id"],
          message: "Missing user id on WorkOS membership payload",
        });
      }

      return {
        id: membership.id,
        organizationId,
        userId,
        role: membership.role ?? membership.role_slug ?? membership.roleSlug,
        status: membership.status,
      };
    });

  const membership = schema.parse(input);
  return normalizedWorkosMembershipSchema.parse({
    id: membership.id,
    organizationId: membership.organizationId,
    userId: membership.userId,
    role: membership.role,
    status: membership.status,
  });
}

export function normalizeWorkosInvitation(input: unknown): NormalizedWorkosInvitation {
  const schema = z.object({
    id: z.string(),
    email: z.string().email(),
    organization_id: z.string(),
    role: z.string().optional(),
    status: z.string(),
  });

  const invitation = schema.parse(input);
  return normalizedWorkosInvitationSchema.parse({
    id: invitation.id,
    email: invitation.email,
    organizationId: invitation.organization_id,
    role: invitation.role,
    status: invitation.status,
  });
}
