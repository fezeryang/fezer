# Azure VM 后端部署指南（小白版）

## 前言

本指南将一步步指导你在 Azure VM 上部署 Fezer 项目的完整后端，包括：

- Node.js 服务（API）
- MySQL 数据库
- Nginx 反向代理
- PM2 进程管理

---

## 第一步：创建 Azure VM

### 1.1 登录 Azure 控制台

访问：https://portal.azure.com

### 1.2 创建虚拟机

1. 点击左侧菜单「虚拟机」→「创建」→「Azure 虚拟机」

2. 填写基本信息：

| 配置项         | 填写内容                                            |
| -------------- | --------------------------------------------------- |
| **资源组**     | 点击「新建」，输入 `fezer-rg`                       |
| **虚拟机名称** | `fezer-backend`                                     |
| **区域**       | 选择「East Asia」（香港）延迟低                     |
| **可用性区域** | 暂不需要                                            |
| **镜像**       | 选择「Ubuntu Server 22.04 LTS」                     |
| **大小**       | 点击「查看所有大小」，选择 `Standard_B2s`（2核4GB） |

3. 设置管理员账户：

选择「密码」或「SSH 公钥」：

- **密码**：简单但安全性较低
- **SSH 公钥**：推荐，更安全

4. 配置入站端口：

勾选：

- ☑ SSH (22)
- ☑ HTTP (80)
- ☑ HTTPS (443)

5. 点击「查看 + 创建」→「创建」

### 1.3 获取 VM 信息

创建完成后：

1. 记下「公网 IP 地址」（后面会用到）
2. 记下「用户名」（默认是 `azureuser`）

---

## 第二步：SSH 连接到 VM

### 2.1 下载 SSH 密钥（如果使用密钥认证）

从 Azure 门户下载 `.pem` 密钥文件，保存到本地。

### 2.2 连接 VM

**Windows 用户：**

打开 PowerShell 或 CMD：

```bash
# 使用密钥连接
ssh -i "密钥文件路径.pem" azureuser@你的VM公网IP

# 使用密码连接
ssh azureuser@你的VM公网IP
```

**连接成功后会看到：**

```
Welcome to Ubuntu 22.04.4 LTS
azureuser@fezer-backend:~$
```

---

## 第三步：安装运行环境

### 3.1 更新系统

```bash
sudo apt update && sudo apt upgrade -y
```

**说明：** `-y` 表示自动确认，避免手动输入。

### 3.2 安装 Node.js 20.x

```bash
# 添加 NodeSource 仓库
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# 安装 Node.js
sudo apt-get install -y nodejs

# 验证安装
node -v
npm -v
```

**预期输出：**

```
v20.x.x
10.x.x
```

### 3.3 安装 pnpm

```bash
npm install -g pnpm
pnpm -v
```

### 3.4 安装 PM2

PM2 是 Node.js 进程管理器，可以保持服务后台运行。

```bash
npm install -g pm2
pm2 -v
```

### 3.5 安装 Nginx

Nginx 用作反向代理，将外部请求转发到 Node.js 服务。

```bash
# 安装 Nginx
sudo apt install nginx -y

# 启动 Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# 验证安装
curl localhost
```

**预期输出：** HTML 内容（Nginx 欢迎页）

### 3.6 安装 MySQL

```bash
# 安装 MySQL Server
sudo apt install mysql-server -y

# 启动 MySQL
sudo systemctl start mysql
sudo systemctl enable mysql

# 运行安全配置
sudo mysql_secure_installation
```

**安全配置向导：**

```
VALIDATE PASSWORD COMPONENT：选择 n（不需要密码验证组件）

New password: 输入你的 MySQL root 密码（记住！）

Re-enter new password: 再次输入

Remove anonymous users? Y

Disallow root login remotely? Y（推荐）

Remove test database? Y

Reload privilege tables now? Y
```

---

## 第四步：配置 MySQL 数据库

### 4.1 登录 MySQL

```bash
sudo mysql -u root -p
```

输入你设置的 root 密码。

### 4.2 创建数据库和用户

在 MySQL 命令行中执行（复制粘贴）：

```sql
-- 创建数据库
CREATE DATABASE kinetic_portfolio CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 创建专用用户（密码自行修改）
CREATE USER 'fezer_user'@'localhost' IDENTIFIED BY 'YourStrongPassword_32CharsMinimum';

-- 授权
GRANT ALL PRIVILEGES ON kinetic_portfolio.* TO 'fezer_user'@'localhost';
FLUSH PRIVILEGES;

-- 查看数据库
SHOW DATABASES;

-- 退出
EXIT;
```

**重要：记录以下信息**

- 数据库名：`kinetic_portfolio`
- 用户名：`fezer_user`
- 密码：（你设置的密码）

---

## 第五步：部署代码

### 5.1 克隆代码

```bash
# 创建项目目录
sudo mkdir -p /var/www
sudo chown $USER:$USER /var/www
cd /var/www

# 克隆代码
git clone https://github.com/fezeryang/fezer.git
cd fezer

# 切换到 jianli 分支
git checkout jianli
```

### 5.2 安装依赖

```bash
cd /var/www/fezer
pnpm install
```

**说明：** 这一步会安装所有依赖包，可能需要几分钟。

### 5.3 配置环境变量

```bash
nano /var/www/fezer/.env
```

**复制以下内容，修改密码部分：**

```bash
# ========== 生产环境配置 ==========
NODE_ENV=production
PORT=3000

# ========== 数据库配置 ==========
# 修改这里的密码！
DATABASE_URL=mysql://fezer_user:你的数据库密码@localhost:3306/kinetic_portfolio

# ========== JWT 密钥（生成强密码）==========
# 生成一个32位以上的随机字符串
JWT_SECRET=YourJWTSecret_Key_Must_Be_At_Least_32_Characters_Long

# ========== OAuth 配置 ==========
OAUTH_SERVER_URL=http://localhost:3000
OWNER_OPEN_ID=dev_owner_123

# ========== AI 配置 ==========
AI_PRIMARY_PROVIDER=deepseek
AI_PRIMARY_MODEL=deepseek-chat
AI_FALLBACK_PROVIDER=deepseek
AI_FALLBACK_MODEL=deepseek-chat
DEEPSEEK_API_KEY=你的NVIDIA密钥
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
AI_MAX_TOKENS=2048
AI_REQUEST_TIMEOUT_MS=60000

# ========== LangSmith 监控 ==========
LANGSMITH_TRACING=true
LANGSMITH_API_KEY=你的LangSmith密钥
LANGSMITH_PROJECT=fezer-agent-prod

# ========== CORS 配置 ==========
# 允许前端访问
ALLOWED_ORIGINS=https://fezeryang.github.io,http://localhost:5173
```

**保存文件：**

- 按 `Ctrl + O`
- 按 `Enter`
- 按 `Ctrl + X` 退出

### 5.4 构建项目

```bash
cd /var/www/fezer
pnpm build
```

**预期输出：** 类似 `dist/index.js  179.8kb`

### 5.5 启动服务（使用 PM2）

```bash
cd /var/www/fezer

# 启动服务
pm2 start ecosystem.config.cjs

# 查看状态
pm2 status
```

**预期输出：**

```
┌────┬─────────────┬─────────┬─────────┐
│ id │ name        │ status  │ cpu     │
├────┼─────────────┼─────────┼─────────┤
│ 0  │ fezer-api   │ online  │ 0%      │
└────┴─────────────┴─────────┴─────────┘
```

### 5.6 设置开机自启动

```bash
# 保存当前 PM2 配置
pm2 save

# 设置开机自启动
pm2 startup
```

**复制输出的命令并执行：**

```bash
# 示例（实际复制你看到的输出）
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u azureuser --hp /home/azureuser
```

---

## 第六步：配置 Nginx 反向代理

### 6.1 创建 Nginx 配置文件

```bash
sudo nano /etc/nginx/sites-available/fezer-api
```

**复制以下完整内容：**

```nginx
server {
    listen 80;
    server_name _;

    # 日志文件
    access_log /var/log/nginx/fezer-access.log;
    error_log /var/log/nginx/fezer-error.log;

    # API 反向代理
    location /api/ {
        proxy_pass http://localhost:3000/api/;
        proxy_http_version 1.1;

        # 传递头部信息
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # 超时设置（Agent 调用可能需要较长时间）
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # tRPC 路由
    location /api/trpc/ {
        proxy_pass http://localhost:3000/api/trpc/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**保存：** `Ctrl+O` → `Enter` → `Ctrl+X`

### 6.2 启用站点

```bash
# 创建软链接
sudo ln -s /etc/nginx/sites-available/fezer-api /etc/nginx/sites-enabled/

# 删除默认站点
sudo rm /etc/nginx/sites-enabled/default

# 测试配置
sudo nginx -t
```

**预期输出：**

```
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

```bash
# 重载 Nginx
sudo systemctl reload nginx
```

---

## 第七步：配置防火墙

```bash
# 启用 UFW 防火墙
sudo ufw enable

# 允许 SSH（重要！）
sudo ufw allow 22/tcp

# 允许 HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# 查看状态
sudo ufw status
```

---

## 第八步：配置 Azure 网络安全组

### 8.1 在 Azure 控制台操作

1. 进入你的虚拟机
2. 点击「设置」→「网络」
3. 点击「入站端口规则」→「添加」

### 8.2 添加规则

| 端口 | 协议 | 源     | 说明                    |
| ---- | ---- | ------ | ----------------------- |
| 80   | TCP  | Any    | HTTP                    |
| 443  | TCP  | Any    | HTTPS                   |
| 22   | TCP  | 你的IP | SSH（可选，限制你的IP） |

---

## 第九步：测试部署

### 9.1 测试本地 API

在 VM 上测试：

```bash
# 测试 chat API
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"userInput":"你好"}'
```

### 9.2 测试外部访问

从本地电脑测试（替换 VM 公网 IP）：

```bash
curl -X POST http://你的VM公网IP/api/chat \
  -H "Content-Type: application/json" \
  -d '{"userInput":"你好"}'
```

**预期输出：** JSON 格式的响应

### 9.3 测试数据库连接

```bash
sudo mysql -u fezer_user -p kinetic_portfolio
```

输入密码后，能登录即表示连接正常。

---

## 第十步：更新前端配置

### 10.1 配置 API 地址

**方式一：环境变量（推荐）**

在本地项目创建 `.env.production`：

```bash
VITE_API_URL=https://api.fezern8n.com
```

**方式二：临时测试**

修改 `client/src/hooks/useAgentChat.ts`：

```typescript
const API_BASE = "http://你的VM公网IP/api";
```

### 10.2 重新构建并部署前端

```bash
pnpm build
git add .
git commit -m "更新 API 地址"
git push
```

---

## 日常维护命令

### 查看服务状态

```bash
pm2 status
```

### 查看日志

```bash
pm2 logs fezer-api
```

### 重启服务

```bash
pm2 restart fezer-api
```

### 更新代码

```bash
cd /var/www/fezer
git pull origin jianli
pnpm install
pnpm build
pm2 restart fezer-api
```

### 查看 Nginx 日志

```bash
sudo tail -f /var/log/nginx/fezer-error.log
```

### 重启 Nginx

```bash
sudo systemctl reload nginx
```

---

## 常见问题

### 问题 1：端口被占用

```bash
# 查看占用端口的进程
sudo lsof -i :3000

# 杀死进程
sudo kill -9 进程ID
```

### 问题 2：数据库连接失败

检查 `.env` 中的 `DATABASE_URL` 是否正确。

### 问题 3：PM2 服务崩溃

```bash
pm2 logs fezer-api --lines 50
```

查看详细错误信息。

### 问题 4：502 Bad Gateway

通常是后端服务未启动，检查 PM2 状态。

---

## 下一步

部署完成后：

1. ✅ 确认后端 API 正常运行
2. ✅ 配置前端连接到后端
3. ✅ 测试完整的对话功能
4. ✅ 配置 HTTPS（使用 Let's Encrypt）

**需要帮助？** 随时告诉我！
