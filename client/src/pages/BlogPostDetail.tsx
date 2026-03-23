import { Link } from "wouter";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";
import Navigation from "@/components/Navigation";
import GrainOverlay from "@/components/GrainOverlay";
import CustomCursor from "@/components/CustomCursor";
import { getPostBySlug } from "@/content/loaders";

type BlogPostDetailProps = {
  slug: string;
};

function formatDate(dateString?: string | Date | null) {
  if (!dateString) return "未知日期";
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return "未知日期";
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${year}.${month}.${day}`;
}

export default function BlogPostDetail({ slug }: BlogPostDetailProps) {
  const post = getPostBySlug(slug);

  if (!post) {
    return (
      <div className="relative min-h-screen overflow-x-hidden bg-[#f2f0ed] text-[#3e3c3a]">
        <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 text-center">
          <p className="text-xs font-mono tracking-[0.24em] text-[#8e8a85] uppercase">Blog / 404</p>
          <h1 className="mt-4 text-3xl font-semibold text-[#2a2a2a]">未找到该文章</h1>
          <p className="mt-3 text-sm text-[#6a6560]">该链接可能已失效，或文章尚未发布。</p>
          <div className="mt-8 flex items-center gap-3">
            <Link href="/blog/surface">
              <a className="rounded-full border border-[#d1cdc7] bg-[#f9f8f6] px-4 py-2 text-xs font-mono tracking-[0.14em] uppercase text-[#3e3c3a] transition-colors hover:bg-[#ece8e2]">
                返回展示页
              </a>
            </Link>
            <Link href="/blog">
              <a className="rounded-full border border-[#d1cdc7] bg-[#f9f8f6] px-4 py-2 text-xs font-mono tracking-[0.14em] uppercase text-[#3e3c3a] transition-colors hover:bg-[#ece8e2]">
                返回封面页
              </a>
            </Link>
          </div>
        </main>

        <Navigation />
        <GrainOverlay />
        <CustomCursor />
      </div>
    );
  }

  const rendered = sanitizeHtml(marked.parse(post.body) as string);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#f2f0ed] text-[#3e3c3a]">
      <main className="mx-auto w-full max-w-[980px] px-6 pb-24 pt-28 md:px-10">
        <div className="mb-10 flex items-center gap-3">
          <Link href="/blog/surface">
            <a className="rounded-full border border-[#d1cdc7] bg-[#f9f8f6] px-4 py-2 text-xs font-mono tracking-[0.14em] uppercase text-[#3e3c3a] transition-colors hover:bg-[#ece8e2]">
              返回展示页
            </a>
          </Link>
          <Link href="/blog">
            <a className="rounded-full border border-[#d1cdc7] bg-[#f9f8f6] px-4 py-2 text-xs font-mono tracking-[0.14em] uppercase text-[#3e3c3a] transition-colors hover:bg-[#ece8e2]">
              返回封面页
            </a>
          </Link>
        </div>

        <header className="rounded-[28px] bg-[#f9f8f6] px-7 py-8 ring-1 ring-black/[0.03] shadow-[12px_12px_24px_#d1cdc7,-12px_-12px_24px_#ffffff] md:px-10 md:py-10">
          <p className="text-xs font-mono tracking-[0.2em] text-[#8e8a85] uppercase">
            {formatDate(post.date)} / {post.category || "Blog"}
          </p>
          <h1 className="mt-4 text-3xl font-semibold leading-tight text-[#2a2a2a] md:text-5xl">{post.title}</h1>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-[#6a6560]">
            {post.excerpt || "暂无预览内容"}
          </p>
        </header>

        <article
          className="prose prose-zinc mt-10 max-w-none rounded-[28px] bg-[#f9f8f6] px-7 py-8 ring-1 ring-black/[0.03] shadow-[12px_12px_24px_#d1cdc7,-12px_-12px_24px_#ffffff] prose-headings:text-[#2a2a2a] prose-headings:font-semibold prose-p:text-[#5f5a55] prose-p:leading-8 prose-li:text-[#5f5a55] prose-strong:text-[#2a2a2a] prose-a:text-[#2a2a2a] prose-a:underline prose-a:underline-offset-4 prose-a:decoration-[#bcb6ae] hover:prose-a:decoration-[#2a2a2a] md:px-10 md:py-10"
          dangerouslySetInnerHTML={{ __html: rendered }}
        />
      </main>

      <Navigation />
      <GrainOverlay />
      <CustomCursor />
    </div>
  );
}
