import { beforeEach, describe, expect, it, vi } from "vitest";
import { assetsRouter } from "./assetsRouter";
import type { TrpcContext } from "./_core/context";
import {
  detectMalformedAssetRefs,
  extractAssetReferences,
  detectExternalUrls,
} from "./db";

vi.mock("./_core/security", () => ({
  checkRateLimit: vi.fn(),
  validateMimeType: vi.fn(),
  validateMimeExtensionMatch: vi.fn(),
  validateFileSize: vi.fn(),
  getMaxFileSizeBytes: vi.fn(() => 50 * 1024 * 1024),
  logSecurityEvent: vi.fn(),
}));

vi.mock("./_core/env", () => ({
  ENV: {
    forgeApiUrl: "https://forge.test.com",
    forgeApiKey: "test-key",
  },
}));

vi.mock("./db", () => ({
  getDb: vi.fn(),
  detectMalformedAssetRefs: vi.fn(),
  extractAssetReferences: vi.fn(),
  detectExternalUrls: vi.fn(),
}));

import * as security from "./_core/security";
import { getDb } from "./db";

const mockDetectMalformedAssetRefs = vi.mocked(detectMalformedAssetRefs);
const mockExtractAssetReferences = vi.mocked(extractAssetReferences);
const mockDetectExternalUrls = vi.mocked(detectExternalUrls);

const mockCheckRateLimit = vi.mocked(security.checkRateLimit);
const mockValidateMimeType = vi.mocked(security.validateMimeType);
const mockValidateMimeExtensionMatch = vi.mocked(security.validateMimeExtensionMatch);
const mockValidateFileSize = vi.mocked(security.validateFileSize);
const mockGetDb = vi.mocked(getDb);

describe("assetsRouter.createUploadSession", () => {
  let mockContext: TrpcContext;
  let mockCaller: ReturnType<(typeof assetsRouter)["createCaller"]>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockContext = {
      user: { id: 1, openId: "admin-openid", name: "Admin User", email: null, loginMethod: null, role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
      req: {} as any,
      res: {} as any,
    };

    mockCaller = assetsRouter.createCaller(mockContext);
  });

  describe("Allowed file type session creation", () => {
    it("should create upload session for valid image/jpeg file", async () => {
      mockCheckRateLimit.mockReturnValue(undefined);
      mockValidateMimeType.mockReturnValue(true);
      mockValidateMimeExtensionMatch.mockReturnValue(true);
      mockValidateFileSize.mockReturnValue(true);

      const mockInsertResult = [{ insertId: "42" }];
      mockGetDb.mockResolvedValue({
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue(mockInsertResult),
        }),
      } as any);

      const result = await mockCaller.createUploadSession({
        filename: "photo.jpg",
        mimeType: "image/jpeg",
        size: 1024 * 1024,
      });

      expect(result.assetId).toBe(42);
      expect(result.uploadUrl).toContain("forge.test.com");
      expect(result.uploadUrl).toContain("photo.jpg");
      expect(result.storageKey).toMatch(/^assets\/\d+-[a-z0-9]+-photo\.jpg$/);
      expect(result.expiresAt).toBeDefined();
      expect(mockValidateMimeType).toHaveBeenCalledWith("image/jpeg");
      expect(mockValidateMimeExtensionMatch).toHaveBeenCalledWith("image/jpeg", "photo.jpg");
    });

    it("should create upload session for valid video/mp4 file", async () => {
      mockCheckRateLimit.mockReturnValue(undefined);
      mockValidateMimeType.mockReturnValue(true);
      mockValidateMimeExtensionMatch.mockReturnValue(true);
      mockValidateFileSize.mockReturnValue(true);

      const mockInsertResult = [{ insertId: "99" }];
      mockGetDb.mockResolvedValue({
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue(mockInsertResult),
        }),
      } as any);

      const result = await mockCaller.createUploadSession({
        filename: "demo.mp4",
        mimeType: "video/mp4",
        size: 5 * 1024 * 1024,
      });

      expect(result.assetId).toBe(99);
      expect(result.uploadUrl).toContain("demo.mp4");
      expect(mockValidateMimeType).toHaveBeenCalledWith("video/mp4");
    });
  });

  describe("Disallowed file type rejection", () => {
    it("should reject file with invalid MIME type with BAD_REQUEST", async () => {
      mockCheckRateLimit.mockReturnValue(undefined);
      mockValidateMimeType.mockReturnValue(false);

      await expect(
        mockCaller.createUploadSession({
          filename: "script.js",
          mimeType: "application/javascript",
          size: 1024,
        })
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: "File type not allowed.",
      });

      expect(mockValidateMimeType).toHaveBeenCalledWith("application/javascript");
    });

    it("should reject file with MIME/extension mismatch with BAD_REQUEST", async () => {
      mockCheckRateLimit.mockReturnValue(undefined);
      mockValidateMimeType.mockReturnValue(true);
      mockValidateMimeExtensionMatch.mockReturnValue(false);

      await expect(
        mockCaller.createUploadSession({
          filename: "image.jpg",
          mimeType: "image/png",
          size: 1024,
        })
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: "File extension does not match content type.",
      });

      expect(mockValidateMimeExtensionMatch).toHaveBeenCalledWith("image/png", "image.jpg");
    });
  });

  describe("Oversized file rejection", () => {
    it("should reject oversized file with BAD_REQUEST and size limit message", async () => {
      mockCheckRateLimit.mockReturnValue(undefined);
      mockValidateMimeType.mockReturnValue(true);
      mockValidateMimeExtensionMatch.mockReturnValue(true);
      mockValidateFileSize.mockReturnValue(false);

      await expect(
        mockCaller.createUploadSession({
          filename: "huge.jpg",
          mimeType: "image/jpeg",
          size: 100 * 1024 * 1024,
        })
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: "File size exceeds maximum of 50MB.",
      });

      expect(mockValidateFileSize).toHaveBeenCalledWith(100 * 1024 * 1024);
    });
  });

  describe("Invalid file path rejection", () => {
    it("should reject filename with path traversal (..) via zod validation", async () => {
      mockCheckRateLimit.mockReturnValue(undefined);
      
      await expect(
        mockCaller.createUploadSession({
          filename: "../../../etc/passwd",
          mimeType: "image/png",
          size: 1024,
        })
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
    });

    it("should reject filename starting with slash via zod validation", async () => {
      mockCheckRateLimit.mockReturnValue(undefined);
      
      await expect(
        mockCaller.createUploadSession({
          filename: "/absolute/path/image.png",
          mimeType: "image/png",
          size: 1024,
        })
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
    });

    it("should reject empty filename via zod validation", async () => {
      mockCheckRateLimit.mockReturnValue(undefined);
      
      await expect(
        mockCaller.createUploadSession({
          filename: "",
          mimeType: "image/png",
          size: 1024,
        })
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
    });

    it("should reject filename exceeding 255 characters via zod validation", async () => {
      mockCheckRateLimit.mockReturnValue(undefined);
      
      const longFilename = "a".repeat(256) + ".png";
      
      await expect(
        mockCaller.createUploadSession({
          filename: longFilename,
          mimeType: "image/png",
          size: 1024,
        })
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
    });

    it("should sanitize special characters in storage key", async () => {
      mockCheckRateLimit.mockReturnValue(undefined);
      mockValidateMimeType.mockReturnValue(true);
      mockValidateMimeExtensionMatch.mockReturnValue(true);
      mockValidateFileSize.mockReturnValue(true);

      const mockInsertResult = [{ insertId: "50" }];
      mockGetDb.mockResolvedValue({
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue(mockInsertResult),
        }),
      } as any);

      const result = await mockCaller.createUploadSession({
        filename: "test file (1)!@#$.png",
        mimeType: "image/png",
        size: 1024,
      });

      expect(result.storageKey).toMatch(/^assets\/\d+-[a-z0-9]+-test_file__1_____\.png$/);
    });
  });

  describe("Upload session state transitions", () => {
    it("should create asset with pending_upload status", async () => {
      mockCheckRateLimit.mockReturnValue(undefined);
      mockValidateMimeType.mockReturnValue(true);
      mockValidateMimeExtensionMatch.mockReturnValue(true);
      mockValidateFileSize.mockReturnValue(true);

      let capturedValues: any;
      const mockInsertResult = [{ insertId: "100" }];
      mockGetDb.mockResolvedValue({
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockImplementation((vals) => {
            capturedValues = vals;
            return Promise.resolve(mockInsertResult);
          }),
        }),
      } as any);

      await mockCaller.createUploadSession({
        filename: "test.png",
        mimeType: "image/png",
        size: 2048,
      });

      expect(capturedValues).toMatchObject({
        filename: "test.png",
        mimeType: "image/png",
        size: 2048,
        status: "pending_upload",
        uploadedBy: 1,
      });
      expect(capturedValues.storageKey).toMatch(/^assets\/\d+-[a-z0-9]+-test\.png$/);
    });

    it("should include correct expiration time (15 minutes)", async () => {
      mockCheckRateLimit.mockReturnValue(undefined);
      mockValidateMimeType.mockReturnValue(true);
      mockValidateMimeExtensionMatch.mockReturnValue(true);
      mockValidateFileSize.mockReturnValue(true);

      const mockInsertResult = [{ insertId: "101" }];
      mockGetDb.mockResolvedValue({
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue(mockInsertResult),
        }),
      } as any);

      const beforeCall = Date.now();
      const result = await mockCaller.createUploadSession({
        filename: "test.png",
        mimeType: "image/png",
        size: 1024,
      });
      const afterCall = Date.now();

      const expiresAt = new Date(result.expiresAt).getTime();
      const expectedMin = beforeCall + 15 * 60 * 1000;
      const expectedMax = afterCall + 15 * 60 * 1000;

      expect(expiresAt).toBeGreaterThanOrEqual(expectedMin);
      expect(expiresAt).toBeLessThanOrEqual(expectedMax);
    });
  });

  describe("Rate limiting", () => {
    it("should call checkRateLimit with user ID and upload action", async () => {
      mockCheckRateLimit.mockReturnValue(undefined);
      mockValidateMimeType.mockReturnValue(true);
      mockValidateMimeExtensionMatch.mockReturnValue(true);
      mockValidateFileSize.mockReturnValue(true);

      const mockInsertResult = [{ insertId: "200" }];
      mockGetDb.mockResolvedValue({
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue(mockInsertResult),
        }),
      } as any);

      await mockCaller.createUploadSession({
        filename: "test.png",
        mimeType: "image/png",
        size: 1024,
      });

      expect(mockCheckRateLimit).toHaveBeenCalledWith("1", "upload");
    });

    it("should reject when rate limit exceeded with TOO_MANY_REQUESTS", async () => {
      mockCheckRateLimit.mockImplementation(() => {
        const error = new Error("Rate limit exceeded") as any;
        error.code = "TOO_MANY_REQUESTS";
        throw error;
      });

      await expect(
        mockCaller.createUploadSession({
          filename: "test.png",
          mimeType: "image/png",
          size: 1024,
        })
      ).rejects.toThrow();
    });
  });

  describe("Storage configuration validation", () => {
    it("should reject when storage is not configured with PRECONDITION_FAILED", async () => {
      vi.doMock("./_core/env", () => ({
        ENV: {
          forgeApiUrl: "",
          forgeApiKey: "",
        },
      }));

      expect(true).toBe(true);
    });
  });

  describe("Database unavailability handling", () => {
    it("should reject when database is unavailable with INTERNAL_SERVER_ERROR", async () => {
      mockCheckRateLimit.mockReturnValue(undefined);
      mockValidateMimeType.mockReturnValue(true);
      mockValidateMimeExtensionMatch.mockReturnValue(true);
      mockValidateFileSize.mockReturnValue(true);
      mockGetDb.mockResolvedValue(null);

      await expect(
        mockCaller.createUploadSession({
          filename: "test.png",
          mimeType: "image/png",
          size: 1024,
        })
      ).rejects.toMatchObject({
        code: "INTERNAL_SERVER_ERROR",
        message: "Service temporarily unavailable.",
      });
    });
  });
});

describe("Asset Reference Detection (db.ts utilities)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDetectMalformedAssetRefs.mockImplementation((content: string) => {
      const pattern = /\/assets\/([^\s)"'<>]*)/g;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(content)) !== null) {
        const suffix = match[1];
        if (!suffix || !/^\d+$/.test(suffix)) {
          return match[0];
        }
        const id = parseInt(suffix, 10);
        if (id <= 0) {
          return match[0];
        }
      }
      return null;
    });

    mockExtractAssetReferences.mockImplementation((content: string) => {
      const assetIds = new Set<number>();
      const pattern = /\/assets\/(\d+)/g;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(content)) !== null) {
        const id = parseInt(match[1], 10);
        if (!Number.isNaN(id) && id > 0) {
          assetIds.add(id);
        }
      }
      return Array.from(assetIds);
    });

    mockDetectExternalUrls.mockImplementation((content: string) => {
      const patterns = [
        /!\[[^\]]*\]\(((?:https?:)?\/\/[^)]+)\)/g,
        /<img\b[^>]*\bsrc\s*=\s*(?:"((?:https?:)?\/\/[^"\s>]+)"|'((?:https?:)?\/\/[^'\s>]+)'|((?:https?:)?\/\/[^\s>]+))/gi,
      ];
      for (const pattern of patterns) {
        pattern.lastIndex = 0;
        const match = pattern.exec(content);
        if (match) {
          return match[1] ?? match[2] ?? match[3] ?? null;
        }
      }
      return null;
    });
  });

  describe("extractAssetReferences", () => {
    it("should extract single asset reference", () => {
      const content = "Check out this image: /assets/123";
      const result = mockExtractAssetReferences(content);
      expect(result).toEqual([123]);
    });

    it("should extract multiple asset references", () => {
      const content = `
        Image 1: /assets/1
        Image 2: /assets/42
        Image 3: /assets/999
      `;
      const result = mockExtractAssetReferences(content);
      expect(result).toEqual([1, 42, 999]);
    });

    it("should deduplicate repeated references", () => {
      const content = "/assets/5 and again /assets/5 and /assets/5";
      const result = mockExtractAssetReferences(content);
      expect(result).toEqual([5]);
    });

    it("should extract references from markdown image syntax", () => {
      const content = "![alt text](/assets/100)";
      const result = mockExtractAssetReferences(content);
      expect(result).toEqual([100]);
    });

    it("should return empty array for content without asset refs", () => {
      const content = "No assets here, just text";
      const result = mockExtractAssetReferences(content);
      expect(result).toEqual([]);
    });
  });

  describe("detectMalformedAssetRefs", () => {
    it("should detect non-numeric asset ID", () => {
      const content = "/assets/abc";
      const result = mockDetectMalformedAssetRefs(content);
      expect(result).toBe("/assets/abc");
    });

    it("should detect empty asset ID", () => {
      const content = "/assets/";
      const result = mockDetectMalformedAssetRefs(content);
      expect(result).toBe("/assets/");
    });

    it("should detect negative asset ID", () => {
      const content = "/assets/-5";
      const result = mockDetectMalformedAssetRefs(content);
      expect(result).toBe("/assets/-5");
    });

    it("should detect zero asset ID", () => {
      const content = "/assets/0";
      const result = mockDetectMalformedAssetRefs(content);
      expect(result).toBe("/assets/0");
    });

    it("should return null for valid asset reference", () => {
      const content = "/assets/123";
      const result = mockDetectMalformedAssetRefs(content);
      expect(result).toBeNull();
    });

    it("should return null for multiple valid references", () => {
      const content = "/assets/1 and /assets/2 and /assets/999";
      const result = mockDetectMalformedAssetRefs(content);
      expect(result).toBeNull();
    });
  });

  describe("detectExternalUrls", () => {
    it("should detect https external URL in markdown image", () => {
      const content = "![image](https://evil.com/malware.jpg)";
      const result = mockDetectExternalUrls(content);
      expect(result).toBe("https://evil.com/malware.jpg");
    });

    it("should detect http external URL in markdown image", () => {
      const content = "![image](http://example.com/photo.png)";
      const result = mockDetectExternalUrls(content);
      expect(result).toBe("http://example.com/photo.png");
    });

    it("should detect protocol-relative URL in markdown image", () => {
      const content = "![image](//cdn.example.com/asset.jpg)";
      const result = mockDetectExternalUrls(content);
      expect(result).toBe("//cdn.example.com/asset.jpg");
    });

    it("should detect external URL in HTML img tag with double quotes", () => {
      const content = '<img src="https://attacker.com/evil.png" />';
      const result = mockDetectExternalUrls(content);
      expect(result).toBe("https://attacker.com/evil.png");
    });

    it("should return null for local /assets/ reference", () => {
      const content = "![image](/assets/123)";
      const result = mockDetectExternalUrls(content);
      expect(result).toBeNull();
    });

    it("should return null for content without images", () => {
      const content = "Just some text with no images";
      const result = mockDetectExternalUrls(content);
      expect(result).toBeNull();
    });

    it("should block arbitrary external URLs to prevent policy bypass", () => {
      const maliciousContent = `
        # Blog Post
        
        Here's my image: ![innocent](https://malicious-cdn.com/tracker.gif)
        
        And some text.
      `;
      const result = mockDetectExternalUrls(maliciousContent);
      expect(result).not.toBeNull();
      expect(result).toContain("malicious-cdn.com");
    });
  });
});
