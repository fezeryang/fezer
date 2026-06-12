# Fezer 后端部署指南（小白版）

## 部署架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                    阿里云服务器 (ECS)                         │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Node.js 服务 (PM2 管理)                               │ │
│  │  - 端口: 3000                                           │ │
│  │  - 入口: dist/index.js                                 │ │
│  └────────────────────────────────────────────────────────┘ │
│                              │                               │
│  ┌───────────────────────────┼─────────────────────────────┐ │
│  ▼                           ▼                              │ │
│  MySQL 数据库              外部 API                           │
│  (RDS 或自建)           - DeepSeek API                      │
│                        - OAuth 服务器                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    前端 (GitHub Pages)                       │
│  https://fezeryang.github.io/fezer/                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 前置准备

### 1. 阿里云服务器

你需要一台阿里云 ECS 服务器，推荐配置：

| 配置项 | 最低要求      | 推荐配置     |
| ------ | ------------- | ------------ |
| CPU    | 1核           | 2核          |
| 内存   | 1GB           | 2GB          |
| 系统   | Ubuntu 20.04+ | Ubuntu 22.04 |
| 带宽   | 1Mbps         | 3Mbps        |

### 2. MySQL 数据库

选项 A：使用阿里云 RDS（推荐，省心）
选项 B：在 ECS 上自建 MySQL

### 3. 域名（可选）

如果有域名，可以配置 SSL 证书，HTTPS 更安全。

---

## 部署步骤

### 第一步：登录服务器

在你的本地电脑打开终端（PowerShell 或 CMD）：

```bash
# SSH 登录到你的阿里云服务器
ssh root@你的服务器公网IP

# 示例：
# ssh root@123.56.78.90
```

输入密码后即可登录。

---

### 第二步：安装必要软件

#### 2.1 安装 Node.js

```bash
# 安装 Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 验证安装
node -v  # 应该显示 v20.x.x
npm -v
```

#### 2.2 安装 pnpm

```bash
npm install -g pnpm
pnpm -v
```

#### 2.3 安装 PM2（进程管理器）

```bash
npm install -g pm2
pm2 -v
```

#### 2.4 安装 MySQL（如果不用 RDS）

```bash
sudo apt update
sudo apt install mysql-server -y

# 启动 MySQL
sudo systemctl start mysql
sudo systemctl enable mysql

# 设置 root 密码
sudo mysql
```

在 MySQL 命令行中执行：

```sql
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '你的强密码';
FLUSH PRIVILEGES;
EXIT;
```

---

### 第三步：配置 MySQL 数据库

```bash
# 登录 MySQL
sudo mysql -u root -p

# 输入密码后进入 MySQL 命令行
```

在 MySQL 中执行：

```sql
-- 创建数据库
CREATE DATABASE kinetic_portfolio CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 创建专用数据库用户（更安全）
CREATE USER 'fezer_user'@'localhost' IDENTIFIED BY '强密码_至少32位';

-- 授权
GRANT ALL PRIVILEGES ON kinetic_portfolio.* TO 'fezer_user'@'localhost';
FLUSH PRIVILEGES;

-- 查看数据库
SHOW DATABASES;
EXIT;
```

**记下这些信息，后面配置环境变量要用：**

- 数据库地址：`localhost`（或 RDS 内网地址）
- 数据库名：`kinetic_portfolio`
- 用户名：`fezer_user`
- 密码：（你设置的密码）
- 端口：`3306`

---

### 第四步：部署后端代码

#### 4.1 克隆代码

```bash
# 进入服务器 home 目录
cd ~

# 克隆你的仓库（如果还没克隆）
git clone https://github.com/fezeryang/fezer.git
cd fezer

# 切换到你的分支
git checkout jianli
git pull origin jianli
```

#### 4.2 安装依赖

```bash
cd ~/fezer
pnpm install
```

#### 4.3 构建项目

```bash
pnpm build
```

构建完成后，会生成 `dist/index.js` 文件。

---

### 第五步：配置环境变量

```bash
# 在项目根目录创建 .env 文件
nano ~/fezer/.env
```

**复制以下内容并修改：**

```bash
# ========== 生产环境配置 ==========
NODE_ENV=production
PORT=3000

# ========== 数据库配置 ==========
# 格式：mysql://用户名:密码@地址:端口/数据库名
DATABASE_URL=mysql://fezer_user:你的数据库密码@localhost:3306/kinetic_portfolio

# ========== JWT 密钥（生成一个强密码） ==========
JWT_SECRET=生成一个_32位以上_的随机字符串_不要和别人分享

# ========== OAuth 配置 ==========
OAUTH_SERVER_URL=https://你的OAuth服务器地址
OWNER_OPEN_ID=你的OpenID

# ========== AI 配置 ==========
AI_PRIMARY_PROVIDER=deepseek
AI_PRIMARY_MODEL=deepseek-chat
AI_FALLBACK_PROVIDER=deepseek
AI_FALLBACK_MODEL=deepseek-chat
DEEPSEEK_API_KEY=<你的_NVIDIA_API_Key>
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
AI_MAX_TOKENS=2048
AI_REQUEST_TIMEOUT_MS=60000

# ========== LangSmith 监控（可选） ==========
LANGSMITH_TRACING=true
LANGSMITH_API_KEY=<你的_LangSmith_API_Key>
LANGSMITH_PROJECT=fezer-agent-prod

# ========== CORS 配置 ==========
# 允许前端访问（替换为你的前端域名）
ALLOWED_ORIGINS=https://fezeryang.github.io
```

**保存文件：**
按 `Ctrl + O`，然后 `Enter`，再按 `Ctrl + X` 退出。

---

### 第六步：用 PM2 启动服务

```bash
cd ~/fezer

# 启动服务
pm2 start dist/index.js --name fezer-api

# 查看状态
pm2 status

# 查看日志（确认服务正常）
pm2 logs fezer-api

# 设置开机自启动
pm2 startup
pm2 save
```

如果看到 `fezer-api | online`，说明服务启动成功！

---

### 第七步：配置防火墙

```bash
# 开放 3000 端口
sudo ufw allow 3000/tcp

# 如果还没启用防火墙，启用它
sudo ufw enable

# 查看状态
sudo ufw status
```

**同时需要在阿里云控制台配置安全组：**

1. 登录阿里云控制台
2. 找到你的 ECS 实例
3. 点击「安全组」→「配置规则」
4. 添加入方向规则：
   - 端口：3000
   - 授权对象：0.0.0.0/0

---

### 第八步：测试 API

在服务器上测试：

```bash
curl http://localhost:3000/api/chat -X POST \
  -H "Content-Type: application/json" \
  -d '{"userInput":"你好"}'
```

如果返回 JSON 响应，说明 API 正常工作！

从本地电脑测试（替换为你的服务器 IP）：

```bash
curl http://你的服务器IP:3000/api/chat -X POST \
  -H "Content-Type: application/json" \
  -d '{"userInput":"你好"}'
```

---

## 日常维护命令

### 查看服务状态

```bash
pm2 status
pm2 logs fezer-api
pm2 monit
```

### 重启服务

```bash
pm2 restart fezer-api
```

### 更新代码

```bash
cd ~/fezer
git pull origin jianli
pnpm install
pnpm build
pm2 restart fezer-api
```

### 查看错误日志

```bash
pm2 logs fezer-api --err
```

---

## 前端配置

前端需要配置 API 地址。在你的 GitHub Pages 设置中：

1. 进入 `client/src` 目录
2. 找到 API 配置文件，将 API 地址改为：
   ```
   API_URL=http://你的服务器IP:3000
   # 或者如果有域名：https://api.yourdomain.com
   ```

---

## 常见问题

### 1. 端口被占用

```bash
# 查看占用端口的进程
sudo lsof -i :3000
# 杀死进程
sudo kill -9 进程ID
```

### 2. 数据库连接失败

检查 `.env` 中的 `DATABASE_URL` 是否正确：

```bash
# 测试数据库连接
sudo mysql -u fezer_user -p kinetic_portfolio
```

### 3. PM2 服务崩溃

```bash
# 查看完整日志
pm2 logs --lines 100

# 重置并重启
pm2 delete fezer-api
pm2 start dist/index.js --name fezer-api
pm2 save
```

### 4. 内存不足

```bash
# 查看内存使用
free -h

# 如果内存不足，可以考虑：
# 1. 升级服务器配置
# 2. 使用 swap 虚拟内存（临时方案）
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

---

## 安全建议

1. **不要把 .env 文件上传到 git**
2. **定期更换 JWT_SECRET**
3. **使用强密码**
4. **配置防火墙，只开放必要端口**
5. **定期备份数据库**
6. **使用 HTTPS（推荐配置 SSL 证书）**

---

## 下一步

部署完成后：

1. ✅ 确认后端 API 正常运行
2. ✅ 配置前端连接到后端 API
3. ✅ 测试完整的对话功能
4. ✅ 监控 LangSmith 追踪日志

需要帮助？随时告诉我！
