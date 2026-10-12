# 校园智联 Campus Connect

多智能体协同的智慧校园服务平台。从课业管理、事务协同到心理陪伴，一条 AI 驱动的产品线。

**线上地址：http://<server-ip>**（阿里云 ECS，Docker 部署）

---

## 项目概况

### 解决什么问题

高校学生部门日常两件事：排班和办比赛。几十人的课表靠截图发群，人工找空闲起码半天。比赛评分从录入到统分，纸质 Excel 来回折腾一整天。学生遇到校园问题（图书馆几点开、怎么转专业）要翻几十个公众号，心理服务完全被动。

这个系统把这三件事串起来，用一条数据链跑通。

### 三条智能线

```
排班需求 → 课表 OCR → 空闲统计 → 反课表导出
                    ↓
              个体差异 → AI 周计划定制
                    ↓
              心理压力 → AI 心理陪伴"小暖" + 723 篇校园知识库
```

三条线是自然生长的：帮部门排班→课表数据催生个体规划→规划中遇到心理问题→催生 AI 陪伴。一个真实需求引出下一个。

### 跑过的真实场景

- **评分模块**：20+ 评委、30+ 作品、600+ 条评分记录的真实比赛，零数据错误
- **课表 OCR**：50 张不同来源课表测试，课程名准确率 ~92%，星期/周次 ~97%
- **AI 日程规划**：基于课表 JSON + 年级专业 + 目标，自动生成个性化周计划

---

## 技术架构

| 层 | 技术 | 说明 |
|---|------|------|
| 前端 | React 19 + TypeScript + Tailwind CSS 4 + Zustand + motion | SPA，Vite 构建 |
| 网关 | Express.js (Node.js) | JWT 认证、限流、路由分发 |
| AI 服务 | DeepSeek V4 + Flask + Dify 双模式 | 环境变量一键切换 |
| 数据库 | MySQL 8.0 | 连接池 20 |
| 存储 | 阿里云 OSS | 预签名 URL 直传 |
| 部署 | Docker Compose + Nginx | 阿里云 ECS 2核3.5G |

### AI 管线（自建，零外部编排平台）

```
用户消息
  ↓
bge-m3 Embedding 向量检索（召回 top 20）
  ↓
bge-reranker-v2-m3 Rerank 精排（保留 top 3）
  ↓
Tavily 联网搜索（补充实时信息）
  ↓
DeepSeek V4 SSE 流式输出
```

- **知识库**：44 个公众号 + 11 个官网栏目 + 结构化数据，共 723 篇，6 分类
- **数据飞轮**：每轮对话后自动提取用户画像（情绪倾向/关注话题/活跃时段），越聊越懂用户
- **检索质量**：Rerank 后 top 3 准确率 >90%

---

## 代码规模

| 维度 | 数量 |
|------|------|
| 总代码行 | ~40,000 行 |
| TypeScript/React | 33,957 行 |
| Python (Flask + 工具) | 4,850 行 |
| 自动化测试 | 559 单元 + 16 E2E |
| 知识库文章 | 723 篇 |

---

## 快速开始

```bash
npm install
cp .env.example .env   # 配置数据库、AI API Key
npm run dev            # Express :3001 + Flask :5002
```

浏览器打开 `http://localhost:3001`

## 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 全栈开发启动 |
| `npm run build` | 前端生产构建 |
| `npm test` | 559 个 Vitest 用例 |
| `npx playwright test` | 16 个 E2E 浏览器测试 |
| `npm run lint` | tsc --noEmit 类型检查 |

## Docker 部署

```bash
docker compose up -d --build
```

四个容器：Nginx 反向代理、Express API 网关、Flask AI 服务、MySQL 数据库。

---

## 项目结构

```
src/
├── components/      # React 组件（ai-counsel, schedule, scoring, file-center）
├── routes/          # Express 路由（auth, ai-counsel, ai-schedule, scoring, file-center）
├── services/        # 业务逻辑层（AI, OSS, 课表解析）
├── stores/          # Zustand 状态管理
├── middleware/       # JWT 认证、限流
└── utils/           # 工具函数
prompts/             # AI Prompt 模板 + 学校信息
scripts/             # 知识库爬虫、同步、重建
tests/               # 559 个 Vitest + 16 个 Playwright E2E
```

完整架构说明见 [CLAUDE.md](./CLAUDE.md)。
