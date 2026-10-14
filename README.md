# 简易 ERP 系统

技术栈：

- 前端：React + TypeScript + Vite
- 后端：Node.js + Express
- 数据库：MySQL
- 生产部署：宝塔面板 + Nginx + PM2

## 功能

- 规格录入
- 一级分类录入
- 子规格自由添加
- 左侧导航按一级分类切换
- 产品录入
- 按分类动态切换表头
- 行内编辑
- 父子产品结构
- 批量删除、批量改状态
- 亏损记录
- 毛利计算
- 阿里/千牛订单 Excel 识别
- 物流单号查询
- 登录、注册、退出登录
- 用户管理：新增用户、删除用户、重置密码、查看头像/用户名/邮箱

## 目录

- `frontend`：前端项目
- `backend`：后端项目
- `backend/sql/schema.sql`：数据库表结构
- `backend/.env.example`：后端环境变量模板
- `backend/ecosystem.config.cjs`：PM2 后端守护配置
- `deploy/bt-nginx.conf`：宝塔 Nginx 配置示例
- `命令.txt`：服务器部署速查命令

## 本地启动

### 1. 配置后端环境变量

复制 `backend/.env.example` 为 `backend/.env`，填写本机 MySQL 连接信息。

```bash
cd backend
cp .env.example .env
```

### 2. 启动后端

```bash
cd backend
npm install
npm run dev
```

后端首次启动会：

- 自动创建数据库 `simple_erp`
- 自动执行 `backend/sql/schema.sql` 建表
- 自动执行 `backend/src/config/db.js` 中的兼容迁移

### 3. 配置前端环境变量

复制 `frontend/.env.example` 为 `frontend/.env`。

默认内容：

```env
VITE_API_BASE_URL=/api
```

本地开发时，`frontend/vite.config.ts` 已经配置 `/api` 代理到 `http://localhost:3001`。

### 4. 启动前端

```bash
cd frontend
npm install --include=optional
npm run dev
```

访问：

```text
http://localhost:5173/
```

## 宝塔生产部署

以下示例以这两个域名为准：

```text
testclf01.xyz
www.testclf01.xyz
```

推荐统一访问：

```text
https://www.testclf01.xyz
```

### 1. 宝塔软件安装

在宝塔面板安装：

- Nginx
- MySQL 8.0 或 5.7+
- PM2 管理器 / Node.js 版本管理器
- Node.js 20 或更高版本

服务器安全组和宝塔安全里放行：

- `80`
- `443`

后端 `3001` 只需要本机 Nginx 反向代理访问，不建议对公网放行。

### 2. 上传项目

推荐项目目录：

```text
/www/wwwroot/simple-erp
```

上传后目录应类似：

```text
/www/wwwroot/simple-erp/backend
/www/wwwroot/simple-erp/frontend
/www/wwwroot/simple-erp/deploy
```

不要把本地 `node_modules` 当作必须文件依赖，服务器上重新安装依赖更稳。

### 3. 创建数据库

宝塔面板进入「数据库」：

1. 新建数据库：`simple_erp`
2. 新建用户：例如 `simple_erp_user`
3. 设置强密码
4. 权限选择当前数据库

注意：本项目后端启动时会尝试自动建库。如果你使用的 MySQL 用户没有 `CREATE DATABASE` 权限，请提前在宝塔创建好 `simple_erp` 数据库。只要数据库存在，后端仍会自动建表。

### 4. 配置后端环境变量

在服务器创建：

```bash
cd /www/wwwroot/simple-erp/backend
cp .env.example .env
```

编辑 `/www/wwwroot/simple-erp/backend/.env`：

```env
PORT=3001
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=simple_erp_user
MYSQL_PASSWORD=请填写宝塔数据库密码
MYSQL_DATABASE=simple_erp
CORS_ORIGIN=https://www.testclf01.xyz,https://testclf01.xyz
AUTH_SECRET=请填写一串足够长的随机密钥
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_EMAIL=admin@example.com
DEFAULT_ADMIN_PASSWORD=Admin@123456
```

默认账号只会在 `users` 表为空时自动创建。上线后请登录系统，在「用户管理」里重置默认账号密码，或在首次启动前修改 `DEFAULT_ADMIN_PASSWORD`。

### 5. 安装并启动后端

```bash
cd /www/wwwroot/simple-erp/backend
npm install --omit=dev
pm2 start ecosystem.config.cjs
pm2 save
```

检查后端：

```bash
pm2 list
pm2 logs simple-erp-backend
curl http://127.0.0.1:3001/api/health
```

正常会返回类似：

```json
{"ok":true,"timestamp":"2026-08-04T00:00:00.000Z"}
```

### 6. 配置并打包前端

前端生产环境使用同域名相对路径 `/api`，避免 HTTPS 页面请求 HTTP 接口导致浏览器拦截。

确认 `/www/wwwroot/simple-erp/frontend/.env`：

```env
VITE_API_BASE_URL=/api
```

如果没有 `.env`，项目也会默认使用 `/api`。

安装依赖并打包：

```bash
cd /www/wwwroot/simple-erp/frontend
npm install --include=optional
npm run build
```

打包产物在：

```text
/www/wwwroot/simple-erp/frontend/dist
```

### 7. 宝塔创建网站

宝塔面板进入「网站」：

1. 添加站点
2. 域名填写：

```text
testclf01.xyz
www.testclf01.xyz
```

3. 根目录选择：

```text
/www/wwwroot/simple-erp/frontend/dist
```

4. PHP 版本选择「纯静态」

### 8. 配置 SSL

宝塔站点设置进入「SSL」：

1. 选择 Let's Encrypt
2. 勾选：

```text
testclf01.xyz
www.testclf01.xyz
```

3. 申请并部署证书
4. 开启「强制 HTTPS」

证书必须包含这两个域名，不能只签给服务器 IP。

### 9. 配置 Nginx 反向代理

宝塔站点设置进入「配置文件」，参考 `deploy/bt-nginx.conf`。

关键配置是：

```nginx
location /api/ {
  proxy_pass http://127.0.0.1:3001;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}

location / {
  try_files $uri $uri/ /index.html;
}
```

保存后重载 Nginx。

### 10. 上线验证

依次检查：

```bash
curl -I https://www.testclf01.xyz
curl https://www.testclf01.xyz/api/health
```

浏览器访问：

```text
https://www.testclf01.xyz
```

打开浏览器开发者工具，确认：

- 页面为 HTTPS
- API 请求为 `https://www.testclf01.xyz/api/...`
- 没有 `Mixed Content`
- 没有证书不匹配提示
- 页面底部显示备案号并可跳转工信部备案站
- 可使用默认账号 `admin / Admin@123456` 登录
- 登录后右上角显示头像和用户名，未登录时无法访问 ERP 功能

## 常见问题

### 1. 浏览器提示不安全

检查 SSL 证书是否包含：

```text
DNS:testclf01.xyz
DNS:www.testclf01.xyz
```

不要使用只包含服务器 IP 的证书。

### 2. 前端页面能打开，但接口 502

检查后端是否运行：

```bash
pm2 list
pm2 logs simple-erp-backend
curl http://127.0.0.1:3001/api/health
```

如果本机 `3001` 不通，Nginx `/api` 就会返回 502。

### 3. 后端启动失败，提示 MySQL 连接失败

检查：

- MySQL 是否启动
- `backend/.env` 中账号密码是否正确
- MySQL 用户是否有 `simple_erp` 数据库权限
- `MYSQL_HOST` 是否为 `127.0.0.1`

### 4. 前端打包缺少 native binding

如果出现 `Cannot find native binding`，在服务器重新安装依赖：

```bash
cd /www/wwwroot/simple-erp/frontend
rm -rf node_modules
npm install --include=optional
npm run build
```

### 5. 刷新页面 404

Nginx 必须配置：

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

### 6. 修改前端后没有生效

重新打包：

```bash
cd /www/wwwroot/simple-erp/frontend
npm run build
```

然后在浏览器强制刷新，或清理宝塔/Nginx 缓存。

打包流程

cd /www/wwwroot/frontend
npm install --include=optional
npm run build

rm -rf /www/wwwroot/erp-frontend/*
cp -r dist/* /www/wwwroot/erp-frontend/
