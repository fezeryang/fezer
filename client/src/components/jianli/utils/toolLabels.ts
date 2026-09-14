/**
 * 工具名 → 用户可见的思考步骤文案
 *
 * 与服务端 tool.call/tool.result 事件里的 toolName 一一对应
 * （见 server/agents/tools/index.ts 注册表）。未知工具回退到通用文案，
 * 不把内部英文工具名泄漏给访客。
 */

const TOOL_LABELS: Record<string, string> = {
  get_profile_full: "正在查阅完整简历档案",
  get_profile: "正在检索个人简介",
  get_skills: "正在核对技能列表",
  get_projects: "正在检索项目经历",
  get_interests: "正在检索兴趣方向",
  search_content: "正在检索站内内容",
  get_blog_posts: "正在检索博客文章",
  get_works_detail: "正在检索作品详情",
  ask_other_agent: "正在咨询其他专家",
  ask_multiple_agents: "正在并行咨询多位专家",
  ask_other_agent_tool: "正在咨询其他专家",
};

const FALLBACK_LABEL = "正在检索信息";

export function toolLabel(toolName: string): string {
  return TOOL_LABELS[toolName] ?? FALLBACK_LABEL;
}
