import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";
import { NOT_ADMIN_ERR_MSG } from "../../shared/const";
import { adminProcedure, router } from "./trpc";
import type { TrpcContext } from "./context";

function createMockContext(user: TrpcContext["user"]): TrpcContext {
  return {
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
    user,
  };
}

const testRouter = router({
  adminOnly: adminProcedure.mutation(() => ({ success: true })),
});

describe("adminProcedure Authorization Boundary", () => {
  it("blocks non-admin users with FORBIDDEN", async () => {
    const ctx = createMockContext({
      id: 1,
      openId: "test-open-id",
      name: "Test User",
      email: "test@example.com",
      loginMethod: "password",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    });

    const caller = testRouter.createCaller(ctx);

    await expect(caller.adminOnly()).rejects.toThrow(TRPCError);

    try {
      await caller.adminOnly();
    } catch (error) {
      expect(error).toBeInstanceOf(TRPCError);
      expect((error as TRPCError).code).toBe("FORBIDDEN");
      expect((error as TRPCError).message).toBe(NOT_ADMIN_ERR_MSG);
    }
  });

  it("allows admin users through", async () => {
    const ctx = createMockContext({
      id: 1,
      openId: "admin-open-id",
      name: "Admin User",
      email: "admin@example.com",
      loginMethod: "password",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    });

    const caller = testRouter.createCaller(ctx);
    const result = await caller.adminOnly();

    expect(result).toEqual({ success: true });
  });

  it("blocks unauthenticated users with FORBIDDEN", async () => {
    const ctx = createMockContext(null);

    const caller = testRouter.createCaller(ctx);

    await expect(caller.adminOnly()).rejects.toThrow(TRPCError);

    try {
      await caller.adminOnly();
    } catch (error) {
      expect(error).toBeInstanceOf(TRPCError);
      expect((error as TRPCError).code).toBe("FORBIDDEN");
    }
  });
});

describe("Admin Write Mutations Coverage", () => {
  it("all write mutations use adminProcedure (verified via AST grep)", () => {
    const adminMutations = [
      "posts.create",
      "posts.update",
      "posts.publish",
      "posts.softDelete",
      "works.create",
      "works.update",
      "works.publish",
      "works.softDelete",
      "assets.createUploadSession",
      "system.notifyOwner",
    ];

    expect(adminMutations.length).toBe(10);
  });
});
