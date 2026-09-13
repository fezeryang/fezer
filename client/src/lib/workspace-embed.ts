/** Optional bridge for the trusted TODŌU host. Standalone visits are unchanged. */
const CHANNEL = "todou-browser-v1";
const LIMIT = 50 * 1024 * 1024;
const PRODUCTION_HOSTS = new Set(["https://todou-six.vercel.app"]);

/** Pause only loops that were running; do not restart intentionally static sketches. */
export function bindWorkspaceAnimation(animation: { isLooping(): boolean; noLoop(): void; loop(): void }): () => void {
  let paused = false;
  const sync = (): void => {
    const hidden = document.documentElement.dataset.workspaceVisible === "false";
    if (hidden && !paused && animation.isLooping()) { paused = true; animation.noLoop(); }
    else if (!hidden && paused) { paused = false; animation.loop(); }
  };
  window.addEventListener("todou:visibility", sync);
  sync();
  return () => window.removeEventListener("todou:visibility", sync);
}

export function isWorkspaceParent(origin: string, development: boolean): boolean {
  if (PRODUCTION_HOSTS.has(origin)) return true;
  if (!development) return false;
  try {
    const url = new URL(origin);
    return url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname) && !!url.port;
  } catch { return false; }
}

export function installWorkspaceEmbed(): () => void {
  if (window.parent === window) return () => undefined;
  let parentOrigin = "";
  let session = "";
  let connected = false;
  let scrollTimer: ReturnType<typeof setTimeout> | undefined;
  const downloads = new Map<string, AbortController>();
  const send = (message: object, transfer: Transferable[] = []): void => {
    if (parentOrigin) window.parent.postMessage({ channel: CHANNEL, session, ...message }, parentOrigin, transfer);
  };
  const report = (): void => send({ type: "page", url: location.href, title: document.title, scrollY: window.scrollY });
  const setVisible = (visible: boolean): void => {
    document.documentElement.dataset.workspaceVisible = String(visible);
    window.dispatchEvent(new CustomEvent("todou:visibility", { detail: { visible } }));
  };
  const receive = (event: MessageEvent<unknown>): void => {
    if (event.source !== window.parent || !isWorkspaceParent(event.origin, import.meta.env.DEV)) return;
    const data = event.data;
    if (!data || typeof data !== "object" || !("channel" in data) || data.channel !== CHANNEL || !("type" in data)) return;
    if (data.type === "hello") {
      if (!("session" in data) || typeof data.session !== "string" || data.session.length > 100) return;
      session = data.session;
      parentOrigin = event.origin;
      document.documentElement.dataset.workspaceEmbedded = "true";
      setVisible(!("visible" in data) || data.visible === true);
      if (!connected && "scrollY" in data && typeof data.scrollY === "number" && Number.isFinite(data.scrollY)) {
        const y = Math.max(0, data.scrollY);
        requestAnimationFrame(() => window.scrollTo({ top: y, behavior: "instant" }));
      }
      connected = true;
      send({ type: "ready", url: location.href, title: document.title });
      return;
    }
    if (!connected || event.origin !== parentOrigin || !("session" in data) || data.session !== session) return;
    if (data.type === "visibility" && "visible" in data && typeof data.visible === "boolean") { setVisible(data.visible); return; }
    if (!("id" in data) || typeof data.id !== "string" || data.id.length > 100) return;
    const id = data.id;
    if (data.type === "cancel-download") { downloads.get(id)?.abort(); return; }
    if (data.type !== "fetch-download" || !("url" in data) || typeof data.url !== "string") return;
    let url: URL;
    try { url = new URL(data.url); } catch { return; }
    // Only public, same-origin resources. No admin/API data or credentials cross the bridge.
    if (url.origin !== location.origin || url.username || url.password || /^\/(api|admin|auth)(\/|$)/.test(url.pathname)) return;
    if (downloads.has(id) || downloads.size >= 3) { send({ type: "download-error", id, message: "同时最多下载 3 个文件。" }); return; }
    const controller = new AbortController();
    downloads.set(id, controller);
    const name = "name" in data && typeof data.name === "string" ? data.name.slice(0, 180) : decodeURIComponent(url.pathname.split("/").pop() || "下载文件");
    void (async () => {
      const response = await fetch(url, { signal: controller.signal, credentials: "omit" });
      if (!response.ok) throw new Error(`下载失败（HTTP ${response.status}）`);
      const length = Number(response.headers.get("content-length"));
      const total = Number.isFinite(length) && length > 0 ? length : null;
      if (total !== null && total > LIMIT) { await response.body?.cancel(); throw new Error("单个文件不能超过 50 MB"); }
      const reader = response.body?.getReader();
      if (!reader) throw new Error("文件内容不可读取");
      const chunks: Uint8Array<ArrayBuffer>[] = [];
      let received = 0;
      let lastReport = 0;
      try {
        while (true) {
          controller.signal.throwIfAborted();
          const chunk = await reader.read();
          if (chunk.done) break;
          received += chunk.value.byteLength;
          if (received > LIMIT) throw new Error("单个文件不能超过 50 MB");
          chunks.push(new Uint8Array(chunk.value));
          if (performance.now() - lastReport > 100) {
            lastReport = performance.now();
            send({ type: "download-progress", id, received, total: total !== null && received <= total ? total : null });
          }
        }
      } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
      controller.signal.throwIfAborted();
      const bytes = await new Blob(chunks).arrayBuffer();
      send({ type: "download-result", id, bytes, name, mime: response.headers.get("content-type") ?? "application/octet-stream" }, [bytes]);
    })().catch((error: unknown) => {
      send({ type: "download-error", id, message: controller.signal.aborted ? "下载已取消" : error instanceof Error ? error.message : "下载失败" });
    }).finally(() => downloads.delete(id));
  };
  const open = (raw: string, newTab: boolean): void => {
    let url: URL;
    try { url = new URL(raw, location.href); } catch { return; }
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return;
    if (PRODUCTION_HOSTS.has(url.origin) || url.origin === parentOrigin) send({ type: "workspace" });
    else send({ type: "open", url: url.href, newTab });
  };
  const intercept = (event: MouseEvent): void => {
    if (!connected || !(event.target instanceof Element)) return;
    const link = event.target.closest<HTMLAnchorElement>("a[href]");
    if (!link) return;
    const url = new URL(link.href, location.href);
    if (!/^https?:$/.test(url.protocol)) { event.preventDefault(); return; }
    if (link.hasAttribute("download")) {
      event.preventDefault(); event.stopImmediatePropagation();
      if (url.origin === location.origin) send({ type: "download", url: url.href, name: link.download || decodeURIComponent(url.pathname.split("/").pop() || "下载文件") });
      else open(url.href, true);
      return;
    }
    const newTab = event.type === "auxclick" || event.ctrlKey || event.metaKey || event.shiftKey || link.target === "_blank";
    if (url.origin === location.origin && !newTab && (!link.target || link.target === "_self")) return;
    event.preventDefault(); event.stopImmediatePropagation();
    open(url.href, newTab);
  };
  const originalOpen = window.open;
  const virtualOpen: typeof window.open = (url, target, features) => {
    if (!connected) return originalOpen.call(window, url, target, features);
    if (url) open(String(url), true);
    return null;
  };
  window.open = virtualOpen;
  const originalPush = history.pushState;
  const originalReplace = history.replaceState;
  const push: typeof history.pushState = function (...args) { originalPush.apply(history, args); report(); };
  const replace: typeof history.replaceState = function (...args) { originalReplace.apply(history, args); report(); };
  history.pushState = push;
  history.replaceState = replace;
  const onScroll = (): void => { if (scrollTimer === undefined) scrollTimer = setTimeout(() => { scrollTimer = undefined; report(); }, 250); };
  const title = new MutationObserver(report);
  title.observe(document.querySelector("title") ?? document.head, { childList: true, subtree: true, characterData: true });
  const style = document.createElement("style");
  style.textContent = 'html[data-workspace-visible="false"] * { animation-play-state: paused !important; }';
  document.head.append(style);
  window.addEventListener("message", receive);
  window.addEventListener("popstate", report);
  window.addEventListener("hashchange", report);
  window.addEventListener("scroll", onScroll, { passive: true });
  document.addEventListener("click", intercept, true);
  document.addEventListener("auxclick", intercept, true);
  return () => {
    clearTimeout(scrollTimer);
    downloads.forEach(controller => controller.abort());
    downloads.clear();
    title.disconnect(); style.remove();
    window.removeEventListener("message", receive);
    window.removeEventListener("popstate", report);
    window.removeEventListener("hashchange", report);
    window.removeEventListener("scroll", onScroll);
    document.removeEventListener("click", intercept, true);
    document.removeEventListener("auxclick", intercept, true);
    if (window.open === virtualOpen) window.open = originalOpen;
    if (history.pushState === push) history.pushState = originalPush;
    if (history.replaceState === replace) history.replaceState = originalReplace;
    delete document.documentElement.dataset.workspaceEmbedded;
    delete document.documentElement.dataset.workspaceVisible;
  };
}
