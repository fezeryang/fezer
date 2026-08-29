import { useMemo } from "react";
import { Link } from "wouter";
import Navigation from "@/components/Navigation";
import GrainOverlay from "@/components/GrainOverlay";
import CustomCursor from "@/components/CustomCursor";
import DampedScrollView from "@/components/DampedScrollView";
import ProximitySidebar from "@/components/ui/proximity-sidebar";
import { getPostBySlug, renderBlogMarkdown } from "@/content/loaders";

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
        <DampedScrollView>
          <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 text-center">
            <p className="text-xs font-mono tracking-[0.24em] text-[#8e8a85] uppercase">
              Blog / 404
            </p>
            <h1 className="mt-4 text-3xl font-semibold text-[#2a2a2a]">
              未找到该文章
            </h1>
            <p className="mt-3 text-sm text-[#6a6560]">
              该链接可能已失效，或文章尚未发布。
            </p>
            <div className="mt-8 flex items-center gap-3">
              <Link
                href="/blog/surface"
                className="rounded-full border border-[#d1cdc7] bg-[#f9f8f6] px-4 py-2 text-xs font-mono uppercase tracking-[0.14em] text-[#3e3c3a] transition-colors hover:bg-[#ece8e2]"
              >
                返回展示页
              </Link>
              <Link
                href="/blog"
                className="rounded-full border border-[#d1cdc7] bg-[#f9f8f6] px-4 py-2 text-xs font-mono uppercase tracking-[0.14em] text-[#3e3c3a] transition-colors hover:bg-[#ece8e2]"
              >
                返回封面页
              </Link>
            </div>
          </main>
        </DampedScrollView>

        <Navigation />
        <GrainOverlay />
        <CustomCursor />
      </div>
    );
  }

  const { html: rendered, sections } = useMemo(() => {
    const result = renderBlogMarkdown(post.body);
    return {
      html: result.html,
      sections: result.sections.filter(
        section => section.level === 2 || section.level === 3
      ),
    };
  }, [post.body]);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#f7f5f0] text-[#3e3c3a]">
      <DampedScrollView>
        <main className="min-h-screen w-full pb-0 pt-28 sm:pt-32">
          <section className="bg-[#f7f5f0] px-6 md:px-8">
            <div className="mx-auto max-w-4xl">
              <div className="mb-16 flex items-center justify-center gap-6 border-b border-[#e1dfda] pb-8">
                <Link
                  href="/blog/surface"
                  className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#8e8a85] transition-colors hover:text-[#1c1b1a]"
                >
                  ← 返回展示页
                </Link>
                <span className="text-[#d1cdc7]">|</span>
                <Link
                  href="/blog"
                  className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#8e8a85] transition-colors hover:text-[#1c1b1a]"
                >
                  返回封面页 →
                </Link>
              </div>

              <header className="mb-16 text-center">
                <p className="mb-8 text-[11px] font-mono uppercase tracking-[0.25em] text-[#a19d96]">
                  {formatDate(post.date)}{" "}
                  <span className="mx-3 font-serif text-base italic opacity-50">
                    ~
                  </span>{" "}
                  {post.category || "Journal"}
                </p>
                <h1 className="font-songti text-4xl font-normal leading-[1.35] tracking-wide text-[#1c1b1a] md:text-5xl lg:text-[46px]">
                  {post.title}
                </h1>
                {post.excerpt && (
                  <p className="mx-auto mt-8 max-w-2xl font-songti text-lg italic leading-[2] text-[#75706b]">
                    {post.excerpt}
                  </p>
                )}
              </header>

              <div className="mx-auto h-px w-12 bg-[#1c1b1a]/30" />
            </div>
          </section>

          <section className="bg-[#e8e2d6] px-6 py-14 sm:py-16 md:px-8 lg:py-20">
            <article
              className="prose prose-zinc mx-auto max-w-3xl text-justify font-songti text-[#2d2a26] prose-headings:mt-14 prose-headings:mb-6 prose-headings:font-songti prose-headings:font-normal prose-headings:text-[#1c1b1a] prose-h2:border-b prose-h2:border-[#e1dfda] prose-h2:pb-4 prose-h2:text-[30px] prose-h2:tracking-wide prose-h3:text-2xl prose-h3:tracking-wide prose-p:mb-8 prose-p:text-[18px] prose-p:leading-[2.2] prose-p:tracking-[0.04em] prose-li:text-[18px] prose-li:leading-[2.2] prose-li:tracking-[0.04em] prose-strong:font-bold prose-strong:text-[#1c1b1a] prose-a:text-[#1c1b1a] prose-a:underline prose-a:decoration-[#d1cdc7] prose-a:underline-offset-8 prose-a:transition-all hover:prose-a:bg-[#1c1b1a]/5 hover:prose-a:decoration-[#1c1b1a] prose-blockquote:border-l-[3px] prose-blockquote:border-[#1c1b1a] prose-blockquote:bg-gradient-to-r prose-blockquote:from-[#eceae4]/60 prose-blockquote:to-transparent prose-blockquote:py-3 prose-blockquote:pl-6 prose-blockquote:pr-4 prose-blockquote:italic prose-blockquote:text-[#4a4743] prose-img:my-10 prose-img:rounded-md prose-img:shadow-sm"
              dangerouslySetInnerHTML={{ __html: rendered }}
            />
          </section>
        </main>
      </DampedScrollView>

      <ProximitySidebar sections={sections} side="right" />
      <Navigation />
      <GrainOverlay />
      <CustomCursor />
    </div>
  );
}
