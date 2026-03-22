import type { Profile, ProfileFrontmatter } from "./types";
import { ContentValidationError, parseFrontmatter, requireField } from "./parser";

const rawProfiles = import.meta.glob("../profile/*.md", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

function extractLocaleFromPath(filePath: string): string | null {
  const filename = filePath.split("/").pop() ?? "";
  const match = filename.match(/\.([a-z]{2}-[A-Z]{2})\.md$/);
  return match ? match[1] : null;
}

function normalizeProfile(raw: string, filePath: string): Profile {
  const { data, content } = parseFrontmatter<ProfileFrontmatter>(raw, filePath);

  const name = requireField<string>(data, "name", filePath);
  const bio = requireField<string>(data, "bio", filePath);

  const frontmatterLocale = typeof data.locale === "string" ? data.locale : null;
  const pathLocale = extractLocaleFromPath(filePath);
  const locale = frontmatterLocale ?? pathLocale;

  if (!locale) {
    throw new ContentValidationError(
      'Missing required field: "locale". Specify in frontmatter or use filename pattern: {name}.{locale}.md',
      filePath,
      "locale"
    );
  }

  const skills = Array.isArray(data.skills) ? data.skills.map(String) : [];

  const projects = Array.isArray(data.projects)
    ? data.projects
        .filter((p): p is { name: string; url: string } =>
          typeof p === "object" &&
          p !== null &&
          typeof (p as Record<string, unknown>).name === "string" &&
          typeof (p as Record<string, unknown>).url === "string"
        )
    : [];

  const contact =
    typeof data.contact === "object" && data.contact !== null && !Array.isArray(data.contact)
      ? (data.contact as Record<string, string>)
      : {};

  return {
    name,
    bio,
    locale,
    avatar: typeof data.avatar === "string" ? data.avatar : undefined,
    skills,
    projects,
    contact,
    body: content,
  };
}

export function loadProfiles(): Profile[] {
  const profiles: Profile[] = [];

  for (const [path, raw] of Object.entries(rawProfiles)) {
    const filename = path.split("/").pop() ?? "";
    if (filename.startsWith("_") || filename === "README.md") continue;
    profiles.push(normalizeProfile(raw, path));
  }

  return profiles;
}

export function loadProfile(locale: string): Profile {
  const profiles = loadProfiles();
  const profile = profiles.find((p) => p.locale === locale);

  if (!profile) {
    const available = profiles.map((p) => p.locale).join(", ") || "none";
    throw new ContentValidationError(
      `Profile not found for locale: "${locale}". Available locales: ${available}`,
      `profile/*.${locale}.md`,
      "locale"
    );
  }

  return profile;
}

export function getDefaultProfile(): Profile | undefined {
  const profiles = loadProfiles();
  return profiles.find((p) => p.locale === "zh-CN") ?? profiles[0];
}
