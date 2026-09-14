/**
 * Voice transcription helper using internal Speech-to-Text service
 *
 * Frontend implementation guide:
 * 1. Capture audio using MediaRecorder API
 * 2. Upload audio to storage (e.g., S3) to get URL
 * 3. Call transcription with the URL
 * 
 * Example usage:
 * ```tsx
 * // Frontend component
 * const transcribeMutation = trpc.voice.transcribe.useMutation({
 *   onSuccess: (data) => {
 *     console.log(data.text); // Full transcription
 *     console.log(data.language); // Detected language
 *     console.log(data.segments); // Timestamped segments
 *   }
 * });
 * 
 * // After uploading audio to storage
 * transcribeMutation.mutate({
 *   audioUrl: uploadedAudioUrl,
 *   language: 'en', // optional
 *   prompt: 'Transcribe the meeting' // optional
 * });
 * ```
 */
import { ENV } from "./env";

export type WhisperSegment = {
  id: number;
  seek: number;
  start: number;
  end: number;
  text: string;
  tokens: number[];
  temperature: number;
  avg_logprob: number;
  compression_ratio: number;
  no_speech_prob: number;
};

// Native Whisper API response format
export type WhisperResponse = {
  task: "transcribe";
  language: string;
  duration: number;
  text: string;
  segments: WhisperSegment[];
};

export type TranscriptionResponse = WhisperResponse; // Return native Whisper API response directly

export type TranscriptionError = {
  error: string;
  code: "FILE_TOO_LARGE" | "INVALID_FORMAT" | "TRANSCRIPTION_FAILED" | "UPLOAD_FAILED" | "SERVICE_ERROR";
  details?: string;
};

const TRANSCRIPTION_PROMPT_VERSION = "fezer.transcription-prompt.v2.stage1";

export function buildDefaultTranscriptionPrompt(language?: string): string {
  const languageContext = language
    ? `用户工作语言：${getLanguageName(language)}。`
    : "用户语言未显式提供，请根据音频自动识别。";

  return [
    `你是语音转写助手（${TRANSCRIPTION_PROMPT_VERSION}）。`,
    "任务：将语音内容忠实转写为文本。",
    languageContext,
    "输出要求：",
    "1) 仅转写听到的内容，不润色、不总结、不解释。",
    "2) 听不清的片段保留原样并使用 [inaudible] 标记，不要猜测补全。",
    "3) 保留说话者口语特征和关键术语，避免语义改写。",
  ].join("\n");
}

/**
 * Transcribe audio to text using the internal Speech-to-Text service
 * 
 * @param options - Audio data and metadata
 * @returns Transcription result or error
 */
/** 语音转写服务配置校验 */
function requireTranscriptionConfig(): TranscriptionError | undefined {
  if (!ENV.forgeApiUrl) {
    return {
      error: "Voice transcription service is not configured",
      code: "SERVICE_ERROR",
      details: "BUILT_IN_FORGE_API_URL is not set",
    };
  }
  if (!ENV.forgeApiKey) {
    return {
      error: "Voice transcription service authentication is missing",
      code: "SERVICE_ERROR",
      details: "BUILT_IN_FORGE_API_KEY is not set",
    };
  }
  return undefined;
}

/** 组装 multipart 请求体（Whisper 兼容） */
function buildTranscriptionFormData(
  audioBuffer: Buffer,
  mimeType: string,
  options: { language?: string; prompt?: string },
): FormData {
  const formData = new FormData();

  const filename = `audio.${getFileExtension(mimeType)}`;
  const audioBlob = new Blob([new Uint8Array(audioBuffer)], { type: mimeType });
  formData.append("file", audioBlob, filename);

  formData.append("model", "whisper-1");
  formData.append("response_format", "verbose_json");

  // Prefer user prompt when provided; otherwise use stable internal template.
  const prompt =
    options.prompt || buildDefaultTranscriptionPrompt(options.language);
  formData.append("prompt", prompt);

  return formData;
}

/** 调用转写服务并校验响应 */
async function postTranscriptionFormData(
  formData: FormData,
): Promise<TranscriptionResponse | TranscriptionError> {
  try {
    const baseUrl = ENV.forgeApiUrl.endsWith("/")
      ? ENV.forgeApiUrl
      : `${ENV.forgeApiUrl}/`;

    const fullUrl = new URL("v1/audio/transcriptions", baseUrl).toString();

    const response = await fetch(fullUrl, {
      method: "POST",
      headers: {
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "Accept-Encoding": "identity",
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      return {
        error: "Transcription service request failed",
        code: "TRANSCRIPTION_FAILED",
        details: `${response.status} ${response.statusText}${errorText ? `: ${errorText}` : ""}`,
      };
    }

    const whisperResponse = (await response.json()) as WhisperResponse;

    if (!whisperResponse.text || typeof whisperResponse.text !== "string") {
      return {
        error: "Invalid transcription response",
        code: "SERVICE_ERROR",
        details: "Transcription service returned an invalid response format",
      };
    }

    return whisperResponse;
  } catch (error) {
    return {
      error: "Voice transcription failed",
      code: "SERVICE_ERROR",
      details:
        error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}

/** 音频体积上限（转写服务限制 16MB） */
export const MAX_TRANSCRIPTION_BYTES = 16 * 1024 * 1024;

export type TranscribeDataOptions = {
  /** base64 编码的音频（客户端录音直接上传，无需先落存储） */
  audioBase64: string;
  mimeType: string;
  language?: string;
  prompt?: string;
};

/**
 * 直接转写内存中的音频（C8 语音输入）。
 *
 * 访客录音没有可落存储的 URL，所以走 base64 → 服务端解码后进同一套
 * formData/POST 流程。旧的「传 URL 再下载」入口已删除：它零消费者，
 * 且拿调用方给的 URL 直接 fetch 就是 SSRF 跳板（探测内网服务）。
 */
export async function transcribeAudioData(
  options: TranscribeDataOptions,
): Promise<TranscriptionResponse | TranscriptionError> {
  const configError = requireTranscriptionConfig();
  if (configError) {
    return configError;
  }

  const audioBuffer = Buffer.from(options.audioBase64, "base64");
  if (audioBuffer.byteLength === 0) {
    return {
      error: "Empty audio payload",
      code: "INVALID_FORMAT",
      details: "Decoded audio contained no bytes",
    };
  }
  if (audioBuffer.byteLength > MAX_TRANSCRIPTION_BYTES) {
    return {
      error: "Audio file exceeds maximum size limit",
      code: "FILE_TOO_LARGE",
      details: `Audio is ${(audioBuffer.byteLength / (1024 * 1024)).toFixed(2)}MB, maximum allowed is 16MB`,
    };
  }

  return postTranscriptionFormData(
    buildTranscriptionFormData(audioBuffer, options.mimeType, options),
  );
}

/**
 * Helper function to get file extension from MIME type
 */
function getFileExtension(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'audio/webm': 'webm',
    'audio/mp3': 'mp3',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/wave': 'wav',
    'audio/ogg': 'ogg',
    'audio/m4a': 'm4a',
    'audio/mp4': 'm4a',
  };
  
  return mimeToExt[mimeType] || 'audio';
}

/**
 * Helper function to get full language name from ISO code
 */
function getLanguageName(langCode: string): string {
  const langMap: Record<string, string> = {
    'en': 'English',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'it': 'Italian',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'ja': 'Japanese',
    'ko': 'Korean',
    'zh': 'Chinese',
    'ar': 'Arabic',
    'hi': 'Hindi',
    'nl': 'Dutch',
    'pl': 'Polish',
    'tr': 'Turkish',
    'sv': 'Swedish',
    'da': 'Danish',
    'no': 'Norwegian',
    'fi': 'Finnish',
  };
  
  return langMap[langCode] || langCode;
}

/**
 * Example tRPC procedure implementation:
 * 
 * ```ts
 * // In server/routers.ts
 * import { transcribeAudio } from "./_core/voiceTranscription";
 * 
 * export const voiceRouter = router({
 *   transcribe: protectedProcedure
 *     .input(z.object({
 *       audioUrl: z.string(),
 *       language: z.string().optional(),
 *       prompt: z.string().optional(),
 *     }))
 *     .mutation(async ({ input, ctx }) => {
 *       const result = await transcribeAudio(input);
 *       
 *       // Check if it's an error
 *       if ('error' in result) {
 *         throw new TRPCError({
 *           code: 'BAD_REQUEST',
 *           message: result.error,
 *           cause: result,
 *         });
 *       }
 *       
 *       // Optionally save transcription to database
 *       await db.insert(transcriptions).values({
 *         userId: ctx.user.id,
 *         text: result.text,
 *         duration: result.duration,
 *         language: result.language,
 *         audioUrl: input.audioUrl,
 *         createdAt: new Date(),
 *       });
 *       
 *       return result;
 *     }),
 * });
 * ```
 */
