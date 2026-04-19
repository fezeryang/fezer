# 后端部署快速清单

## 准备阶段（本地操作）

- [ ] 确认代码已推送到 GitHub `jianli` 分支
- [ ] 准备好服务器 IP 地址和密码
- [ ] 安装本地 SSH 客户端（Windows 自带）

## 服务器配置（SSH 登录后操作）

### 安装软件
- [ ] 安装 Node.js 20.x
- [ ] 安装 pnpm
- [ ] 安装 PM2
- [ ] 安装 MySQL（或确认 RDS 地址）

### 数据库配置
- [ ] 创建数据库 `kinetic_portfolio`
- [ ] 创建数据库用户 `fezer_user`
- [ ] 记录数据库密码

### 代码部署
- [ ] 克隆仓库到 `~/fezer`
- [ ] 切换到 `jianli` 分支
- [ ] 运行 `pnpm install`
- [ ] 运行 `pnpm build`

### 环境变量
- [ ] 创建 `.env` 文件
- [ ] 配置 `DATABASE_URL`
- [ ] 配置 `JWT_SECRET`（生成强密码）
- [ ] 配置 `DEEPSEEK_API_KEY`
- [ ] 配置 `LANGSMITH_API_KEY`
- [ ] 配置 `ALLOWED_ORIGINS`

### 启动服务
- [ ] 运行 `pm2 start ecosystem.config.cjs`
- [ ] 运行 `pm2 save`
- [ ] 运行 `pm2 startup`（复制输出命令执行）

### 网络配置
- [ ] 服务器防火墙开放 3000 端口
- [ ] 阿里云安全组开放 3000 端口

### 测试验证
- [ ] 本地测试：`curl http://localhost:3000/api/chat`
- [ ] 外部测试：`curl http://服务器IP:3000/api/chat`
- [ ] 确认前端可以访问 API

---

## 一键部署命令（保存备用）

```bash
# 完整部署流程
cd ~/fezer && \
git pull origin jianli && \
pnpm install && \
pnpm build && \
pm2 restart fezer-api && \
pm2 save && \
echo "部署完成！"
```

---

## 常用端口

| 服务 | 端口 |
|------|------|
| 后端 API | 3000 |
| MySQL | 3306 |
| SSH | 22 |

---

## 紧急回滚

```bash
cd ~/fezer
git reflog  # 查看历史
git reset --hard HEAD@{n}  # 回滚到第 n 个版本
pnpm build
pm2 restart fezer-api
```
