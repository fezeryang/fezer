/**
 * 录音与语音转写（C8 客户端）
 *
 * blob → base64 必须分块：`String.fromCharCode(...bytes)` 在几十 KB 以上就会
 * 撑爆调用栈，而一段几秒的录音轻易就超过这个量级。
 */

import { API_BASE } from "./api-base";

const BASE64_CHUNK_SIZE = 8192;

/** ArrayBuffer → base64（分块拼接，避免栈溢出） */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";

  for (let offset = 0; offset < bytes.length; offset += BASE64_CHUNK_SIZE) {
    const chunk = bytes.subarray(offset, offset + BASE64_CHUNK_SIZE);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

export function blobToBase64(blob: Blob): Promise<string> {
  return blob.arrayBuffer().then(arrayBufferToBase64);
}

/** 浏览器是否具备录音能力（无麦克风权限时仍会失败，这里只判断 API 是否存在） */
export function canRecordAudio(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function" &&
    typeof MediaRecorder !== "undefined"
  );
}

/**
 * 把录音送去转写，返回文字。
 * 失败时抛带用户可读信息的 Error（调用方展示，并提示改用文字输入）。
 */
export async function transcribeAudioBlob(blob: Blob): Promise<string> {
  const audioBase64 = await blobToBase64(blob);

  const response = await fetch(`${API_BASE}/api/voice/transcribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      audioBase64,
      mimeType: blob.type || "audio/webm",
      language: "zh",
    }),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => undefined)) as
      | { message?: string }
      | undefined;
    throw new Error(data?.message ?? "语音识别失败，请改用文字输入。");
  }

  const data = (await response.json()) as { text?: string };
  return typeof data.text === "string" ? data.text : "";
}
