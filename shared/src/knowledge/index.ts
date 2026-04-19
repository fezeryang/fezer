/**
 * 知识库 - 网站内容
 * 用于 RAG 检索的结构化内容
 */

/**
 * 网站页面内容
 */
export const WEBSITE_CONTENT = [
  {
    id: "home",
    title: "首页",
    source: "home",
    text: `Fezer 的个人空间

这是一个互动式 3D 简历网站，展示了 Fezer 的技能、项目和个人经历。

网站特点：
- 3D 沉浸式体验
- 多角色互动对话
- 空间化内容组织

访客可以：
1. 与 7 位专家 Fezer 角色对话
2. 探索 7 个主题房间
3. 了解 Fezer 的技术能力和项目经验`,
  },
  {
    id: "about",
    title: "关于",
    source: "about",
    text: `关于 Fezer

Fezer 是一位全栈开发者和 AI 探索者。

他热爱技术，专注于全栈开发和 AI 应用。相信技术可以改变世界，也在不断探索和学习。

技能树涵盖前端、后端、AI 应用等多个领域。喜欢把想法变成现实，无论是构建一个网站，还是设计一个 AI 工作流。

除了技术，也热爱阅读、写作、设计和旅行。这些爱好丰富了生活，也为技术工作提供了灵感和视角。`,
  },
  {
    id: "portfolio",
    title: "作品集",
    source: "portfolio",
    text: `作品集

Fezer 参与过多个项目，包括：

1. 企业级前端应用 - 使用 React、TypeScript、Next.js
2. AI 聊天应用 - 集成 GPT、Claude、Gemini
3. 自动化工作流 - 使用 LangChain、LangGraph
4. 3D 可视化项目 - 使用 Three.js、React Three Fiber

每个项目都注重用户体验和代码质量。`,
  },
  {
    id: "blog",
    title: "博客",
    source: "blog",
    text: `技术博客

Fezer 定期分享技术文章，主题包括：
- 前端开发技巧
- AI 应用实践
- 系统设计思考
- 编程语言探讨

写作风格深入浅出，注重实践和经验分享。`,
  },
];

/**
 * 项目详情
 */
export const PROJECT_DETAILS = [
  {
    id: "project-1",
    name: "企业级前端应用",
    description: "为某科技公司开发的内部管理系统，包括数据可视化、权限管理、工作流审批等功能。",
    techStack: ["React", "TypeScript", "Next.js", "Tailwind CSS", "tRPC", "PostgreSQL"],
    role: "全栈开发",
    highlights: [
      "重构前端项目，提升性能 40%",
      "设计并实现权限管理系统",
      "建立 CI/CD 流程",
    ],
    source: "portfolio",
  },
  {
    id: "project-2",
    name: "AI 聊天应用",
    description: "集成多家 LLM 提供商的智能对话应用，支持多轮对话、工具调用、流式响应。",
    techStack: ["Next.js", "LangChain", "OpenAI API", "Claude API", "Vercel AI SDK"],
    role: "AI 应用开发",
    highlights: [
      "实现统一的 LLM 调用接口",
      "支持流式响应和工具调用",
      "设计灵活的配置系统",
    ],
    source: "portfolio",
  },
  {
    id: "project-3",
    name: "自动化工作流引擎",
    description: "基于 LangGraph 的可视化工作流编排工具，支持拖拽式创建复杂的 AI 工作流。",
    techStack: ["LangChain", "LangGraph", "React", "D3.js", "Node.js", "Express"],
    role: "全栈开发 + AI 架构",
    highlights: [
      "设计直观的节点编辑器",
      "实现工作流版本管理",
      "支持多种 LLM 和工具集成",
    ],
    source: "portfolio",
  },
  {
    id: "project-4",
    name: "3D 数据可视化",
    description: "使用 WebGL 和 Three.js 实现的交互式 3D 数据可视化平台。",
    techStack: ["Three.js", "React Three Fiber", "Drei", "WebGL", "GLSL"],
    role: "前端开发",
    highlights: [
      "实现高性能的 3D 渲染",
      "支持大数据量实时可视化",
      "创建可复用的 3D 组件库",
    ],
    source: "portfolio",
  },
];

/**
 * FAQ - 常见问题
 */
export const FAQ = [
  {
    id: "faq-1",
    question: "这是什么类型的简历？",
    answer: "这是一个互动式 3D 简历网站。与传统简历不同，它通过 3D 空间探索和多角色对话，让访客更生动地了解 Fezer 的能力和经历。",
    category: "general",
    keywords: ["简历", "类型", "介绍"],
  },
  {
    id: "faq-2",
    question: "如何开始探索？",
    answer: "建议从 Central Hub 开始，与 Core Fezer 对话了解全局。然后根据兴趣访问不同房间：Builder Room 了解技术能力，AI Lab 了解 AI 项目等。",
    category: "guide",
    keywords: ["开始", "探索", "导览"],
  },
  {
    id: "faq-3",
    question: "Fezer 的技术栈是什么？",
    answer: "前端：React、TypeScript、Next.js、Tailwind CSS、Three.js。后端：Node.js、Express、tRPC、Drizzle ORM、PostgreSQL。AI：LangChain、LangGraph、OpenAI/Claude API。",
    category: "technical",
    keywords: ["技术栈", "技能", "技术"],
  },
  {
    id: "faq-4",
    question: "可以联系 Fezer 吗？",
    answer: "可以通过邮箱联系：fezer@example.com。也欢迎在 GitHub 上查看开源项目。",
    category: "contact",
    keywords: ["联系", "邮箱", "合作"],
  },
];
