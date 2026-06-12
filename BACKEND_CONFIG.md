# Fezer 后端配置文档

> 生成时间：2026-04-19
> 部署环境：Azure VM (Ubuntu 22.04)

---

## 服务器信息

| 项目       | 值               |
| ---------- | ---------------- |
| 服务器类型 | Azure VM         |
| IP 地址    | `4.188.113.194`  |
| 操作系统   | Ubuntu 22.04 LTS |
| 规格       | 2核 4GB          |
| 用户名     | `openclawed`     |

---

## 服务端口

| 服务        | 端口 | 说明          |
| ----------- | ---- | ------------- |
| Node.js API | 3000 | 后端 API 服务 |
| Nginx       | 80   | HTTP 反向代理 |
| MySQL       | 3306 | 数据库        |
| PM2         | -    | 进程管理      |

---

## 数据库配置

| 项目       | 值                                                         |
| ---------- | ---------------------------------------------------------- |
| 数据库名   | `kinetic_portfolio`                                        |
| 用户名     | `fezer_user`                                               |
| 密码       | _(已配置，未记录在此)_                                     |
| 连接字符串 | `mysql://fezer_user:密码@localhost:3306/kinetic_portfolio` |

---

## 环境变量 (.env)

```bash
# ========== 生产环境配置 ==========
NODE_ENV=production
PORT=3000

# ========== 数据库配置 ==========
DATABASE_URL=mysql://fezer_user:密码@localhost:3306/kinetic_portfolio

# ========== JWT 密钥 ==========
JWT_SECRET=*(至少32位的随机字符串)*

# ========== OAuth 配置 ==========
OAUTH_SERVER_URL=*(你的OAuth服务器地址)*
OWNER_OPEN_ID=*(你的OpenID)*

# ========== AI 配置 ==========
AI_PRIMARY_PROVIDER=deepseek
AI_PRIMARY_MODEL=deepseek-chat
AI_FALLBACK_PROVIDER=deepseek
AI_FALLBACK_MODEL=deepseek-chat
DEEPSEEK_API_KEY=*(你的官方 DeepSeek API Key)*
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
AI_MAX_TOKENS=2048
AI_REQUEST_TIMEOUT_MS=60000

# ========== LangSmith 监控 ==========
LANGSMITH_TRACING=true
LANGSMITH_API_KEY=*(你的LangSmith API Key)*
LANGSMITH_PROJECT=fezer-agent-prod

# ========== CORS 配置 ==========
ALLOWED_ORIGINS=https://fezeryang.github.io
```

---

## API 端点

| 端点             | 方法 | 说明     |
| ---------------- | ---- | -------- |
| `/api/chat`      | POST | 通用对话 |
| `/api/guide`     | POST | 导览介绍 |
| `/api/character` | POST | 角色交互 |
| `/health`        | GET  | 健康检查 |

---

## Nginx 配置

文件位置：`/etc/nginx/sites-available/fezer-api`

```nginx
server {
    listen 80;
    server_name _;

    location /api/ {
        proxy_pass http://localhost:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## PM2 配置

应用名称：`fezer-api`

### 常用命令

```bash
# 查看状态
pm2 status

# 查看日志
pm2 logs fezer-api

# 重启服务
pm2 restart fezer-api

# 停止服务
pm2 stop fezer-api

# 保存配置
pm2 save

# 查看详细信息
pm2 show fezer-api
```

---

## 部署流程

### 更新代码

```bash
cd /var/www/fezer
git pull origin jianli
pnpm install
pnpm build
pm2 restart fezer-api
```

### 查看错误

```bash
# PM2 日志
pm2 logs fezer-api --lines 100

# Nginx 错误日志
sudo tail -f /var/log/nginx/fezer-error.log

# Nginx 访问日志
sudo tail -f /var/log/nginx/fezer-access.log
```

---

## Cloudflare Tunnel（临时方案）

### 启动命令

```bash
nohup cloudflared tunnel --url http://localhost:3000 > ~/cloudflared.log 2>&1 &
```

### 获取 URL

从日志中查看生成的 HTTPS URL，格式：

```
https://xxx-xxx-xxx.trycloudflare.com
```

### 停止

```bash
pkill cloudflared
```

---

## 前端配置

### 开发环境

```bash
# .env
VITE_API_URL=http://localhost:3000
```

### 生产环境

```bash
# .env.production
VITE_API_URL=https://api.fezern8n.com
```

或使用 Cloudflare Tunnel：

```bash
VITE_API_URL=https://xxx-xxx-xxx.trycloudflare.com
```

---

## 故障排查

### API 返回 404

检查 Nginx 配置和服务状态：

```bash
sudo nginx -t
sudo systemctl status nginx
```

### API 返回 500

检查 PM2 日志：

```bash
pm2 logs fezer-api
```

### 数据库连接失败

检查 MySQL 状态和连接：

```bash
sudo systemctl status mysql
mysql -u fezer_user -p kinetic_portfolio
```

### 混合内容错误（HTTPS → HTTP）

需要为后端配置 SSL 证书，参见 [HTTPS_DEPLOYMENT_PLAN.md](./HTTPS_DEPLOYMENT_PLAN.md)

---

## 重要文件位置

| 文件       | 路径                                   |
| ---------- | -------------------------------------- |
| 项目目录   | `/var/www/fezer`                       |
| Nginx 配置 | `/etc/nginx/sites-available/fezer-api` |
| PM2 配置   | `~/.pm2/`                              |
| 环境变量   | `/var/www/fezer/.env`                  |
| 日志目录   | `/var/www/fezer/.manus-logs/`          |

---

## 联系信息

- 项目仓库：https://github.com/fezeryang/fezer
- 主要分支：`jianli`

---

## 更新日志

| 日期       | 更新内容         |
| ---------- | ---------------- |
| 2026-04-19 | 初始配置文档创建 |
