/**
 * 访客探索进度（C6 的纯客户端存储层）
 *
 * localStorage key `jianli.visitor.v1`：已探索房间、已发现角色、已问问题、
 * 上次会话时间。无 PII、无服务端持久化；清空浏览器数据即重置。
 * 服务端注入进度上下文见 P3（进度随请求发送时服务端才消费）。
 */

const STORAGE_KEY = "jianli.visitor.v1";
const MAX_ASKED_QUESTIONS = 50;

export interface VisitorProgress {
  visitedRooms: string[];
  discoveredCharacters: string[];
  askedQuestions: string[];
  lastSession: string | null;
}

const EMPTY_PROGRESS: VisitorProgress = {
  visitedRooms: [],
  discoveredCharacters: [],
  askedQuestions: [],
  lastSession: null,
};

function read(): VisitorProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY_PROGRESS };

    const parsed = JSON.parse(raw) as Partial<VisitorProgress>;
    return {
      visitedRooms: Array.isArray(parsed.visitedRooms)
        ? parsed.visitedRooms.map(String)
        : [],
      discoveredCharacters: Array.isArray(parsed.discoveredCharacters)
        ? parsed.discoveredCharacters.map(String)
        : [],
      askedQuestions: Array.isArray(parsed.askedQuestions)
        ? parsed.askedQuestions.map(String).slice(-MAX_ASKED_QUESTIONS)
        : [],
      lastSession:
        typeof parsed.lastSession === "string" ? parsed.lastSession : null,
    };
  } catch {
    return { ...EMPTY_PROGRESS };
  }
}

function write(progress: VisitorProgress): VisitorProgress {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // 隐私模式 / 存储满：静默降级为本次会话内记忆
  }
  return progress;
}

function pushUnique(list: string[], value: string, cap = 0): string[] {
  const next = list.filter(item => item !== value);
  next.push(value);
  return cap > 0 ? next.slice(-cap) : next;
}

export function loadVisitorProgress(): VisitorProgress {
  return read();
}

export function markRoomVisited(roomId: string): VisitorProgress {
  const progress = read();
  if (progress.visitedRooms.includes(roomId)) {
    return progress;
  }
  return write({
    ...progress,
    visitedRooms: pushUnique(progress.visitedRooms, roomId),
  });
}

export function markCharacterDiscovered(characterId: string): VisitorProgress {
  const progress = read();
  if (progress.discoveredCharacters.includes(characterId)) {
    return progress;
  }
  return write({
    ...progress,
    discoveredCharacters: pushUnique(
      progress.discoveredCharacters,
      characterId
    ),
  });
}

export function markQuestionAsked(question: string): VisitorProgress {
  const progress = read();
  return write({
    ...progress,
    askedQuestions: pushUnique(
      progress.askedQuestions,
      question,
      MAX_ASKED_QUESTIONS
    ),
  });
}

export function touchSession(): VisitorProgress {
  const progress = read();
  return write({ ...progress, lastSession: new Date().toISOString() });
}
