---
title: "Form / Field 生成艺术工作室"
description: "基于 Canvas 的生成手势工作室：一笔手势进入种子化生成语法，化作节拍化图元再烘焙成作品。内置八种生成乐器，支持调参、种子版本管理与高清 PNG 导出。"
date: "2026-09-04"
tags: ["生成艺术", "Canvas", "交互设计", "创意编程"]
technologies: "Canvas 2D, JavaScript, L-system / 空间殖民 / 流场 / fBm 噪声, 零依赖单文件"
link: "generative-art/form-field-botanical-studio.html"
---

# Form / Field 生成艺术工作室

一个把「手势」当作创作入口的生成艺术画室：拖拽落笔，笔迹进入确定性种子语法，展开为带节拍的图元动画，最终烘焙进画布；松手即成一幅可导出的作品。零依赖、单文件、纯浏览器运行。

## 八种生成乐器

- **Score 记谱**：五线谱带穿过 16 种记谱动机语法
- **Schematic 电路图**：8 类节点家族加 CAD / 模块拼贴装饰，湿墨笔触
- **Balloon 气球海报**：刮开显影的多联骨牌海报，带干湿印刷物理
- **Cosmic Garden 宇宙花园**：轨道绽放的光晕星系
- **Flow Field 流场**：curl / 涡旋 / 扭曲场的种子流线
- **Botanical 植物生长**：L-system 分枝、空间殖民冠层、黄金角叶序、叶脉、蕨类、藤蔓卷须、菌丝网络
- **Print 半调印刷**：玫瑰纹、摩尔纹、网点云与套印错位
- **Topo 等高线**：带测绘刻度的嵌套地形轮廓

## 引擎特点

- 确定性随机：种子文本经 FNV 哈希 + mulberry32 派生所有流，同一种子复现同一作品
- 版本管理：每个种子生成「算法 DNA」特征标签，支持随机新版本
- 湿墨渲染、回弹缓动、节拍化出场动画，prefers-reduced-motion 降级
- 深色工作室界面，F 键专注模式隐藏全部 chrome，只留作品
- 1× / 2× / 4× PNG 导出
