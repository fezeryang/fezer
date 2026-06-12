import type { ProfileIndex } from "../../content";
import { getDefaultProfile } from "../../content";

export interface ProfileSkillGroup {
  category: string;
  items: string[];
}

export interface ProfileProject {
  name: string;
  period?: string;
  summary: string;
  techStack: string[];
  highlights: string[];
  categories: string[];
}

export interface ProfileExperience {
  title: string;
  period?: string;
  summary: string;
  highlights: string[];
  categories: string[];
}

export interface ProfileKnowledge {
  name: string;
  title: string;
  location: string;
  email: string;
  bio: string;
  profile: ProfileIndex;
  identity: string[];
  education: string[];
  skills: ProfileSkillGroup[];
  projects: ProfileProject[];
  experiences: ProfileExperience[];
  practices: ProfileExperience[];
  interests: ProfileSkillGroup[];
  privacyRules: string[];
  answerRules: string[];
}

type SectionMap = Record<string, string[]>;

const PUBLIC_EMAIL = "cookfezer@gmail.com";
const PUBLIC_LOCATION = "北京";
const PUBLIC_TITLE = "AI 产品与 Agent 工作流实践者";

const SECTION_ALIASES = {
  identity: "核心定位",
  education: "教育背景",
  skills: "专业技能",
  projects: "个人项目",
  experiences: "实习经历",
  practices: "社会实践",
  interests: "兴趣与表达",
  privacyRules: "隐私与公开边界",
  answerRules: "AI 回答规则",
} as const;

function normalizeLine(line: string): string {
  return line.replace(/^[-•]\s*/, "").trim();
}

function parseSections(body: string): SectionMap {
  const sections: SectionMap = {};
  let current = "";

  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trim();
    const heading = line.match(/^##\s+(.+)$/);

    if (heading) {
      current = heading[1].trim();
      sections[current] = [];
      continue;
    }

    if (!current || !line) continue;
    sections[current].push(line);
  }

  return sections;
}

function sectionList(sections: SectionMap, name: string): string[] {
  return (sections[name] ?? [])
    .filter(line => line.startsWith("-") || line.startsWith("•"))
    .map(normalizeLine)
    .filter(Boolean);
}

function parseSkillGroups(lines: string[]): ProfileSkillGroup[] {
  return lines.map(line => {
    const [category, rest] = line.split(/[:：]/, 2);
    const items = rest
      ? rest
          .split(/[、,，]/)
          .map(item => item.trim())
          .filter(Boolean)
      : [line.trim()].filter(Boolean);

    return {
      category: category.trim(),
      items,
    };
  });
}

function splitNameAndPeriod(value: string): { name: string; period?: string } {
  const match = value.match(/^(.*)（([^（）]+)）$/);
  if (!match) return { name: value.trim() };
  return { name: match[1].trim(), period: match[2].trim() };
}

function parseBlocks(lines: string[]): Array<{ heading: string; bullets: string[] }> {
  const blocks: Array<{ heading: string; bullets: string[] }> = [];
  let current: { heading: string; bullets: string[] } | null = null;

  for (const line of lines) {
    if (line.startsWith("### ")) {
      current = { heading: line.replace(/^###\s+/, "").trim(), bullets: [] };
      blocks.push(current);
      continue;
    }

    if (!current || (!line.startsWith("-") && !line.startsWith("•"))) continue;
    current.bullets.push(normalizeLine(line));
  }

  return blocks;
}

function inferCategories(text: string): string[] {
  const normalized = text.toLowerCase();
  const categories: string[] = [];

  if (/agent|rag|llm|prompt|ai|多模态|智能|模型/.test(normalized)) {
    categories.push("ai");
  }
  if (/数据|python|sql|统计|kaggle|量化|指标|回撤|收益/.test(normalized)) {
    categories.push("data");
  }
  if (/金融|期权|保险|投资/.test(normalized)) {
    categories.push("finance");
  }
  if (/前端|ui|github pages|opencode|页面|网站|可视化/.test(normalized)) {
    categories.push("frontend");
  }
  if (/产品|需求|方案|验证|用户|闭环/.test(normalized)) {
    categories.push("product");
  }
  if (/内容|分发|小红书|公众号|视频号|写作|文案/.test(normalized)) {
    categories.push("content");
  }

  return categories.length > 0 ? Array.from(new Set(categories)) : ["general"];
}

function parseProjects(lines: string[]): ProfileProject[] {
  return parseBlocks(lines).map(block => {
    const { name, period } = splitNameAndPeriod(block.heading);
    const techLine = block.bullets.find(item => item.startsWith("技术栈："));
    const techStack = techLine
      ? techLine
          .replace(/^技术栈：/, "")
          .split(/[+、,，]/)
          .map(item => item.trim())
          .filter(Boolean)
      : [];
    const highlights = block.bullets.filter(item => !item.startsWith("技术栈："));
    const joined = [name, ...block.bullets].join("\n");

    return {
      name,
      period,
      summary: highlights[0] ?? "",
      techStack,
      highlights,
      categories: inferCategories(joined),
    };
  });
}

function parseExperiences(lines: string[]): ProfileExperience[] {
  return parseBlocks(lines).map(block => {
    const { name, period } = splitNameAndPeriod(block.heading);
    const joined = [name, ...block.bullets].join("\n");

    return {
      title: name,
      period,
      summary: block.bullets[0] ?? "",
      highlights: block.bullets,
      categories: inferCategories(joined),
    };
  });
}

export function buildProfileKnowledge(
  profile = getDefaultProfile()
): ProfileKnowledge {
  if (!profile) {
    throw new Error("Default profile content is not available");
  }

  const sections = parseSections(profile.body);
  const identity = sectionList(sections, SECTION_ALIASES.identity);
  const education = sectionList(sections, SECTION_ALIASES.education);
  const skillLines = sectionList(sections, SECTION_ALIASES.skills);
  const interestLines = sectionList(sections, SECTION_ALIASES.interests);

  return {
    name: profile.name,
    title: PUBLIC_TITLE,
    location: PUBLIC_LOCATION,
    email: PUBLIC_EMAIL,
    bio: profile.bio,
    profile,
    identity,
    education,
    skills: parseSkillGroups(skillLines),
    projects: parseProjects(sections[SECTION_ALIASES.projects] ?? []),
    experiences: parseExperiences(sections[SECTION_ALIASES.experiences] ?? []),
    practices: parseExperiences(sections[SECTION_ALIASES.practices] ?? []),
    interests: parseSkillGroups(interestLines),
    privacyRules: sectionList(sections, SECTION_ALIASES.privacyRules),
    answerRules: sectionList(sections, SECTION_ALIASES.answerRules),
  };
}

export function matchesCategory(categories: string[], category?: string): boolean {
  if (!category || category === "all") return true;
  return categories.includes(category.toLowerCase());
}
