/**
 * POST /api/voice/transcribe
 *
 * 3D 简历的语音输入（C8）：客户端录音 → base64 → 这里转写成文字，
 * 再由前端填进输入框（不直接发送，用户仍可编辑）。
 *
 * 隐私：音频只在内存里过一遍，不落存储；未配置转写服务时返回 503，
 * 前端据此隐藏/禁用麦克风并提示改用文字。
 */

import type { Request, Response } from "express";
import {
  MAX_TRANSCRIPTION_BYTES,
  transcribeAudioData,
} from "../_core/voiceTranscription";

/** base64 编码后约为原始字节的 1.34 倍，留出余量 */
const MAX_BASE64_CHARS = Math.ceil(MAX_TRANSCRIPTION_BYTES * 1.4);

export async function voiceTranscribeHandler(
  req: Request,
  res: Response
): Promise<void> {
  const { audioBase64, mimeType, language } = req.body as {
    audioBase64?: unknown;
    mimeType?: unknown;
    language?: unknown;
  };

  if (
    typeof audioBase64 !== "string" ||
    audioBase64.length === 0 ||
    audioBase64.length > MAX_BASE64_CHARS
  ) {
    res.status(400).json({
      error: "Invalid audio payload",
      message: "录音数据无效或超过 16MB 上限。",
    });
    return;
  }

  if (typeof mimeType !== "string" || !mimeType.startsWith("audio/")) {
    res.status(400).json({
      error: "Invalid mimeType",
      message: "请提供音频数据（audio/*）。",
    });
    return;
  }

  const result = await transcribeAudioData({
    audioBase64,
    mimeType,
    ...(typeof language === "string" ? { language } : {}),
  });

  if ("error" in result) {
    // 服务未配置 → 503（前端据此降级）；其余按输入问题处理
    const isConfigError = result.details?.includes("is not set") === true;

    res.status(isConfigError ? 503 : 400).json({
      error: result.error,
      code: result.code,
      message: isConfigError
        ? "语音服务暂时不可用，请改用文字输入。"
        : "无法识别这段录音，请重试或改用文字输入。",
    });
    return;
  }

  res.json({
    text: result.text,
    language: result.language,
    duration: result.duration,
  });
}
