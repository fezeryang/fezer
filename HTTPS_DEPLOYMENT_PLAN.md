# GitHub Pages HTTPS 后端部署计划

## 目标

让 GitHub Pages（HTTPS）能正常访问后端 AI API。

---

## 问题

- GitHub Pages 使用 **HTTPS**
- Azure VM 后端只有 **HTTP**
- 浏览器阻止 HTTPS 页面调用 HTTP API（混合内容错误）

---

## 解决方案

### 方案 A：使用阿里云域名 + Cloudflare SSL（推荐）

**优点**：免费 SSL，配置简单，稳定可靠

#### 步骤

1. **在阿里云添加 DNS 记录**
   ```
   类型: A
   主机记录: api
   记录值: 4.188.113.194 (Azure VM IP)
   TTL: 600
   ```

2. **将域名 DNS 指向 Cloudflare**
   - 在 Cloudflare 添加站点
   - 使用 Cloudflare 的 nameserver

3. **Cloudflare 自动提供 SSL**
   - SSL/TLS 模式设为 "Flexible" 或 "Full"

4. **更新前端配置**
   ```bash
   VITE_API_URL=https://api.fezern8n.com
   ```

---

### 方案 B：直接在 Azure VM 配置 Let's Encrypt

**优点**：自己掌控证书，不依赖第三方

#### 步骤

1. **域名 DNS 指向 VM**
   - 在阿里云添加 A 记录指向 `4.188.113.194`

2. **在 VM 上安装 Certbot**
   ```bash
   sudo apt update
   sudo apt install certbot python3-certbot-nginx -y
   ```

3. **获取 SSL 证书**
   ```bash
   sudo certbot --nginx -d api.yourdomain.com
   ```

4. **Nginx 自动配置 SSL**

5. **更新前端配置**
   ```bash
   VITE_API_URL=https://api.fezern8n.com
   ```

---

### 方案 C：Cloudflare Tunnel（最简单，但 URL 会变化）

**优点**：不需要域名，一条命令搞定

**缺点**：临时 URL 会变化

```bash
cloudflared tunnel --url http://localhost:3000
```

---

## 推荐方案：方案 A（Cloudflare）

### 完整步骤

#### 第 1 步：阿里云 DNS 配置

1. 登录阿里云 → 域名 → DNS 解析
2. 添加记录：
   ```
   类型: A
   主机记录: api
   记录值: 4.188.113.194
   ```

#### 第 2 步：Cloudflare 配置

1. 注册 [Cloudflare](https://dash.cloudflare.com/sign-up)
2. 添加你的域名
3. Cloudflare 会自动扫描 DNS 记录
4. 更新域名的 nameserver 为 Cloudflare 提供的值

#### 第 3 步：等待 DNS 生效

通常需要 1-2 小时，最长 24 小时

#### 第 4 步：测试

```bash
curl https://api.yourdomain.com/api/chat \
  -H "Content-Type: application/json" \
  -d '{"userInput":"你好"}'
```

#### 第 5 步：更新前端

1. 在 GitHub 仓库设置中添加环境变量：
   - Name: `VITE_API_URL`
   - Value: `https://api.yourdomain.com`

2. 或在 `.env.production` 中：
   ```bash
   VITE_API_URL=https://api.fezern8n.com
   ```

3. 提交并推送到 GitHub

---

## 待办清单

- [ ] 阿里云 DNS 添加 A 记录
- [ ] Cloudflare 添加域名
- [ ] 更新域名 nameserver
- [ ] 等待 DNS 生效
- [ ] 测试 HTTPS API
- [ ] 更新前端配置
- [ ] 提交代码到 GitHub
- [ ] 测试 GitHub Pages

---

## 注意事项

1. **DNS 生效需要时间**：通常 1-2 小时，最长 24 小时
2. **Cloudflare 免费版足够使用**
3. **SSL 证书自动续期**
4. **如果有域名问题**，先在 Cloudflare 检查 DNS 状态
