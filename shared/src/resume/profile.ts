/**
 * 简历数据 - 个人简介
 */

/**
 * 个人基本信息
 */
export const PROFILE = {
  name: "Fezer",
  title: "全栈开发者 & AI 探索者",
  location: "中国",
  email: "fezer@example.com",
  bio: `我是一个热爱技术的人，专注于全栈开发和 AI 应用。我相信技术可以改变世界，也在不断探索和学习。

我的技能树涵盖前端、后端、AI 应用等多个领域。我喜欢把想法变成现实，无论是构建一个网站，还是设计一个 AI 工作流。

除了技术，我也热爱阅读、写作、设计和旅行。这些爱好不仅丰富了我的生活，也为我的技术工作提供了灵感和视角。

欢迎探索我的互动式 3D 简历，了解我是谁，我能做什么。`,
};

/**
 * 技能标签
 */
export const SKILLS = {
  frontend: ["React", "TypeScript", "Next.js", "Tailwind CSS", "Three.js", "Vite"],
  backend: ["Node.js", "Express", "tRPC", "Drizzle ORM", "PostgreSQL", "MySQL"],
  ai: ["LangChain", "LangGraph", "OpenAI API", "Claude API", "Agent Workflow"],
  tools: ["Git", "Docker", "GitHub Actions", "Vercel", "ESLint", "Prettier"],
  design: ["Figma", "UI Design", "3D Modeling", "Photography"],
  soft: ["技术写作", "系统思考", "问题拆解", "快速学习", "跨领域整合"],
};

/**
 * 工作经历
 */
export const EXPERIENCE = [
  {
    company: "某科技公司",
    position: "全栈工程师",
    period: "2022 - 至今",
    description: "负责公司核心产品的全栈开发，包括前端架构、后端 API 设计和 AI 功能集成。",
    highlights: [
      "重构前端项目，提升性能 40%",
      "设计并实现 AI 聊天功能",
      "建立 CI/CD 流程，提升部署效率",
    ],
  },
  {
    company: "某创业公司",
    position: "前端开发者",
    period: "2020 - 2022",
    description: "负责公司产品的前端开发和用户界面设计。",
    highlights: [
      "从零搭建 React + TypeScript 项目",
      "实现响应式设计，支持多端适配",
      "优化首屏加载速度，提升用户体验",
    ],
  },
];

/**
 * 教育背景
 */
export const EDUCATION = [
  {
    school: "某大学",
    degree: "计算机科学与技术",
    period: "2016 - 2020",
    description: "系统学习计算机基础课程，包括数据结构、算法、操作系统、网络等。",
  },
];

/**
 * 兴趣爱好
 */
export const INTERESTS = {
  reading: ["技术书籍", "科幻小说", "哲学", "心理学"],
  writing: ["技术博客", "思考笔记", "读书笔记"],
  design: ["UI 设计", "3D 建模", "摄影"],
  travel: ["徒步", "自驾游", "城市探索"],
  ai: ["LLM 应用", "Agent 开发", "自动化工作流"],
};
