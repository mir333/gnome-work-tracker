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

export const projectService = {
  async list(userId: string) {
    return projectRepository.findAllByUser(userId);
  },

  async getById(id: string, userId: string) {
    const project = await projectRepository.findById(id);
    if (!project || project.userId !== userId) return null;
    return project;
  },

  async create(userId: string, name: string) {
    const slug = await generateUniqueSlug(name);
    return projectRepository.create({ name, slug, userId });
  },

  async update(id: string, userId: string, data: { name?: string; slug?: string }) {
    const project = await projectRepository.findById(id);
    if (!project || project.userId !== userId) return null;

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
