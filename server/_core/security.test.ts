import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

vi.mock("./env", () => ({
  ENV: {
    allowedOrigins: ["https://fezer.github.io", "https://custom.domain.com"],
    isProduction: true,
  },
}));

import { createCorsMiddleware } from "./security";

type MockResponse = {
  headers: Record<string, string>;
  statusCode: number;
  setHeader: (name: string, value: string) => MockResponse;
  status: (code: number) => MockResponse;
  end: () => void;
  json: (data: unknown) => void;
};

function createMockRequest(overrides: Partial<Request> = {}): Request {
  return {
    method: "GET",
    path: "/api/test",
    headers: {},
    ...overrides,
  } as Request;
}

function createMockResponse(): MockResponse {
  const res: MockResponse = {
    headers: {},
    statusCode: 200,
    setHeader(name: string, value: string) {
      this.headers[name] = value;
      return this;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    end() {},
    json() {},
  };
  return res;
}

describe("CORS Middleware Security Boundary", () => {
  let corsMiddleware: ReturnType<typeof createCorsMiddleware>;
  let nextFn: NextFunction;

  beforeEach(() => {
    corsMiddleware = createCorsMiddleware();
    nextFn = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Allowed Origins", () => {
    it("allows GitHub Pages origin from ALLOWED_ORIGINS", () => {
      const req = createMockRequest({
        headers: { origin: "https://fezer.github.io" },
      });
      const res = createMockResponse();

      corsMiddleware(req, res as unknown as Response, nextFn);

      expect(res.headers["Access-Control-Allow-Origin"]).toBe("https://fezer.github.io");
      expect(res.headers["Access-Control-Allow-Credentials"]).toBe("true");
      expect(res.headers["Access-Control-Allow-Methods"]).toBe("GET, POST, PUT, DELETE, OPTIONS");
      expect(res.headers["Access-Control-Allow-Headers"]).toBe("Content-Type, Authorization, X-Requested-With");
      expect(nextFn).toHaveBeenCalled();
    });

    it("allows custom domain from ALLOWED_ORIGINS", () => {
      const req = createMockRequest({
        headers: { origin: "https://custom.domain.com" },
      });
      const res = createMockResponse();

      corsMiddleware(req, res as unknown as Response, nextFn);

      expect(res.headers["Access-Control-Allow-Origin"]).toBe("https://custom.domain.com");
      expect(res.headers["Access-Control-Allow-Credentials"]).toBe("true");
      expect(nextFn).toHaveBeenCalled();
    });

    it("handles preflight OPTIONS request for allowed origin", () => {
      const req = createMockRequest({
        method: "OPTIONS",
        headers: { origin: "https://fezer.github.io" },
      });
      const res = createMockResponse();
      const endSpy = vi.spyOn(res, "end");

      corsMiddleware(req, res as unknown as Response, nextFn);

      expect(res.statusCode).toBe(204);
      expect(res.headers["Access-Control-Allow-Origin"]).toBe("https://fezer.github.io");
      expect(res.headers["Access-Control-Max-Age"]).toBe("86400");
      expect(endSpy).toHaveBeenCalled();
      expect(nextFn).not.toHaveBeenCalled();
    });
  });

  describe("Blocked Origins", () => {
    it("blocks unknown origin (no CORS headers)", () => {
      const req = createMockRequest({
        headers: { origin: "https://malicious-site.com" },
      });
      const res = createMockResponse();

      corsMiddleware(req, res as unknown as Response, nextFn);

      expect(res.headers["Access-Control-Allow-Origin"]).toBeUndefined();
      expect(res.headers["Access-Control-Allow-Credentials"]).toBeUndefined();
      expect(nextFn).toHaveBeenCalled();
    });

    it("returns 403 for preflight from blocked origin", () => {
      const req = createMockRequest({
        method: "OPTIONS",
        headers: { origin: "https://malicious-site.com" },
      });
      const res = createMockResponse();
      const jsonSpy = vi.spyOn(res, "json");

      corsMiddleware(req, res as unknown as Response, nextFn);

      expect(res.statusCode).toBe(403);
      expect(jsonSpy).toHaveBeenCalledWith({ error: "CORS: Origin not allowed" });
      expect(nextFn).not.toHaveBeenCalled();
    });

    it("blocks localhost in production mode", () => {
      const req = createMockRequest({
        headers: { origin: "http://localhost:3000" },
      });
      const res = createMockResponse();

      corsMiddleware(req, res as unknown as Response, nextFn);

      expect(res.headers["Access-Control-Allow-Origin"]).toBeUndefined();
      expect(nextFn).toHaveBeenCalled();
    });
  });

  describe("Same-Origin Requests", () => {
    it("allows requests without origin header (same-origin/non-browser)", () => {
      const req = createMockRequest({
        headers: {},
      });
      const res = createMockResponse();

      corsMiddleware(req, res as unknown as Response, nextFn);

      expect(res.headers["Access-Control-Allow-Origin"]).toBeUndefined();
      expect(nextFn).toHaveBeenCalled();
    });
  });

  describe("Security Guarantees", () => {
    it("never uses wildcard '*' for Access-Control-Allow-Origin", () => {
      const origins = [
        "https://fezer.github.io",
        "https://custom.domain.com",
        "https://unknown.com",
        undefined,
      ];

      for (const origin of origins) {
        const req = createMockRequest({
          headers: origin ? { origin } : {},
        });
        const res = createMockResponse();

        corsMiddleware(req, res as unknown as Response, nextFn);

        expect(res.headers["Access-Control-Allow-Origin"]).not.toBe("*");
      }
    });

    it("sets credentials header only for allowed origins", () => {
      const req = createMockRequest({
        headers: { origin: "https://malicious-site.com" },
      });
      const res = createMockResponse();

      corsMiddleware(req, res as unknown as Response, nextFn);

      expect(res.headers["Access-Control-Allow-Credentials"]).toBeUndefined();
    });
  });
});

describe("Development Mode CORS", () => {
  it("allows localhost in development mode", async () => {
    vi.resetModules();
    
    vi.doMock("./env", () => ({
      ENV: {
        allowedOrigins: [],
        isProduction: false,
      },
    }));

    const { createCorsMiddleware: devCorsMiddleware } = await import("./security");
    const middleware = devCorsMiddleware();
    const req = createMockRequest({
      headers: { origin: "http://localhost:3000" },
    });
    const res = createMockResponse();
    const nextFn = vi.fn();

    middleware(req, res as unknown as Response, nextFn);

    expect(res.headers["Access-Control-Allow-Origin"]).toBe("http://localhost:3000");
    expect(res.headers["Access-Control-Allow-Credentials"]).toBe("true");
    expect(nextFn).toHaveBeenCalled();
  });
});
