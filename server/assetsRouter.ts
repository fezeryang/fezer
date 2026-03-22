import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { adminProcedure, router } from "./_core/trpc";
import { ENV } from "./_core/env";
import { getDb } from "./db";
import { assets } from "../drizzle/schema";
import {
  checkRateLimit,
  validateMimeType,
  validateMimeExtensionMatch,
  validateFileSize,
  getMaxFileSizeBytes,
  logSecurityEvent,
} from "./_core/security";

const UPLOAD_SESSION_EXPIRY_MS = 15 * 60 * 1000;

const createUploadSessionInput = z.object({
  filename: z
    .string()
    .min(1, "Filename is required")
    .max(255, "Filename too long")
    .refine(
      (name) => !name.includes("..") && !name.startsWith("/"),
      "Invalid filename"
    ),
  mimeType: z.string().min(1, "MIME type is required"),
  size: z.number().int().positive("Size must be positive"),
});

function generateStorageKey(filename: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  const sanitizedName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `assets/${timestamp}-${random}-${sanitizedName}`;
}

function buildUploadUrl(storageKey: string): string {
  const baseUrl = ENV.forgeApiUrl.replace(/\/+$/, "");
  const url = new URL("v1/storage/upload", `${baseUrl}/`);
  url.searchParams.set("path", storageKey);
  return url.toString();
}

function isStorageConfigured(): boolean {
  return Boolean(ENV.forgeApiUrl && ENV.forgeApiKey);
}

function generateRequestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
}

export const assetsRouter = router({
  createUploadSession: adminProcedure
    .input(createUploadSessionInput)
    .mutation(async ({ input, ctx }) => {
      const { filename, mimeType, size } = input;
      const userId = ctx.user.id.toString();
      const requestId = generateRequestId();

      checkRateLimit(userId, "upload");

      if (!validateMimeType(mimeType)) {
        logSecurityEvent("invalid_mime_type", { userId, mimeType, filename });
        console.log(
          `[Upload] requestId=${requestId} event=upload_rejected reason=invalid_mime_type mimeType=${mimeType}`
        );
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "File type not allowed.",
        });
      }

      if (!validateMimeExtensionMatch(mimeType, filename)) {
        logSecurityEvent("mime_extension_mismatch", { userId, mimeType, filename });
        console.log(
          `[Upload] requestId=${requestId} event=upload_rejected reason=mime_extension_mismatch mimeType=${mimeType} filename=${filename}`
        );
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "File extension does not match content type.",
        });
      }

      if (!validateFileSize(size)) {
        logSecurityEvent("file_size_exceeded", { userId, size, filename });
        console.log(
          `[Upload] requestId=${requestId} event=upload_rejected reason=file_size_exceeded size=${size}`
        );
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `File size exceeds maximum of ${getMaxFileSizeBytes() / (1024 * 1024)}MB.`,
        });
      }

      if (!isStorageConfigured()) {
        console.log(
          `[Upload] requestId=${requestId} event=upload_rejected reason=storage_not_configured`
        );
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Storage service unavailable.",
        });
      }

      const storageKey = generateStorageKey(filename);

      const db = await getDb();
      if (!db) {
        console.log(
          `[Upload] requestId=${requestId} event=upload_rejected reason=db_unavailable`
        );
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Service temporarily unavailable.",
        });
      }

      const result = await db.insert(assets).values({
        filename,
        mimeType,
        size,
        storageKey,
        status: "pending_upload",
        uploadedBy: ctx.user.id,
      });

      const assetId = Number(result[0].insertId);
      const uploadUrl = buildUploadUrl(storageKey);
      const expiresAt = new Date(Date.now() + UPLOAD_SESSION_EXPIRY_MS);

      logSecurityEvent("upload_session_created", { userId, filename, size, mimeType });
      console.log(
        `[Upload] requestId=${requestId} event=upload_session_created assetId=${assetId} filename=${filename} size=${size}`
      );

      return {
        assetId,
        uploadUrl,
        expiresAt: expiresAt.toISOString(),
        storageKey,
      };
    }),
});
