/**
 * 会话线程 id（A5 / C7）
 *
 * 由客户端在 localStorage 生成并复用：服务端据此读写该线程的历史。
 * 只存一个随机 id，不含任何 PII；清空浏览器数据即开新线程。
 */

const STORAGE_KEY = "jianli.thread.v1";

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `t-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** 读取已有线程 id；没有则返回 null（不创建） */
export function getThreadId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** 读取或创建线程 id（发送消息时用） */
export function getOrCreateThreadId(): string {
  const existing = getThreadId();
  if (existing) {
    return existing;
  }

  const id = createId();
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // 隐私模式：id 只在本次会话内有效
  }
  return id;
}
