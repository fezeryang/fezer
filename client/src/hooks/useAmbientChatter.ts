/**
 * useAmbientChatter - 房间环境闲聊调度（D4，零后端）
 *
 * 进入房间 4–8s 后，从该房间的 chatter 对话池挑一组台词，
 * 让房间内两个角色轮流"对话"：A 3.6s → 空 1.6s → B 3.4s → 间隔 9–14s 再来一轮。
 *
 * 抑制（suppressed）：房间内有招呼/agent 活动气泡，或页面不可见 —— 有"正经事"时闲聊让位。
 * 房间切换 / suppressed 变化即清场重排。
 */

import { useEffect, useState } from "react";
import {
  chatterIntervals,
  pickChatterExchange,
  type CharacterMood,
} from "@/lib/scene-bubbles";

export interface AmbientChatter {
  characterId: string;
  text: string;
}

// 每阶段时长（ms）：A 台词 → 间隔 → B 台词 → B 停留
const LINE_DURATION_MS = 3600;
const GAP_DURATION_MS = 1600;
const REPLY_DURATION_MS = 3400;

export function useAmbientChatter(
  roomId: string | undefined,
  suppressed: boolean,
  mood?: CharacterMood
): AmbientChatter | null {
  const [chatter, setChatter] = useState<AmbientChatter | null>(null);

  useEffect(() => {
    setChatter(null);
    if (!roomId) return;

    // 情绪影响调度（咖啡=频率翻倍）与台词池（D7）
    const intervals = chatterIntervals(mood);

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const schedule = (delay: number) => {
      const timer = setTimeout(() => {
        if (cancelled) return;
        // 被抑制或页面不可见：本轮跳过，稍后再试
        if (suppressed || document.hidden) {
          schedule(8000 + Math.random() * 6000);
          return;
        }

        const exchange = pickChatterExchange(roomId, mood);
        if (!exchange) return;

        setChatter({ characterId: exchange.a, text: exchange.lines[0] });
        timers.push(
          setTimeout(() => {
            if (cancelled) return;
            setChatter(null);
            timers.push(
              setTimeout(() => {
                if (cancelled || suppressed || document.hidden) {
                  schedule(intervals.nextRoundDelay());
                  return;
                }
                setChatter({
                  characterId: exchange.b,
                  text: exchange.lines[1],
                });
                timers.push(
                  setTimeout(() => {
                    if (cancelled) return;
                    setChatter(null);
                    schedule(intervals.nextRoundDelay());
                  }, REPLY_DURATION_MS)
                );
              }, GAP_DURATION_MS)
            );
          }, LINE_DURATION_MS)
        );
      }, delay);
      timers.push(timer);
    };

    schedule(intervals.firstDelay());

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
    // suppressed/mood 进依赖：一变就清场重排，避免旧节奏/旧台词池残留
  }, [roomId, suppressed, mood]);

  return chatter;
}
