/**
 * 房间主动招呼（C1）
 *
 * v1 刻意不做 LLM 调用：用房间自己的文案 + 一条真实内容锚点直接拼两句。
 * 延迟 ≈0、成本 0、可离线测试，也不会把「自动说话」变成额外的 token 开销。
 *
 * 每个房间每次会话只招呼一次；「不再自动出现」开关持久在 localStorage。
 */

const SHOWN_KEY = "jianli.greeting.shown.v1";
const ENABLED_KEY = "jianli.greeting.enabled.v1";

/** 存储不可用（隐私模式/配额）时的统一告警：降级但不静默 */
function warnStorageFailure(action: string, error: unknown): void {
  console.warn(
    `[greeting] ${action} 失败，本次会话内降级:`,
    error instanceof Error ? error.message : error
  );
}

function readShown(): string[] {
  try {
    const raw = localStorage.getItem(SHOWN_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function isGreetingEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setGreetingEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(ENABLED_KEY, enabled ? "on" : "off");
  } catch (error) {
    // 存储不可用时仅本次会话生效
    warnStorageFailure("保存招呼开关", error);
  }
}

/** 该房间本次会话是否还没招呼过 */
export function shouldShowGreeting(roomId: string): boolean {
  return !readShown().includes(roomId);
}

export function markGreetingShown(roomId: string): void {
  try {
    const shown = readShown();
    if (shown.includes(roomId)) return;
    localStorage.setItem(SHOWN_KEY, JSON.stringify([...shown, roomId]));
  } catch (error) {
    warnStorageFailure("记录已招呼房间", error);
  }
}

/** 仅测试用 */
export function resetGreetingState(): void {
  try {
    localStorage.removeItem(SHOWN_KEY);
    localStorage.removeItem(ENABLED_KEY);
  } catch (error) {
    warnStorageFailure("重置招呼状态", error);
  }
}

interface GreetingRoom {
  name: string;
  summary: string;
}

interface GreetingAnchor {
  title: string;
}

/**
 * 两句以内的招呼：房间定位 + 一条真实内容锚点。
 * 没有内容时退回引导语句，而不是空白或编造。
 */
export function buildRoomGreeting(
  room: GreetingRoom,
  works: GreetingAnchor[],
  posts: GreetingAnchor[]
): string {
  const anchor = works[0] ?? posts[0];
  const base = `这里是${room.name}：${room.summary}`;

  if (!anchor) {
    return `${base} 这个房间的内容还在整理，先随便聊聊？`;
  }

  return `${base} 比如《${anchor.title}》就在这个房间。`;
}
