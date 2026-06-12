# 前端 API 配置指南

## 环境变量配置

### 开发环境

在项目根目录创建 `.env` 文件：

```bash
# 本地开发时，API 运行在本地
VITE_API_URL=http://localhost:3000
```

### 生产环境（Azure VM）

在项目根目录创建 `.env.production` 文件：

```bash
# 生产环境 API 地址
VITE_API_URL=https://api.fezern8n.com
```

---

## API 调用说明

前端通过 `useAgentChat` Hook 调用后端 API。

### 使用示例

```typescript
import { useAgentChat } from "@/hooks/useAgentChat";

function MyComponent() {
  const { sendMessage, isLoading } = useAgentChat();

  const handleSend = async () => {
    await sendMessage({
      userInput: "你好",
      characterId: "builder",
      interactionType: "chat",
    });
  };

  return <button onClick={handleSend}>发送消息</button>;
}
```

---

## API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/chat` | POST | 通用对话 |
| `/api/guide` | POST | 导览介绍 |
| `/api/character` | POST | 角色交互 |
| `/api/trpc/*` | * | tRPC 路由 |

---

## 常见问题

### 问题 1：CORS 错误

确保后端 `.env` 中配置了 `ALLOWED_ORIGINS`：

```bash
ALLOWED_ORIGINS=https://fezeryang.github.io
```

### 问题 2：API 超时

Agent 调用可能需要较长时间，前端请求可能超时。

解决方案：
1. 增加 Nginx 超时时间
2. 添加前端重试逻辑
3. 使用流式响应（未来实现）

### 问题 3：开发环境连接失败

确认后端服务正在运行：

```bash
pm2 status
curl http://localhost:3000/api/chat
```
