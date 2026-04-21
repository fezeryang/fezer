/**
 * Content Loader - 服务端 Markdown 内容加载器
 *
 * 复用客户端的 parser 逻辑，在服务端加载和解析 Markdown 文件
 */

import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

/**
 * 解析后的内容
 */
export interface ParsedContent<T> {
	data: T;
	content: string;
}

/**
 * 解析 Frontmatter
 * 复制自 client/src/content/loaders/parser.ts
 */
export function parseFrontmatter<T extends Record<string, unknown>>(
	raw: string,
	filePath: string
): ParsedContent<T> {
	const match = raw.match(FRONTMATTER_REGEX);

	if (!match) {
		throw new Error(`[${filePath}] Missing or malformed frontmatter`);
	}

	const [, yamlBlock, content] = match;
	const data = parseSimpleYaml(yamlBlock, filePath) as T;

	return { data, content: content.trim() };
}

/**
 * 简单的 YAML 解析器
 * 复制自 client/src/content/loaders/parser.ts
 */
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
			throw new Error(`[${filePath}] Invalid YAML syntax at line ${i + 1}`);
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

/**
 * 获取必填字段
 */
export function requireField<T>(
	data: Record<string, unknown>,
	field: string,
	filePath: string
): T {
	const value = data[field];
	if (value === undefined || value === null || value === "") {
		throw new Error(`[${filePath}] Missing required field: "${field}"`);
	}
	return value as T;
}

/**
 * 从文件路径提取 slug
 */
export function extractSlugFromPath(filePath: string): string {
	const filename = filePath.split("/").pop() ?? "";
	const withoutExt = filename.replace(/\.md$/, "");
	const withoutDatePrefix = withoutExt.replace(/^\d{4}-\d{2}-\d{2}-/, "");
	return withoutDatePrefix || "unknown";
}

/**
 * 读取 Markdown 文件
 */
export function readMarkdownFile(
	baseDir: string,
	relativePath: string
): string {
	const fullPath = join(baseDir, relativePath);
	return readFileSync(fullPath, "utf-8");
}

/**
 * 扫描目录获取所有 Markdown 文件
 */
export function scanMarkdownFiles(
	baseDir: string,
	relativeDir: string
): string[] {
	const fullDir = join(baseDir, relativeDir);

	if (!existsSync(fullDir)) {
		return [];
	}

	const entries = readdirSync(fullDir);
	const mdFiles: string[] = [];

	for (const entry of entries) {
		const fullPath = join(fullDir, entry);
		const stat = statSync(fullPath);

		if (stat.isDirectory()) {
			continue;
		}

		if (entry.endsWith(".md")) {
			// 跳过以下划线开头或名为 README 的文件
			if (!entry.startsWith("_") && entry !== "README.md") {
				mdFiles.push(join(relativeDir, entry));
			}
		}
	}

	return mdFiles;
}

/**
 * 获取内容目录的根路径
 */
export function getContentRootPath(): string {
	// 获取当前文件的目录
	const currentFile = fileURLToPath(import.meta.url);
	const currentDir = dirname(currentFile);

	// 从 server/content 向上找到项目根目录
	let searchDir = currentDir;
	for (let i = 0; i < 5; i++) {
		const hasClient = existsSync(join(searchDir, "client"));
		const hasServer = existsSync(join(searchDir, "server"));
		if (hasClient && hasServer) {
			return join(searchDir, "client", "src", "content");
		}
		searchDir = join(searchDir, "..");
	}

	// 回退：使用相对路径
	return join(currentDir, "..", "..", "client", "src", "content");
}
