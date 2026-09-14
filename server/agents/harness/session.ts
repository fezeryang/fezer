/**
 * Thread 会话存储（A5）
 *
 * 会话历史优先落库（threads / thread_turns），数据库不可用时回退到进程内存 ——
 * 3D 简历的会话属于尽力而为的数据，不值得为它让请求失败（与 content 的内存回退同思路）。
 *
 * 隐私：访客用 localStorage 生成的 threadId 作为 subject，不含 PII；
 * summary 字段留给 compaction（有损文本，不作为恢复依据）。
 */

import { desc, eq, sql } from "drizzle-orm";
import type { FezerType } from "@fezer/shared/schemas/character";
import { threadTurns, threads } from "../../../drizzle/schema";
import { getDb } from "../../db";

export interface StoredTurn {
  role: "user" | "assistant";
  content: string;
  agentId?: FezerType;
}

/** 单线程保留的最大轮数（超出丢弃最早的） */
export const MAX_STORED_TURNS = 40;

const TURN_CHAR_LIMIT = 4000;

/** DB 不可用时的进程内回退 */
const memoryThreads = new Map<string, StoredTurn[]>();

function normalizeTurns(turns: StoredTurn[]): StoredTurn[] {
  return turns.slice(-MAX_STORED_TURNS).map(turn => ({
    ...turn,
    content: turn.content.slice(0, TURN_CHAR_LIMIT),
  }));
}

export async function loadThreadTurns(threadId: string): Promise<StoredTurn[]> {
  const db = await getDb();
  if (!db) {
    return memoryThreads.get(threadId) ?? [];
  }

  try {
    const rows = await db
      .select({
        role: threadTurns.role,
        content: threadTurns.content,
        agentId: threadTurns.agentId,
      })
      .from(threadTurns)
      .where(eq(threadTurns.threadId, threadId))
      .orderBy(desc(threadTurns.seq))
      .limit(MAX_STORED_TURNS);

    return rows
      .reverse()
      .map(row => ({
        role: row.role,
        content: row.content,
        ...(row.agentId ? { agentId: row.agentId as FezerType } : {}),
      }))
      .map(turn => turn);
  } catch (error) {
    console.warn("[thread] 读取会话失败，回退内存:", error);
    return memoryThreads.get(threadId) ?? [];
  }
}

export async function appendThreadTurns(
  threadId: string,
  kind: string,
  turns: StoredTurn[]
): Promise<void> {
  if (turns.length === 0) {
    return;
  }

  const normalized = normalizeTurns(turns);

  // 内存始终写：DB 不可用时本次进程内仍能延续对话
  const current = memoryThreads.get(threadId) ?? [];
  memoryThreads.set(threadId, normalizeTurns([...current, ...normalized]));

  const db = await getDb();
  if (!db) {
    return;
  }

  try {
    await db
      .insert(threads)
      .values({ id: threadId, kind })
      .onDuplicateKeyUpdate({ set: { updatedAt: new Date() } });

    const [row] = await db
      .select({ maxSeq: sql<number | null>`max(${threadTurns.seq})` })
      .from(threadTurns)
      .where(eq(threadTurns.threadId, threadId));
    const startSeq = Number(row?.maxSeq ?? 0) + 1;

    await db.insert(threadTurns).values(
      normalized.map((turn, index) => ({
        threadId,
        seq: startSeq + index,
        role: turn.role,
        agentId: turn.agentId ?? null,
        content: turn.content,
      }))
    );
  } catch (error) {
    console.warn("[thread] 写入会话失败（已留在内存）:", error);
  }
}

/** 仅测试用：清空进程内回退存储 */
export function resetMemoryThreads(): void {
  memoryThreads.clear();
}
