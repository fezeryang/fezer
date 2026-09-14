/**
 * 后端 API 基址（开发默认本地，生产由 VITE_API_URL 指向 Azure VM）
 */
export const API_BASE =
  import.meta.env.VITE_API_URL ?? "http://localhost:3000";
