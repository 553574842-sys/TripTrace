<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/logo-triptrace-light.svg" />
  <source media="(prefers-color-scheme: light)" srcset="docs/logo-triptrace-dark.svg" />
  <img src="docs/logo-triptrace-dark.svg" alt="TripTrace" height="96" />
</picture>

<h1>TripTrace / 旅迹</h1>

国内旅行行程规划工具：创建一次旅行，自动定位目的地，安排每天去哪里、怎么走、坐什么交通。

TripTrace / 旅迹 是一个面向中文用户的自托管旅行规划项目，适合个人、家庭和朋友一起整理国内行程。

<br />

<a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-AGPL_v3-6B7280?style=flat-square" /></a>

</div>

---

## 项目定位

TripTrace / 旅迹 是一个中文优先的旅行行程规划系统。它的目标不是做旅游攻略社区，而是帮用户把一次具体旅行安排清楚：

- 去哪个城市
- 每天去哪些地点
- 地点之间怎么走
- 交通、预订、清单、文件放在哪里
- 出发前还有哪些事情要确认

当前版本已经面向国内使用场景做了改造：默认中文界面、默认高德地图底图、支持根据旅行标题自动识别目的地并居中地图，例如创建「长沙」后地图会自动定位到长沙。

这个仓库基于 AGPL v3 开源项目改造。如果你修改后对外提供网络服务，请遵守 AGPL v3 的开源义务。
来源与独立维护声明见 [UPSTREAM-NOTICE.md](UPSTREAM-NOTICE.md)。

## 适合谁用

- 自己规划自由行的人
- 家庭、情侣、朋友一起出行的人
- 想把地点、交通、预订信息集中管理的人
- 想用 AI 从截图或文字里自动识别交通信息的人
- 想自托管、自己掌握数据的用户

## 核心功能

- 极简创建旅行：新建时只需要填写标题，日期和细节可以之后再补。
- 标题自动定位：根据标题里的城市或地名自动居中地图。
- 国内地图体验：默认使用高德地图底图，适合国内旅行规划。
- 每日行程：按第 1 天、第 2 天组织地点，也可以后续设置真实日期。
- 地点管理：搜索地点、添加地点、分类、备注、安排到某一天。
- 路线能力：国内路线、距离、耗时优先接入高德能力。
- 交通记录：管理飞机、火车、汽车、轮船等交通信息。
- AI 辅助填写：上传截图或输入描述，让 AI 自动解析交通信息并填入表单。
- 文件和资料：集中保存旅行相关资料、票据和附件。
- 预算与清单：记录花费、准备行李清单和待办事项。
- 多人协作：邀请成员共同编辑行程，实时同步。
- PDF / ICS 导出：导出行程 PDF 或日历文件。

## 技术栈

- 前端：React 18、Vite、TypeScript、Tailwind CSS、Zustand。
- 后端：Node.js、Express、TypeScript、SQLite、WebSocket。
- 地图：Leaflet、高德地图瓦片、高德路线 API。
- 认证：JWT、OIDC / SSO、TOTP MFA。
- 部署：Docker、Docker Compose、Helm / Kubernetes。

## 如何使用

本地启动后，推荐按下面的流程试用：

1. 登录系统。
2. 点击「创建新旅行」。
3. 输入标题，例如「长沙」或「长沙三日游」。
4. 进入行程页后，地图会根据标题自动定位到对应城市。
5. 在右侧添加地点或活动。
6. 在左侧把地点安排到第 1 天、第 2 天等每日行程。
7. 添加交通记录，可以手动填写，也可以用 AI 上传截图自动识别。
8. 根据需要继续补充预订、清单、预算和文件。

## 快速开始

### 本地开发

```bash
cd server
npm install
npm run dev
```

再开一个终端：

```bash
cd client
npm install
npm run dev
```

默认地址：

- 前端：`http://localhost:5173`
- 后端：`http://localhost:3001`

如果前端出现 `/api/... ECONNREFUSED`，说明后端没有启动或端口不是 `3001`。

### Docker Compose

```bash
cp .env.example .env
# 编辑 .env，至少设置 ENCRYPTION_KEY、ADMIN_PASSWORD、AMAP_API_KEY 和 AI_API_KEY
docker compose up -d
docker compose ps
curl http://localhost:3000/api/health
```

Compose 默认会从源码构建 `triptrace:local` 镜像，并把 `./data` 与 `./uploads` 持久化到宿主机。示例配置见 [docker-compose.yml](docker-compose.yml)。生产环境建议放在 TLS 反向代理后，并确保 `/ws` 支持 WebSocket upgrade。

部署演练时可在 `.env` 中临时设置 `TRIPTRACE_CONTAINER_NAME=triptrace-drill`、`TRIPTRACE_PORT=3300`、`TRIPTRACE_DATA_DIR=./data-drill` 和 `TRIPTRACE_UPLOAD_DIR=./uploads-drill`，避免覆盖正式数据。

## 环境变量

| Variable | Description | Default |
| --- | --- | --- |
| `PORT` | 服务端端口 | `3000` |
| `NODE_ENV` | 运行环境 | `production` |
| `ENCRYPTION_KEY` | 静态密钥，用于加密 API keys、MFA、SMTP、OIDC 等敏感信息 | Auto |
| `DEFAULT_LANGUAGE` | 默认语言，中文部署建议设为 `zh` | `zh` |
| `APP_URL` | 实例公开地址，例如 `https://triptrace.example.com` | - |
| `ALLOWED_ORIGINS` | CORS 和邮件链接允许的来源 | same-origin |
| `ADMIN_EMAIL` | 首个管理员邮箱 | `admin@triptrace.local` |
| `ADMIN_PASSWORD` | 首个管理员密码 | random |
| `OIDC_ISSUER` | OIDC provider 地址 | - |
| `OIDC_CLIENT_ID` | OIDC client ID，建议 `triptrace` | - |
| `AMAP_API_KEY` | 高德地图 Web 服务 Key，用于搜索、路线等国内地图能力 | - |
| `AI_API_KEY` | AI 解析交通截图/文本使用的 API Key，只放后端 | - |
| `AI_BASE_URL` | OpenAI-compatible API 地址 | `https://api.openai.com/v1` |
| `AI_MODEL` | AI 解析使用的模型 | `gpt-4o-mini` |

## 地图和 AI 配置

地图和 AI key 不应该写在前端代码里。建议放在 `server/.env`：

```env
AMAP_API_KEY=你的高德Key
AI_API_KEY=你的AI API Key
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini
```

修改 `.env` 后需要重启后端服务。

## 数据与备份

- 数据库：`./data/travel.db`
- 上传文件：`./uploads/`
- 日志：`./data/logs/triptrace.log`
- 备份：通过管理后台创建和恢复

## 国内版范围

当前版本聚焦国内旅行规划、行程管理、高德地图和 AI 信息识别。旧版的世界旅行统计、
假期管理、旅行日志和外部 MCP 接入模块已从产品入口隐藏，新部署默认不启用。

## License

TripTrace is licensed under [AGPL v3](LICENSE). You may self-host it freely. If you modify it and provide it as a network service to others, your modifications must be made available under the same license.
