/**
 * SSE 解析（客户端）
 *
 * 服务端 /api/chat?stream 把 RunEvent 逐帧写成
 * `event: <type>\ndata: <json>\n\n`（见 server/routes/chat.ts）。
 * 这里只做传输层解析：分帧、取 data 行、JSON.parse，不认识任何具体事件类型。
 */

import type { RunEvent } from "@fezer/shared/schemas/run";

/** 从缓冲区里切出所有完整帧，返回 [事件列表, 剩余不完整片段] */
export function extractSseEvents(buffer: string): {
  events: RunEvent[];
  rest: string;
} {
  const events: RunEvent[] = [];
  let remaining = buffer;

  let boundary = remaining.indexOf("\n\n");
  while (boundary !== -1) {
    const frame = remaining.slice(0, boundary);
    remaining = remaining.slice(boundary + 2);
    const event = parseFrame(frame);
    if (event) {
      events.push(event);
    }
    boundary = remaining.indexOf("\n\n");
  }

  return { events, rest: remaining };
}

function parseFrame(frame: string): RunEvent | undefined {
  const dataLine = frame.split("\n").find(line => line.startsWith("data: "));

  if (!dataLine) {
    return undefined;
  }

  try {
    return JSON.parse(dataLine.slice("data: ".length)) as RunEvent;
  } catch {
    // 坏帧直接丢弃：SSE 是可丢帧的协议，终止事件之前丢帧不该毁掉整个流
    return undefined;
  }
}

/**
 * 消费一条 SSE 响应，把事件依次交给 onEvent。
 *
 * 返回是否以终止事件收尾（run.finished / run.error）。
 * 网络层错误由调用方捕获并降级到非流式请求。
 */
export async function consumeSseResponse(
  response: Response,
  onEvent: (event: RunEvent) => void
): Promise<boolean> {
  if (!response.ok || !response.body) {
    return false;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let terminated = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const { events, rest } = extractSseEvents(buffer);
      buffer = rest;

      for (const event of events) {
        onEvent(event);
        if (event.type === "run.finished" || event.type === "run.error") {
          terminated = true;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return terminated;
}
