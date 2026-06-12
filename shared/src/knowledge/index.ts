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

Fezer 是一名 AI 产品与 Agent 工作流实践者，中央财经大学保险专业硕士在读。

他关注如何把真实需求拆解成可运行的 AI 应用，尤其是 Agent 工具编排、RAG 问答、多模态内容生成、数据分析与产品验证。

他的差异化背景是金融、保险与统计分析，但主定位不是金融专家或保险专家。

更适合 AI 产品原型、Agent 工作流、RAG 问答、多模态内容自动化、数据分析驱动的产品验证等方向。`,
  },
  {
    id: "portfolio",
    title: "作品集",
    source: "portfolio",
    text: `作品集

Fezer 参与过多个项目，包括：

1. AI 驱动的期权交易分析平台 - 基于 Gemini 2.5 Pro、Python 和实时金融数据 API
2. 智能客服 Agent 系统 - 基于 RAG、情绪检测和 LLM
3. AI 模拟面试官系统 - 基于语音交互、Pinecone 和 AI 问题匹配
4. 个人主页与项目展示平台 - 使用 GitHub Pages、React 和 Three.js

每个项目都注重用户体验、验证路径和可复用工作流。`,
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
    name: "AI 驱动的期权交易分析平台",
    description:
      "面向期权投资者的 AI 决策辅助平台，流程是实时新闻、公司公告和行情数据进入 AI 综合分析，再辅助生成期权链模拟买卖建议。",
    techStack: ["Gemini 2.5 Pro", "Python", "实时金融数据 API", "Agent 工具链", "K 线可视化"],
    role: "AI 产品与分析",
    highlights: [
      "设计了“100 万虚拟资金 + AI 辅助 / 无 AI 辅助”的对照模块。",
      "用累计收益、胜率、最大回撤等指标量化 AI 辅助对决策结果的影响。",
      "针对复杂金融模型工具调用不稳定的问题，引入工具描述重写、few-shot 示例和 Hook 机制。",
    ],
    source: "portfolio",
  },
  {
    id: "project-2",
    name: "智能客服 Agent 系统",
    description:
      "独立完成从需求分析、方案设计到上线部署的全流程，设计基于 RAG 架构的智能客服解决方案。",
    techStack: ["FastGPT", "RAG", "情绪检测", "LLM"],
    role: "AI 应用开发",
    highlights: [
      "基于场景化测试语料验证语义问答效果。",
      "通过 Prompt 调优将回答准确率提升至 90% 以上。",
      "引入用户情绪检测与动态路由机制，负面情绪自动转人工并生成工单。",
    ],
    source: "portfolio",
  },
  {
    id: "project-3",
    name: "AI 模拟面试官系统",
    description:
      "围绕缺乏真实面试反馈的用户痛点，独立设计并开发支持语音交互的沉浸式 AI 面试系统。",
    techStack: ["ElevenLabs", "Pinecone", "AI 大模型"],
    role: "AI 应用开发",
    highlights: [
      "基于 Pinecone 构建面试题库，实现语义级问题匹配与上下文追问逻辑。",
      "设计多维评分体系，自动生成面试表现分析报告。",
    ],
    source: "portfolio",
  },
  {
    id: "project-4",
    name: "个人主页与项目展示平台",
    description:
      "从零完成个人展示网站的 UI 设计、前端开发与部署，用于集中展示 AI 项目成果与个人作品。",
    techStack: ["OpenCode", "GitHub Pages", "React", "Three.js"],
    role: "前端开发",
    highlights: [
      "基于模块化页面结构沉淀项目介绍、技术栈与成果亮点。",
      "结合 GitHub Pages 实现持续更新与在线托管。",
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
    answer:
      "这是一个互动式 3D 简历网站。与传统简历不同，它通过 3D 空间探索和多角色对话，让访客更生动地了解 Fezer 的能力和经历。",
    category: "general",
    keywords: ["简历", "类型", "介绍"],
  },
  {
    id: "faq-2",
    question: "如何开始探索？",
    answer:
      "建议从 Central Hub 开始，与 Core Fezer 对话了解全局。然后根据兴趣访问不同房间：Builder Room 了解技术能力，AI Lab 了解 AI 项目等。",
    category: "guide",
    keywords: ["开始", "探索", "导览"],
  },
  {
    id: "faq-3",
    question: "Fezer 的技术栈是什么？",
    answer:
      "前端：React、TypeScript、Three.js。AI：Agent 工作流、RAG、LangChain、LangGraph。数据与分析：Python、Pandas、SQL。产品与工程：Docker、MCP、Prompt 调优、场景化测试。",
    category: "technical",
    keywords: ["技术栈", "技能", "技术"],
  },
  {
    id: "faq-4",
    question: "可以联系 Fezer 吗？",
    answer: "可以通过邮箱联系：cookfezer@gmail.com。也欢迎在 GitHub 上查看开源项目。",
    category: "contact",
    keywords: ["联系", "邮箱", "合作"],
  },
];
