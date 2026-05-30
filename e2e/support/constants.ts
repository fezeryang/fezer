export const LOCAL_FRONTEND_BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:4301";

export const LOCAL_API_BASE_URL =
  process.env.PLAYWRIGHT_API_BASE_URL ||
  process.env.VITE_API_URL ||
  "http://127.0.0.1:4300";

export const CHAT_REQUEST_BODY = { userInput: "你好" };
export const EXPECTED_E2E_CHAT_TEXT = "E2E mock agent response";

export type ChatApiResult = {
  success: boolean;
  status?: number;
  hasText?: boolean;
  text?: string;
  error?: string;
};
