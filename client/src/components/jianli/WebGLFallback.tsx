/**
 * WebGL 不可用时的文字版档案馆（B8）
 *
 * 低端设备、禁用硬件加速或企业策略会拿不到 WebGL —— 直接渲染 Canvas 就是白屏。
 * 这里把 7 个房间及其真实内容（rooms frontmatter 标注，C12）列成可点击的文字版，
 * 内容与 3D 版一致，只是没有空间感。
 */

import { useMemo } from "react";
import { Link } from "wouter";
import { loadPosts, loadWorks } from "@/content/loaders";
import { ROOM_IDS, ROOMS } from "./assets/roomsConfig";

export function WebGLFallback() {
  const rooms = useMemo(
    () =>
      ROOM_IDS.map(roomId => ({
        room: ROOMS[roomId],
        works: loadWorks().filter(work => work.rooms?.includes(roomId)),
        posts: loadPosts().filter(post => post.rooms?.includes(roomId)),
      })),
    []
  );

  return (
    <div className="h-full w-full overflow-y-auto bg-slate-200 px-6 py-10">
      <div className="mx-auto max-w-2xl rounded-3xl border border-slate-900/10 bg-white/95 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.12)]">
        <h1 className="text-xl font-bold text-slate-900">
          3D 档案馆 · 文字版
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          当前浏览器或设备不支持 WebGL，已自动切换为文字版。内容与 3D
          版一致，只是没有空间导览。
        </p>

        <div className="mt-6 space-y-6">
          {rooms.map(({ room, works, posts }) => (
            <section key={room.id}>
              <h2 className="flex items-center gap-2 text-base font-semibold text-slate-800">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: room.accent }}
                />
                {room.name}
              </h2>
              <p className="mt-1 text-sm text-slate-600">{room.summary}</p>

              {works.length === 0 && posts.length === 0 ? (
                <p className="mt-2 text-xs text-slate-400">内容整理中</p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {works.map(work => {
                    const external = Boolean(
                      work.link && !work.link.startsWith("/")
                    );
                    const href = work.link ?? "/portfolio";
                    return (
                      <li key={`work-${work.slug}`}>
                        {external ? (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-slate-700 underline decoration-slate-300 hover:decoration-slate-600"
                          >
                            作品 · {work.title}
                          </a>
                        ) : (
                          <Link
                            href={href}
                            className="text-sm text-slate-700 underline decoration-slate-300 hover:decoration-slate-600"
                          >
                            作品 · {work.title}
                          </Link>
                        )}
                      </li>
                    );
                  })}
                  {posts.map(post => (
                    <li key={`post-${post.slug}`}>
                      <Link
                        href={`/blog/${post.slug}`}
                        className="text-sm text-slate-700 underline decoration-slate-300 hover:decoration-slate-600"
                      >
                        博客 · {post.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
