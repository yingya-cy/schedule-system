# 21 天感恩成长记 · 打卡服务（后端）

> 本目录是服务器 `/home/ubuntu/gratitude` 的**源码快照**，用于版本管理与回滚。
> 真正运行的是服务器上的那份；改完代码请回来同步一次（见文末）。

## 组成

| 文件 | 作用 |
|---|---|
| `src/server.js` | 主服务：参与者登录/打卡/上传/管理端接口/榜单导出 |
| `src/judge.mjs` | 评委端接口 + 分片 + 排名 + 综测名单 + 明细导出（`registerJudgeRoutes(app, ctx)`） |
| `src/db.js` | mysql2 连接池 |
| `src/admin-worklist.mjs` | 管理端待办统计 |
| `package.json` | 依赖：express / mysql2 / multer / exceljs / xlsx / archiver / cors / dotenv |

前端不在这里，在仓库的 `public/gratitude/`（构建后同步到 `dist/gratitude/`，由 nginx 提供）。

## 运行

```bash
cd /home/ubuntu/gratitude
set -a && . ./.env && set +a          # 必须先加载自己的 .env
pm2 restart gratitude --update-env
```

> 坑：如果在别的目录 source 了课表系统的 `.env` 再重启，会把
> `DB_HOST/DB_PORT/DB_NAME` 覆盖成课表库，服务会连 `127.0.0.1:3306` 失败（ECONNREFUSED）。

## 依赖与端口

- 端口 `5004`（`PORT`），nginx 反代：`/api/gratitude/` → `127.0.0.1:5004`，`/gratitude/` 提供静态页
- 数据库：MySQL 8（容器 `schedule-mysql`，宿主 3307），库名 `gratitude`
- 表：`gratitude_config` / `gratitude_participants` / `gratitude_days` / `gratitude_uploads` /
  `gratitude_scores` / `gratitude_judges` / `gratitude_slices`
- 上传目录：`uploads/<participant_id>/<day_no>/`，nginx 通过 `/api/gratitude/img/<file_path>` 读取
- 每天 03:00 备份到 `/home/ubuntu/backup/gratitude/daily/`（脚本在服务器 crontab）

## 主要接口

参与者：`POST /api/login`、`GET /api/days/:pid`、`GET /api/day/:pid/:dayno`、`POST /api/day`、`POST /api/upload`
管理端：`/api/admin/{login,list,detail/:pid,score,scores,scores/export,ranking,ranking/export,scores-detail/export,slices,slices/generate,judge-progress,cert-list,export,export-zip,roster,import,import-preview,config}`
评委端：`/api/judge/{login,logout,me,list,detail/:pid,score}`

## 同步流程

服务器上改完代码后，回到仓库执行：

```bash
cd /home/ubuntu/workspace/schedule-system
for f in server.js judge.mjs db.js admin-worklist.mjs; do
  cp /home/ubuntu/gratitude/src/$f gratitude-service/src/$f
done
cp /home/ubuntu/gratitude/package.json gratitude-service/package.json
git add gratitude-service && git commit -m "chore(打卡服务): 同步后端源码"
```
""

## 定时任务（服务器 crontab）

```
# AI 每日批处理：23:30 处理当天，00:20 补前一天漏掉的
30 23 * * * cd /home/ubuntu/gratitude && set -a && . ./.env && set +a && /usr/bin/node src/ai-digest.mjs >> /tmp/ai-digest.log 2>&1
20 0  * * * cd /home/ubuntu/gratitude && set -a && . ./.env && set +a && /usr/bin/node src/ai-digest.mjs $(date -d yesterday +\%F) >> /tmp/ai-digest.log 2>&1
```

`ai-digest.mjs` 会：补当天缺的评语/提醒（差劲→提醒，普通/优秀→评语）、从优秀记录挑 2-4 条生成匿名分享文案；已存在的同 kind 记录会跳过，重复跑无副作用。
