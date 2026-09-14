import { describe, expect, it } from "vitest";
import { arrayBufferToBase64, blobToBase64 } from "./audio-recording";

describe("arrayBufferToBase64", () => {
  it("小负载与 Buffer 编码一致", () => {
    const bytes = new TextEncoder().encode("hello");

    expect(arrayBufferToBase64(bytes.buffer)).toBe(
      Buffer.from("hello").toString("base64")
    );
  });

  it("跨多个分块边界仍正确（不会撑爆调用栈）", () => {
    // 8192 是分块大小；这个长度跨了 3 个边界
    const size = 8192 * 3 + 123;
    const bytes = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
      bytes[i] = i % 256;
    }

    expect(arrayBufferToBase64(bytes.buffer)).toBe(
      Buffer.from(bytes).toString("base64")
    );
  });

  it("空缓冲返回空串", () => {
    expect(arrayBufferToBase64(new ArrayBuffer(0))).toBe("");
  });
});

describe("blobToBase64", () => {
  it("与直接编码同样的字节一致", async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3, 4, 5])]);

    expect(await blobToBase64(blob)).toBe(
      Buffer.from([1, 2, 3, 4, 5]).toString("base64")
    );
  });
});
