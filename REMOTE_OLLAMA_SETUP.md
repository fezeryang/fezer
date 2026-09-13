# 学校 AI 平台 Ollama 接入配置指南

> **目标读者**：AI 编程助手 / 开发者
> **用途**：在本地开发环境接入部署在学校 AI 平台远端实例上的 Ollama，实现"本地开发、远端推理"。
> **平台**：中央财经大学 AI 实验平台（ailab.cufe.edu.cn）

---

## 1. 架构概览

模型运行在学校平台的远端实例中（双卡 RTX 4090），本地不部署模型，仅通过 SSH 隧道调用：

```
本地程序 (VSCode / Python / curl)
    │  请求 http://127.0.0.1:11434
    ▼
SSH 本地端口转发（隧道）
    │  加密通道 ailab.cufe.edu.cn:24741
    ▼
远端实例 ollama serve (127.0.0.1:11434)
    │  GPU 推理
    ▼
返回结果
```

要点：本地程序访问的永远是 `localhost`，与使用本地 Ollama 的体验完全一致，实际推理在远端。

## 2. 连接信息

| 项目 | 值 |
|---|---|
| SSH 入口 | `ailab.cufe.edu.cn:24741`（内网 IP `10.3.50.20`） |
| SSH 用户 | `u2025211069` |
| 认证方式 | 密钥 `~/.ssh/school_ai`（公钥已部署到远端 `authorized_keys`，免密登录） |
| SSH 别名 | `school-ai`（已写入 `~/.ssh/config`） |
| 远端 API | `127.0.0.1:11434`（仅实例内部可达，需隧道） |

**网络前提**：`ailab.cufe.edu.cn` 解析到内网地址，必须在**校园网或 VPN 环境**下才能连接。连通性测试：

```bash
timeout 5 bash -c 'cat < /dev/null > /dev/tcp/ailab.cufe.edu.cn/24741' && echo OK || echo "需检查校园网/VPN"
```

## 3. SSH 配置（若环境缺失则补齐）

`~/.ssh/config` 应包含：

```text
Host school-ai
    HostName ailab.cufe.edu.cn
    Port 24741
    User u2025211069
    IdentityFile ~/.ssh/school_ai
    IdentitiesOnly yes
    ServerAliveInterval 30
    ServerAliveCountMax 3
```

密钥要求：`~/.ssh/school_ai`（ed25519，权限 600）+ 同名 `.pub`。

**若在全新机器上操作**（没有已部署的密钥）：

```bash
ssh-keygen -t ed25519 -f ~/.ssh/school_ai -N '' -C 'school-ai'
# 然后用平台控制台的 SSH 密码做一次登录，把公钥写入远端 authorized_keys：
ssh-copy-id -i ~/.ssh/school_ai.pub school-ai   # 需要输一次密码
```

> 密码不写入任何文档/代码/环境变量。忘记密码去平台控制台重置实例 SSH 密码。

## 4. 建立 SSH 隧道

```bash
# 启动后台隧道：远端 11434 → 本地 11434
ssh -f -N -L 11434:127.0.0.1:11434 -o ExitOnForwardFailure=yes school-ai

# 验证（能返回模型 JSON 即成功）
curl -s http://127.0.0.1:11434/api/tags | head -c 200
```

**端口冲突处理**：本地 `11434` 被占用时改用 `11435`（`-L 11435:127.0.0.1:11434`），后文所有 URL 同步替换。

**隧道管理**：

```bash
pkill -f 'ssh -f -N -L 11434'          # 关闭隧道
curl -s http://127.0.0.1:11434/api/tags # 健康检查（失败则重开）
```

> WSL 环境下，WSL 内启动的隧道对 Windows 侧的 `127.0.0.1:11434` 同样生效（localhost 互通）。

## 5. API 调用方式

Base URL 一律用 `http://127.0.0.1:11434`（隧道端口）。

### 5.1 原生 API

```bash
# 模型列表
curl -s http://127.0.0.1:11434/api/tags

# 对话（非流式）
curl -s http://127.0.0.1:11434/api/chat -d '{
  "model": "free01/Qwen3.5-9B:latest",
  "messages": [{"role": "user", "content": "你好"}],
  "stream": false
}'
```

### 5.2 OpenAI 兼容端点（推荐给各类工具/SDK）

- Chat Completions：`http://127.0.0.1:11434/v1/chat/completions`
- Models：`http://127.0.0.1:11434/v1/models`
- API Key：任意非空字符串（如 `ollama`）

```python
from openai import OpenAI

client = OpenAI(base_url="http://127.0.0.1:11434/v1", api_key="ollama")
resp = client.chat.completions.create(
    model="free01/Qwen3.5-9B:latest",
    messages=[{"role": "user", "content": "用一句话介绍你自己"}],
)
print(resp.choices[0].message.content)
```

### 5.3 ollama CLI 体验（可选）

本地未装 CLI 时可安装后指向隧道：

```bash
OLLAMA_HOST=127.0.0.1:11434 ollama list
OLLAMA_HOST=127.0.0.1:11434 ollama run free01/Qwen3.5-9B:latest
```

## 6. 可用模型与显存限制（重要）

**GPU 是共享资源**：宿主机双卡 RTX 4090 共 48GB 显存，其他租户进程常驻占用（曾观测到单进程占 35GB）。加载模型前先查余量：

```bash
ssh school-ai 'nvidia-smi --query-gpu=index,memory.used,memory.total --format=csv'
```

模型选择原则：

- 显存空闲 6-8GB/卡 时：可靠运行 ≤5GB 的小模型，如 `free01/Qwen3.5-9B:latest`（3.2GB）、`gemma4:e2b`（7.2GB，需更多余量）
- 大模型（`qwen3.8:27b` 17GB、deepseek 系列 130GB+）只有在显存大量空闲时才能加载，否则报 `unable to load model`
- 名称带 `:cloud` 后缀的为云端代理模型，本地显存无关
- 完整列表以 `curl http://127.0.0.1:11434/api/tags` 实时结果为准

## 7. 故障排查

| 症状 | 原因 | 处理 |
|---|---|---|
| `curl /api/tags` 连接拒绝 | 隧道未启动或已断开 | 重新执行第 4 节隧道命令 |
| SSH 连接超时 | 不在校园网/VPN | 连接校园网或 VPN 后重试 |
| `Permission denied` | 密钥缺失或权限错误 | `chmod 600 ~/.ssh/school_ai`；按第 3 节重新部署公钥 |
| 请求长时间挂起无响应 | 远端 ollama runner 卡死（共享环境常见） | `ssh school-ai` 后执行 `sudo systemctl restart ollama`，等待约 5 秒再试 |
| 返回 `unable to load model` | 显存不足以加载该模型 | 换小模型，或等显存空闲（见第 6 节） |
| 模型加载极慢（>1 分钟） | 首次冷加载属正常；持续 0% GPU 利用率则为卡死 | 同"请求挂起"处理 |

远端服务状态检查：

```bash
ssh school-ai 'systemctl is-active ollama && curl -s --max-time 5 http://127.0.0.1:11434/api/tags | head -c 100'
```

## 8. 安全注意事项

1. SSH 密码不落盘（文档、代码、`.env` 均禁止），认证一律走密钥
2. 密钥文件权限保持 `600`，`~/.ssh` 目录保持 `700`
3. 若怀疑密码泄露，去平台控制台重置；已部署的密钥免密登录不受重置影响
4. 远端实例是共享环境，不要在远端跑无关的高负载任务；`sudo systemctl restart ollama` 只影响本实例的 Ollama 服务
