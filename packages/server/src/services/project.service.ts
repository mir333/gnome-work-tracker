import { projectRepository } from "../repositories/project.repository";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function generateUniqueSlug(name: string): Promise<string> {
  let slug = slugify(name);
  let existing = await projectRepository.findBySlug(slug);
  let counter = 1;
  while (existing) {
    slug = `${slugify(name)}-${counter}`;
    existing = await projectRepository.findBySlug(slug);
    counter++;
  }
  return slug;
}

export const SHORT_NAME_MAX_LENGTH = 12;

/**
 * Normalize a project short name from user input.
 * undefined → undefined (not provided); empty/whitespace/null → null (clear);
 * otherwise trimmed string, at most SHORT_NAME_MAX_LENGTH characters.
 */
export function normalizeShortName(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") throw new Error("Short name must be a string");
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > SHORT_NAME_MAX_LENGTH) {
    throw new Error(`Short name must be at most ${SHORT_NAME_MAX_LENGTH} characters`);
  }
  return trimmed;
}

type ProjectUpdateInput = { name?: string; slug?: string; shortName?: string | null };

export const projectService = {
  async list(userId: string) {
    return projectRepository.findAllByUser(userId);
  },

  async getById(id: string, userId: string) {
    const project = await projectRepository.findById(id);
    if (!project || project.userId !== userId) return null;
    return project;
  },

  async create(userId: string, name: string, shortName?: unknown) {
    const normalizedShortName = normalizeShortName(shortName) ?? null;
    const slug = await generateUniqueSlug(name);
    return projectRepository.create({ name, slug, userId, shortName: normalizedShortName });
  },

  async update(id: string, userId: string, input: ProjectUpdateInput) {
    const project = await projectRepository.findById(id);
    if (!project || project.userId !== userId) return null;

    // Only pass known fields through to the repository.
    const data: ProjectUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.slug !== undefined) data.slug = input.slug;
    const shortName = normalizeShortName(input.shortName);
    if (shortName !== undefined) data.shortName = shortName;

    if (data.slug && data.slug !== project.slug) {
      const existing = await projectRepository.findBySlug(data.slug);
      if (existing) throw new Error("Slug already taken");
    }

    return projectRepository.update(id, data);
  },

  async delete(id: string, userId: string) {
    const project = await projectRepository.findById(id);
    if (!project || project.userId !== userId) return false;
    await projectRepository.delete(id);
    return true;
  },
};
