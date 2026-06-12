/**
 * 简历数据 - 个人简介
 *
 * 这份导出用于兼容仍然读取 `@fezer/shared/resume` 的代码路径。
 * 内容应与公开简历资料保持一致，避免旧模板或占位信息回流。
 */

/**
 * 个人基本信息
 */
export const PROFILE = {
  name: "Fezer",
  title: "AI 产品与 Agent 工作流实践者",
  location: "北京",
  email: "cookfezer@gmail.com",
  bio: `AI 产品与 Agent 工作流实践者，中央财经大学保险专业硕士在读。

欢迎探索我的互动式 3D 简历，了解我是谁，我能做什么。`,
};

/**
 * 技能标签
 */
export const SKILLS = {
  ai: [
    "AI Agent",
    "Agent 工作流",
    "RAG",
    "多模态 AI 应用",
    "Prompt Engineering",
    "LangChain",
    "LangGraph",
  ],
  product: [
    "需求分析",
    "功能设计",
    "开发验证",
    "场景化测试",
    "数据驱动迭代",
  ],
  data: [
    "Python",
    "Pandas",
    "Scikit-learn",
    "SQL",
    "统计分析",
    "Kaggle 竞赛经验",
  ],
  tools: [
    "Docker",
    "Skill",
    "MCP",
    "Cursor",
    "Claude Code",
    "OpenCode",
    "GitHub Copilot",
    "Codex",
  ],
  content: [
    "新媒体内容策划",
    "自动化发布",
    "内容生成工作流",
    "多平台分发验证",
  ],
  soft: [
    "系统思考",
    "问题拆解",
    "快速学习",
    "跨领域整合",
  ],
};

/**
 * 工作经历
 */
export const EXPERIENCE = [
  {
    company: "B2B 企业 AI 内容生成平台",
    position: "AI 产品实习",
    period: "2025.12 - 2026.03",
    description:
      "参与核心 Agent 模块研发，围绕热点输入、内容生成、多模态素材和自动化分发构建端到端工作流。",
    highlights: [
      "串联 LLM、抓取工具、图像/视频生成 API 与发布接口，支持内容生产与分发自动化。",
      "搭建热点输入模块，结合 Docker 的新闻抓取与企业微信推送流程，形成结构化选题输入。",
      "推进自动发布与海报生成 Agent 工作流，结合 Notion 进行选题与文案管理。",
      "参与多模态生成模块，衔接 Minimax、Remotion、PDF 转视频及数字人方案。",
    ],
  },
  {
    company: "综合实习经历",
    position: "实习生",
    period: "2025.01 - 2025.03",
    description:
      "独立负责全员社保核算与申报工作，参与互联网运营、产品调研与品牌建设。",
    highlights: [
      "搭建标准化管理台账，确保月度处理零差错。",
      "参与多平台账号矩阵与内容分发策略，熟悉用户增长逻辑。",
      "输出产品市场调研与竞品分析报告，理解产品从需求到落地的流程。",
      "协助官网内容优化、新媒体运营和商务合作洽谈。",
    ],
  },
];

/**
 * 教育背景
 */
export const EDUCATION = [
  {
    school: "中央财经大学",
    degree: "保险专业硕士在读",
    period: "在读",
    description: "具备金融、保险、统计、经济与数据分析相关学习背景。",
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
