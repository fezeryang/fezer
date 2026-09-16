---
title: "Elastic Quick Capture"
description: "弹性快速捕捉控件：静止时是一颗安静的胶囊，悬停后弹开三颗动作星球（任务 / 笔记 / 链接），录入成功后收拢为一条确认动效，配合 localStorage 收件箱。"
date: "2026-09-16"
tags: ["UI 设计", "交互设计", "微交互", "动效", "表单"]
technologies: "HTML, CSS, JavaScript, 零依赖单文件"
link: "ui-designs/elastic-quick-capture.html"
rooms:
  - "visual"
---

# Elastic Quick Capture

一个把「快速记一笔」做到极致的捕捉控件原型，探索静息态与展开态之间的弹性过渡。

## 特性

- **三向捕捉**：任务、笔记、链接三种意图，各有一颗动作星球承载
- **弹性形变**：胶囊展开 / 收拢走弹簧物理，宽度与星球位移逐帧合成
- **成功反馈**：提交后收拢为成功态文案，再自动回到静息态
- **本地收件箱**：条目存入 localStorage，支持完成勾选、删除与年龄显示
- **可访问性**：完整键盘操作、`aria-invalid` 错误态、prefers-reduced-motion 降级
- **明暗双主题**：跟随系统配色
