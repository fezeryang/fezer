import { TRPCError } from "@trpc/server";
import type { Request, Response, NextFunction } from "express";
import type { TrpcContext } from "./context";
import { ENV } from "./env";

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 10;

export function checkRateLimit(userId: string, action: string): void {
  const key = `${userId}:${action}`;
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.set(key, { count: 1, windowStart: now });
    return;
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    logSecurityEvent("rate_limit_exceeded", { userId, action });
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Rate limit exceeded. Please try again later.",
    });
  }

  entry.count++;
}

export function cleanupRateLimits(): void {
  const now = Date.now();
  const entries = Array.from(rateLimitStore.entries());
  for (const [key, entry] of entries) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS * 2) {
      rateLimitStore.delete(key);
    }
  }
}

const cleanupTimer = setInterval(cleanupRateLimits, 5 * 60 * 1000);
cleanupTimer.unref();

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
  "video/mp4",
  "video/webm",
]);

const MIME_EXTENSION_MAP: Record<string, string[]> = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/gif": [".gif"],
  "image/webp": [".webp"],
  "image/svg+xml": [".svg"],
  "application/pdf": [".pdf"],
  "video/mp4": [".mp4"],
  "video/webm": [".webm"],
};

export function validateMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.has(mimeType);
}

export function validateMimeExtensionMatch(
  mimeType: string,
  filename: string
): boolean {
  const allowedExtensions = MIME_EXTENSION_MAP[mimeType];
  if (!allowedExtensions) return false;

  const lowerFilename = filename.toLowerCase();
  return allowedExtensions.some((ext) => lowerFilename.endsWith(ext));
}

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

export function validateFileSize(size: number): boolean {
  return size > 0 && size <= MAX_FILE_SIZE_BYTES;
}

export function getMaxFileSizeBytes(): number {
  return MAX_FILE_SIZE_BYTES;
}

export function createSanitizedError(
  code: "BAD_REQUEST" | "TOO_MANY_REQUESTS" | "PRECONDITION_FAILED" | "INTERNAL_SERVER_ERROR",
  publicMessage: string
): TRPCError {
  return new TRPCError({
    code,
    message: publicMessage,
  });
}

export function toSanitizedError(
  error: unknown,
  context: { route: string; userId?: string }
): TRPCError {
  if (error instanceof TRPCError) {
    const safeCodes = [
      "BAD_REQUEST",
      "NOT_FOUND",
      "CONFLICT",
      "PRECONDITION_FAILED",
      "TOO_MANY_REQUESTS",
      "UNAUTHORIZED",
      "FORBIDDEN",
    ];
    if (safeCodes.includes(error.code)) {
      return error;
    }
  }

  logSecurityEvent("internal_error", {
    route: context.route,
    userId: context.userId,
    errorType: error instanceof Error ? error.constructor.name : typeof error,
  });

  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "An unexpected error occurred. Please try again.",
  });
}

type SecurityEventType =
  | "rate_limit_exceeded"
  | "invalid_mime_type"
  | "mime_extension_mismatch"
  | "file_size_exceeded"
  | "upload_session_created"
  | "post_published"
  | "work_published"
  | "post_deleted"
  | "work_deleted"
  | "internal_error"
  | "cors_blocked";

interface SecurityEventData {
  userId?: string;
  route?: string;
  action?: string;
  filename?: string;
  mimeType?: string;
  size?: number;
  postId?: number;
  workId?: number;
  errorType?: string;
  [key: string]: unknown;
}

const SENSITIVE_KEYS = ["token", "secret", "password", "authorization", "cookie"];

export function logSecurityEvent(
  event: SecurityEventType,
  data: SecurityEventData
): void {
  const safeData = { ...data };
  for (const key of SENSITIVE_KEYS) {
    delete safeData[key];
  }

  const logEntry = {
    timestamp: new Date().toISOString(),
    event,
    ...safeData,
  };

  console.warn("[Security]", JSON.stringify(logEntry));
}

export function getRequestContext(ctx: TrpcContext): {
  userId: string | undefined;
  ip: string | undefined;
  userAgent: string | undefined;
} {
  return {
    userId: ctx.user?.id?.toString(),
    ip: ctx.req.ip || ctx.req.socket?.remoteAddress,
    userAgent: ctx.req.headers["user-agent"],
  };
}

/**
 * CORS middleware with explicit allowlist.
 * 
 * Security model:
 * - In production: ONLY origins in ALLOWED_ORIGINS env var are permitted
 * - In development: localhost origins are auto-allowed for convenience
 * - Credentialed requests (cookies/auth) require explicit origin match, never '*'
 * - Preflight requests (OPTIONS) are handled with proper headers
 * 
 * @returns Express middleware function
 */
export function createCorsMiddleware(): (req: Request, res: Response, next: NextFunction) => void {
  const allowedOrigins = new Set(ENV.allowedOrigins);
  
  return (req: Request, res: Response, next: NextFunction): void => {
    const origin = req.headers.origin;
    
    // If no origin header (same-origin request or non-browser), proceed
    if (!origin) {
      next();
      return;
    }
    
    // Check if origin is allowed
    const isAllowed = isOriginAllowed(origin, allowedOrigins, ENV.isProduction);
    
    if (isAllowed) {
      // Set CORS headers for allowed origin
      // CRITICAL: Use exact origin, not '*', to support credentials
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
      res.setHeader("Access-Control-Max-Age", "86400"); // 24 hours preflight cache
      
      // Handle preflight requests
      if (req.method === "OPTIONS") {
        res.status(204).end();
        return;
      }
    } else {
      // Log blocked origin for security monitoring
      logSecurityEvent("cors_blocked", { 
        blockedOrigin: origin,
        path: req.path,
        method: req.method,
      });
      
      // For preflight requests from blocked origins, return 403
      if (req.method === "OPTIONS") {
        res.status(403).json({ error: "CORS: Origin not allowed" });
        return;
      }
      
      // For actual requests from blocked origins, don't set CORS headers
      // Browser will block the response due to missing Access-Control-Allow-Origin
    }
    
    next();
  };
}

/**
 * Check if an origin is allowed based on allowlist and environment.
 */
function isOriginAllowed(origin: string, allowedOrigins: Set<string>, isProduction: boolean): boolean {
  // Exact match in allowlist
  if (allowedOrigins.has(origin)) {
    return true;
  }
  
  // In development, auto-allow localhost origins
  if (!isProduction) {
    try {
      const url = new URL(origin);
      if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
        return true;
      }
    } catch {
      // Invalid URL, not allowed
      return false;
    }
  }
  
  return false;
}
