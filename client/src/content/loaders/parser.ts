import { ContentValidationError } from "./types";

export { ContentValidationError };

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

export interface ParsedContent<T> {
  data: T;
  content: string;
}

export function parseFrontmatter<T extends Record<string, unknown>>(
  raw: string,
  filePath: string
): ParsedContent<T> {
  const match = raw.match(FRONTMATTER_REGEX);

  if (!match) {
    throw new ContentValidationError(
      "Missing or malformed frontmatter. Expected format: ---\\nyaml\\n---",
      filePath
    );
  }

  const [, yamlBlock, content] = match;
  const data = parseSimpleYaml(yamlBlock, filePath) as T;

  return { data, content: content.trim() };
}

function parseSimpleYaml(
  yaml: string,
  filePath: string
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = yaml.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      i++;
      continue;
    }

    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) {
      throw new ContentValidationError(
        `Invalid YAML syntax at line ${i + 1}: "${trimmed}"`,
        filePath
      );
    }

    const key = trimmed.slice(0, colonIdx).trim();
    const valueRaw = trimmed.slice(colonIdx + 1).trim();

    if (valueRaw === "" && i + 1 < lines.length && lines[i + 1].startsWith("  ")) {
      const arrayResult = parseYamlArray(lines, i + 1, filePath);
      result[key] = arrayResult.items;
      i = arrayResult.nextIndex;
    } else if (valueRaw.startsWith("[") && valueRaw.endsWith("]")) {
      result[key] = parseInlineArray(valueRaw);
    } else if (valueRaw === "[]") {
      result[key] = [];
    } else if (valueRaw === "{}") {
      result[key] = {};
    } else {
      result[key] = parseScalarValue(valueRaw);
    }

    i++;
  }

  return result;
}

function parseYamlArray(
  lines: string[],
  startIndex: number,
  filePath: string
): { items: unknown[]; nextIndex: number } {
  const items: unknown[] = [];
  let i = startIndex;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.startsWith("  ") && line.trim() !== "") {
      break;
    }

    const trimmed = line.trim();
    if (!trimmed) {
      i++;
      continue;
    }

    if (trimmed.startsWith("- ")) {
      const itemContent = trimmed.slice(2).trim();

      if (itemContent.includes(":") && !itemContent.startsWith('"')) {
        const obj: Record<string, unknown> = {};
        const [firstKey, firstVal] = itemContent.split(":").map((s) => s.trim());
        obj[firstKey] = parseScalarValue(firstVal);

        i++;
        while (i < lines.length && lines[i].startsWith("    ") && !lines[i].trim().startsWith("-")) {
          const nestedLine = lines[i].trim();
          const nestedColonIdx = nestedLine.indexOf(":");
          if (nestedColonIdx !== -1) {
            const nestedKey = nestedLine.slice(0, nestedColonIdx).trim();
            const nestedVal = nestedLine.slice(nestedColonIdx + 1).trim();
            obj[nestedKey] = parseScalarValue(nestedVal);
          }
          i++;
        }
        items.push(obj);
        continue;
      } else {
        items.push(parseScalarValue(itemContent));
      }
    }
    i++;
  }

  return { items, nextIndex: i - 1 };
}

function parseInlineArray(value: string): unknown[] {
  const inner = value.slice(1, -1).trim();
  if (!inner) return [];

  return inner.split(",").map((item) => parseScalarValue(item.trim()));
}

function parseScalarValue(value: string): unknown {
  if (!value) return "";

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null") return null;

  const num = Number(value);
  if (!isNaN(num) && value !== "") return num;

  return value;
}

export function requireField<T>(
  data: Record<string, unknown>,
  field: string,
  filePath: string
): T {
  const value = data[field];
  if (value === undefined || value === null || value === "") {
    throw new ContentValidationError(
      `Missing required field: "${field}"`,
      filePath,
      field
    );
  }
  return value as T;
}

export function extractSlugFromPath(filePath: string): string {
  const filename = filePath.split("/").pop() ?? "";
  const withoutExt = filename.replace(/\.md$/, "");
  const withoutDatePrefix = withoutExt.replace(/^\d{4}-\d{2}-\d{2}-/, "");
  return withoutDatePrefix || "unknown";
}
