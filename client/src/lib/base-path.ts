const ABSOLUTE_URL_PATTERN = /^[a-zA-Z][a-zA-Z\d+\-.]*:/;

function normalizeBasePath(basePath: string): string {
  if (!basePath || basePath === "/") {
    return "";
  }

  const withLeadingSlash = basePath.startsWith("/") ? basePath : `/${basePath}`;
  return withLeadingSlash.endsWith("/")
    ? withLeadingSlash.slice(0, -1)
    : withLeadingSlash;
}

const normalizedBasePath = normalizeBasePath(import.meta.env.BASE_URL || "/");

export const routerBase = normalizedBasePath;

export function withBasePath(path: string): string {
  if (!path) {
    return normalizedBasePath || "/";
  }

  if (ABSOLUTE_URL_PATTERN.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (!normalizedBasePath) {
    return normalizedPath;
  }

  return `${normalizedBasePath}${normalizedPath}`;
}

export function stripBasePath(pathname: string): string {
  if (!normalizedBasePath) {
    return pathname;
  }

  if (pathname === normalizedBasePath) {
    return "/";
  }

  if (pathname.startsWith(`${normalizedBasePath}/`)) {
    return pathname.slice(normalizedBasePath.length);
  }

  return pathname;
}

export function isAbsoluteUrl(value: string): boolean {
  return ABSOLUTE_URL_PATTERN.test(value);
}
