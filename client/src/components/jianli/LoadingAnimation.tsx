/**
 * LoadingAnimation - Lottie 动画加载器
 * 用于显示思考/加载状态的猫咪动画
 */

import { useEffect, useState } from "react";
import Lottie from "lottie-react";

interface LoadingAnimationProps {
  size?: number;
  className?: string;
}

/**
 * 加载 Lottie 动画组件
 *
 * 特性：
 * - 懒加载动画 JSON
 * - 错误降级到简单加载指示器
 * - 支持 prefers-reduced-motion
 */
export function LoadingAnimation({
  size = 48,
  className = "",
}: LoadingAnimationProps) {
  const [animationData, setAnimationData] = useState<any>(null);
  const [error, setError] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // 检测用户是否偏好减少动画
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  // 懒加载 Lottie 动画数据
  useEffect(() => {
    let mounted = true;

    const loadAnimation = async () => {
      try {
        // 动态导入 Lottie JSON
        const response = await fetch("/thecat/cat Mark loading.json");

        if (!response.ok) {
          throw new Error("Failed to load animation");
        }

        const data = await response.json();

        if (mounted) {
          setAnimationData(data);
        }
      } catch (err) {
        console.warn("Failed to load Lottie animation, using fallback:", err);
        if (mounted) {
          setError(true);
        }
      }
    };

    loadAnimation();

    return () => {
      mounted = false;
    };
  }, []);

  // 如果加载失败，显示简单的 CSS 动画
  if (error || !animationData) {
    return (
      <div
        className={`flex gap-1 ${className}`}
        style={{ width: size, height: size }}
        role="status"
        aria-label="加载中"
      >
        <span
          className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
          style={{ animationDelay: "0ms" }}
        />
        <span
          className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
          style={{ animationDelay: "150ms" }}
        />
        <span
          className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
          style={{ animationDelay: "300ms" }}
        />
      </div>
    );
  }

  // 如果用户偏好减少动画，只显示第一帧
  return (
    <Lottie
      animationData={animationData}
      loop={!prefersReducedMotion}
      autoplay={!prefersReducedMotion}
      style={{ width: size, height: size }}
      className={className}
      role="status"
      aria-label="加载中"
    />
  );
}
