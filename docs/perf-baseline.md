# /jianli 加载体积基线

> 由 `node scripts/measure-jianli-perf.mjs --write` 生成，测量日期 2026-09-14。
> headless chromium（SwiftShader）—— 只用于体积基线，帧率请在真机手测。

| 指标 | 数值 |
| --- | --- |
| glb 请求数 | 32 |
| 唯一 glb 文件数 | 32 |
| glb 总字节 | 7467192（7.12 MiB） |
| glb 失败请求（≥400） | 0 |
| script/模块请求数 | 139 |
| First Contentful Paint | 3140 ms |

目标（计划 §6）：首屏模型字节 < 1.5MB。当前一次性挂载全部房间/走廊/结构与 18 个角色，
因此基线等于全部模型体积。
