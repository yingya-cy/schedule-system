# 学术空间 (Academic Ether)

课表管理、比赛评分、文件中心一站式学术管理平台。

## 技术栈

React 19 + TypeScript + Tailwind CSS 4 / Express + MySQL 8.0 / Flask + PyMuPDF AI OCR

## 快速开始

```bash
npm install
cp .env.example .env   # 编辑数据库密码等
npm run dev            # Express :3001 + Flask :5002
```

## 命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 全栈启动 |
| `npm run build` | 前端生产构建 |
| `npm test` | Vitest 单元/集成 |
| `npx playwright test` | E2E（需 dev server 启动） |

## 部署

```bash
docker-compose up -d --build
```

详见 [CLAUDE.md](./CLAUDE.md)。
