import type { Work, WorkFrontmatter } from "./types";
import { parseFrontmatter, requireField, extractSlugFromPath } from "./parser";

const rawWorks = import.meta.glob("../works/*.md", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

function normalizeWork(raw: string, filePath: string): Work {
  const { data, content } = parseFrontmatter<WorkFrontmatter>(raw, filePath);

  const title = requireField<string>(data, "title", filePath);

  const description = typeof data.description === "string" && data.description
    ? data.description
    : typeof data.summary === "string" && data.summary
      ? data.summary
      : null;

  if (!description) {
    throw new Error(
      `[${filePath}] Missing required field: "description" (or "summary" as alternative).`
    );
  }

  const slug = typeof data.slug === "string" && data.slug
    ? data.slug
    : extractSlugFromPath(filePath);

  const tags = Array.isArray(data.tags) ? data.tags.map(String) : [];

  const date = typeof data.date === "string" && data.date ? data.date : undefined;

  return {
    slug,
    title,
    description,
    date,
    tags,
    technologies: typeof data.technologies === "string" ? data.technologies : undefined,
    link: typeof data.link === "string" ? data.link : undefined,
    imageUrl: typeof data.imageUrl === "string" ? data.imageUrl : undefined,
    body: content,
  };
}

function sortWorksNewestFirst(works: Work[]): Work[] {
  return works.sort((a, b) => {
    const dateA = a.date ? new Date(a.date).getTime() : 0;
    const dateB = b.date ? new Date(b.date).getTime() : 0;
    const dateDiff = dateB - dateA;

    if (dateDiff !== 0) return dateDiff;
    return a.slug.localeCompare(b.slug);
  });
}

export function loadWorks(): Work[] {
  const works: Work[] = [];

  for (const [path, raw] of Object.entries(rawWorks)) {
    const filename = path.split("/").pop() ?? "";
    if (filename.startsWith("_") || filename === "README.md") continue;
    works.push(normalizeWork(raw, path));
  }

  return sortWorksNewestFirst(works);
}

export function getWorkBySlug(slug: string): Work | undefined {
  return loadWorks().find((work) => work.slug === slug);
}
