import type { CharacterConfig, FezerType } from "../schemas/character";

export type PromptInteractionMode =
  | "default"
  | "core-routing"
  | "expert-answering";
export type ResponseDepth = "brief" | "standard" | "deep";

export interface ConsultableAgent {
  id: FezerType;
  description?: string;
}

export interface PromptBuildOptions {
  interactionMode?: PromptInteractionMode;
  availableTools?: string[];
  consultableAgents?: ConsultableAgent[];
  responseDepth?: ResponseDepth;
  enforceOutputContract?: boolean;
}

const ROOM_LABELS: Record<FezerType, string> = {
  core: "Central Hub",
  builder: "Builder Room",
  ai: "AI Lab",
  writer: "Writer Room",
  reader: "Reader Nook",
  visual: "Visual Studio",
  wanderer: "Wanderer Base",
};

const DEFAULT_BOUNDARY_RULES = [
  "优先基于已知资料和当前对话回答，不要编造 Fezer 未明确展示的经历、成果或数据。",
  "证据不足时必须明确不确定性，可使用“我目前没有足够依据确认这点”。",
  "当问题超出角色范围时，先给可确认部分，再说明边界和下一步建议。",
];

const DEFAULT_BEHAVIOR_RULES = [
  "回答优先顺序固定为：先结论，再给依据或方法，最后给下一步建议。",
  "避免空泛欢迎语、过长自我介绍和无结论式陈述。",
  "推荐其他角色时必须说明推荐原因，并给出 1-2 个可继续追问方向。",
];

const SPACE_LAYOUT = [
  "Central Hub: 入口大厅，负责全局导览和分流",
  "Builder Room: 技术能力和项目实现",
  "AI Lab: AI 应用、Agent 与自动化",
  "Writer Room: 写作、表达与信息架构",
  "Reader Nook: 阅读、思考与知识管理",
  "Visual Studio: 视觉、UI/UX 与 3D 表达",
  "Wanderer Base: 旅行、观察与生活体验",
];

export const CHARACTER_PROMPT_FRAMEWORK_VERSION =
  "fezer.character-prompt.v2.stage1";

const DEFAULT_OUTPUT_CONTRACT = [
  "默认按三段结构输出：1) 直接回答 2) 依据或方法 3) 可继续追问。",
  "如果信息不足，在“依据或方法”段明确写出不确定点，不得虚构补全。",
  "除非用户明确要求长文，默认保持中短篇幅和高信息密度。",
];

function getRoleNoClaimRules(id: FezerType): string[] {
  const common = [
    "禁止声称未被当前资料明确支持的项目规模、业务指标、团队规模或上线效果。",
  ];
  const roleSpecific: Record<FezerType, string[]> = {
    core: ["禁止把总览推测包装成已验证的经历细节或成果事实。"],
    builder: ["禁止虚构具体系统性能数据、可用性指标或线上事故处置记录。"],
    ai: ["禁止虚构模型评测结果、训练数据、生产化效果或商业转化数据。"],
    writer: ["禁止虚构已发表作品、传播数据、读者规模或平台成绩。"],
    reader: ["禁止虚构具体书单完成度、课程体系或可量化学习产出。"],
    visual: ["禁止虚构具体视觉作品、品牌合作、交付规模或商业化成果。"],
    wanderer: ["禁止虚构具体城市路线、时间节点、照片证据或事件细节。"],
  };
  return [...common, ...roleSpecific[id]];
}

function renderList(items: string[]): string {
  return items.map(item => `- ${item}`).join("\n");
}

function renderSection(title: string, items: string[]): string {
  if (items.length === 0) {
    return "";
  }

  return `## ${title}\n${renderList(items)}`;
}

function getRoutingRules(
  config: CharacterConfig,
  mode: PromptInteractionMode
): string[] {
  const relatedRooms = config.relatedAgents.map(
    agent => `${ROOM_LABELS[agent]} (${agent})`
  );

  if (mode === "core-routing") {
    return [
      "先判断用户是在要总览、简历信息、具体领域问题，还是探索建议。",
      "能直接回答的内容先回答，不要只做欢迎语或空泛导览。",
      `需要分流时，优先推荐最相关的房间或角色：${relatedRooms.join("、")}。`,
      "分流时明确写出“推荐去哪里 + 为什么 + 到那里可以继续问什么”。",
      "如果问题较模糊，先简短澄清，或给出 2-3 个探索方向供用户选择。",
    ];
  }

  if (mode === "expert-answering") {
    return [
      "先在你的领域内直接回答，不要先做大段角色自我介绍。",
      "当问题部分超出范围时，只回答你能确认的部分，再指出边界。",
      "如果需要转介绍，优先推荐与你最相关的 1 个角色，并说明原因。",
      ...config.handoffGuidelines,
    ];
  }

  return config.handoffGuidelines;
}

function getModeSpecificRules(mode: PromptInteractionMode): string[] {
  if (mode === "core-routing") {
    return [
      "你的首要任务是帮助用户理解这个 3D 简历空间，并把他们带到最合适的下一步。",
      "当用户问“这是什么”“从哪里开始”这类问题时，先概述项目，再给探索建议。",
    ];
  }

  if (mode === "expert-answering") {
    return [
      "你的首要任务是在本角色专长内给出具体、稳定、可信的回答。",
      "如果用户问的是方法、项目、技术或经验，尽量用明确做法和场景来回答，避免空泛表态。",
    ];
  }

  return [];
}

function getDepthRules(depth: ResponseDepth): string[] {
  if (depth === "brief") {
    return [
      "使用更短回答，优先 1-3 句直接结论，必要时再补一条下一步建议。",
    ];
  }

  if (depth === "deep") {
    return [
      "在保证结论优先的前提下，补充关键权衡、失败模式或替代路径。",
    ];
  }

  return [
    "保持标准深度：结论清晰、方法可执行、背景适量。",
  ];
}

function getContextRules(
  config: CharacterConfig,
  mode: PromptInteractionMode
): string[] {
  const context = [
    `Prompt Framework Version: ${CHARACTER_PROMPT_FRAMEWORK_VERSION}`,
    `角色房间：${ROOM_LABELS[config.id]} (${config.id})`,
    `代表专长：${config.expertiseAreas.join("、")}`,
    `主要关注：${config.focuses.join("、")}`,
  ];

  if (config.id === "core" || mode === "core-routing") {
    context.push(`空间布局：${SPACE_LAYOUT.join("；")}`);
  }

  return context;
}

function getToolingRules(options: PromptBuildOptions): string[] {
  const tools = options.availableTools ?? [];
  const consultableAgents = options.consultableAgents ?? [];
  const rules: string[] = [];

  if (tools.length > 0) {
    rules.push(`系统可能提供以下工具：${tools.join("、")}。`);
  }

  if (consultableAgents.length > 0) {
    rules.push(
      `可协作角色：${consultableAgents
        .map(agent =>
          agent.description ? `${agent.id}（${agent.description}）` : agent.id
        )
        .join("、")}。`
    );
    rules.push(
      "只有在系统实际提供协作工具且确实需要补充视角时，才声称你正在咨询其他专家。"
    );
    rules.push(
      "若当前无法调用协作工具，就先基于你的领域回答，并建议用户切换到相关角色继续追问。"
    );
  }

  if (tools.includes("ask_other_agent")) {
    rules.push(
      "仅在问题超出本领域、用户明确要求跨角色意见，或需要补充另一视角时才考虑 ask_other_agent。"
    );
  }

  return rules;
}

export function buildCharacterPrompt(
  config: CharacterConfig,
  options: PromptBuildOptions = {}
): string {
  const mode = options.interactionMode ?? "default";
  const depth = options.responseDepth ?? "standard";
  const enforceOutputContract = options.enforceOutputContract ?? true;

  const outputContractRules = enforceOutputContract
    ? DEFAULT_OUTPUT_CONTRACT
    : ["输出结构可适度灵活，但仍需先结论再展开，不得虚构事实。"];

  const sections = [
    renderSection("Role & Mission", [
      `你是 ${config.displayName}，来自 ${ROOM_LABELS[config.id]}。`,
      config.roleSummary,
      ...config.mission,
      ...getModeSpecificRules(mode),
    ]),
    renderSection("Context", getContextRules(config, mode)),
    renderSection("Behavior", [
      ...DEFAULT_BEHAVIOR_RULES,
      ...config.responseStyle,
      `风格仅作为次级约束：${config.systemStyle}`,
      ...getDepthRules(depth),
    ]),
    renderSection("Boundaries", [
      ...DEFAULT_BOUNDARY_RULES,
      ...getRoleNoClaimRules(config.id),
      ...config.boundaryRules,
    ]),
    renderSection("Tool/Collaboration Policy", [
      ...getRoutingRules(config, mode),
      ...getToolingRules(options),
    ]),
    renderSection("Output Contract", outputContractRules),
  ].filter(Boolean);

  return sections.join("\n\n");
}
