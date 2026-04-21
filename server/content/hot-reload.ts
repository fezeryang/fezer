/**
 * Content Hot Reload - 内容热重载
 *
 * 监听内容文件变化，自动重新加载索引
 */

import { watch, FSWatcher } from "fs";
import { join } from "path";
import { reloadContentIndex } from "./index";
import { getContentRootPath } from "./loader";

/**
 * 热重载配置
 */
interface HotReloadConfig {
  enabled: boolean;
  debounceMs: number;
  onReload?: (timestamp: Date) => void;
}

const DEFAULT_CONFIG: HotReloadConfig = {
  enabled: true,
  debounceMs: 1000, // 防抖 1 秒
};

/**
 * 热重载管理器
 */
class ContentHotReloadManager {
  private watchers: FSWatcher[] = [];
  private reloadTimer: NodeJS.Timeout | null = null;
  private config: HotReloadConfig;
  private isInitialized = false;

  constructor(config: Partial<HotReloadConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 启动文件监听
   */
  start(): void {
    if (this.isInitialized) {
      return;
    }

    if (!this.config.enabled) {
      console.log("[HotReload] Content hot reload is disabled");
      return;
    }

    try {
      const contentRoot = getContentRootPath();
      const watchPaths = [
        join(contentRoot, "blog"),
        join(contentRoot, "works"),
        join(contentRoot, "profile"),
      ];

      // 为每个路径创建独立的 watcher
      for (const watchPath of watchPaths) {
        const watcher = watch(
          watchPath,
          { recursive: true },
          (eventType: string, filename: string | null) =>
            this.handleChange(eventType, filename)
        );
        this.watchers.push(watcher);
      }

      this.isInitialized = true;
      console.log("[HotReload] Content hot reload started");
      console.log(`[HotReload] Watching: ${watchPaths.join(", ")}`);
    } catch (error) {
      console.error("[HotReload] Failed to start file watcher:", error);
    }
  }

  /**
   * 处理文件变化
   */
  private handleChange(eventType: string, filename: string | null): void {
    if (!filename) {
      return;
    }

    // 只处理 Markdown 文件
    if (!filename.endsWith(".md")) {
      return;
    }

    console.log(`[HotReload] File changed: ${filename} (${eventType})`);

    // 防抖：清除之前的定时器
    if (this.reloadTimer) {
      clearTimeout(this.reloadTimer);
    }

    // 设置新的定时器
    this.reloadTimer = setTimeout(() => {
      this.performReload();
    }, this.config.debounceMs);
  }

  /**
   * 执行重新加载
   */
  private performReload(): void {
    try {
      const timestamp = new Date();
      const newIndex = reloadContentIndex();

      console.log(
        `[HotReload] Content index reloaded at ${timestamp.toISOString()}`
      );
      console.log(
        `[HotReload] Index stats: blog=${newIndex.count.blog}, works=${newIndex.count.works}, profile=${newIndex.count.profile}`
      );

      this.config.onReload?.(timestamp);
    } catch (error) {
      console.error("[HotReload] Failed to reload content index:", error);
    }
  }

  /**
   * 停止文件监听
   */
  stop(): void {
    if (this.reloadTimer) {
      clearTimeout(this.reloadTimer);
      this.reloadTimer = null;
    }

    for (const watcher of this.watchers) {
      watcher.close();
    }
    this.watchers = [];

    this.isInitialized = false;
    console.log("[HotReload] Content hot reload stopped");
  }

  /**
   * 手动触发重新加载
   */
  triggerReload(): void {
    this.performReload();
  }
}

// 单例实例
let hotReloadManager: ContentHotReloadManager | null = null;

/**
 * 初始化内容热重载
 */
export function initContentHotReload(
  config?: Partial<HotReloadConfig>
): ContentHotReloadManager {
  if (!hotReloadManager) {
    hotReloadManager = new ContentHotReloadManager(config);
    hotReloadManager.start();
  }
  return hotReloadManager;
}

/**
 * 获取热重载管理器实例
 */
export function getHotReloadManager(): ContentHotReloadManager | null {
  return hotReloadManager;
}

/**
 * 手动触发内容重新加载
 */
export function triggerContentReload(): void {
  hotReloadManager?.triggerReload();
}

/**
 * 停止内容热重载
 */
export function stopContentHotReload(): void {
  hotReloadManager?.stop();
  hotReloadManager = null;
}
