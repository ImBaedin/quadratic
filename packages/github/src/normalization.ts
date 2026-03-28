import { z } from "zod";

export const githubAccountSchema = z.object({
  id: z.number().int(),
  login: z.string(),
  type: z.string(),
});

export type GitHubAccount = z.infer<typeof githubAccountSchema>;

export const normalizedGitHubRepositorySchema = z.object({
  id: z.number().int(),
  owner: z.string(),
  name: z.string(),
  fullName: z.string(),
  private: z.boolean(),
  defaultBranch: z.string(),
  archived: z.boolean(),
  visibility: z.enum(["public", "private", "internal"]).optional(),
  htmlUrl: z.string().url(),
});

export type NormalizedGitHubRepository = z.infer<
  typeof normalizedGitHubRepositorySchema
>;

export const normalizedInstallationSchema = z.object({
  id: z.number().int(),
  account: githubAccountSchema,
  targetType: z.string(),
  repositorySelection: z.enum(["all", "selected"]).optional(),
});

export type NormalizedInstallation = z.infer<typeof normalizedInstallationSchema>;

export function normalizeGitHubRepository(input: unknown): NormalizedGitHubRepository {
  const schema = z.object({
    id: z.number().int(),
    name: z.string(),
    full_name: z.string(),
    private: z.boolean(),
    default_branch: z.string(),
    archived: z.boolean().default(false),
    visibility: z.enum(["public", "private", "internal"]).optional(),
    html_url: z.string().url(),
    owner: z.object({
      login: z.string(),
    }),
  });

  const repository = schema.parse(input);
  return normalizedGitHubRepositorySchema.parse({
    id: repository.id,
    owner: repository.owner.login,
    name: repository.name,
    fullName: repository.full_name,
    private: repository.private,
    defaultBranch: repository.default_branch,
    archived: repository.archived,
    visibility: repository.visibility,
    htmlUrl: repository.html_url,
  });
}

export function normalizeGitHubInstallation(input: unknown): NormalizedInstallation {
  const schema = z.object({
    id: z.number().int(),
    target_type: z.string(),
    repository_selection: z.enum(["all", "selected"]).optional(),
    account: z.object({
      id: z.number().int(),
      login: z.string(),
      type: z.string(),
    }),
  });

  const installation = schema.parse(input);
  return normalizedInstallationSchema.parse({
    id: installation.id,
    targetType: installation.target_type,
    repositorySelection: installation.repository_selection,
    account: installation.account,
  });
}
