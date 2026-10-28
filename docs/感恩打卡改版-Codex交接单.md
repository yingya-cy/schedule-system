# 感恩打卡改版 · Codex 交接单

> 目标：把「微光拾暖，'艺'绘感恩」21 天感恩打卡页**剩下的 7 个屏**从旧样式改成已完成的手绘风。
> 功能一个都不能少。改完由陈辕统一上线，Codex 只改本地文件。

## 0. 一句话背景

感恩打卡是一个单文件前端（HTML + 内联 CSS/JS，无框架、无外部 CDN）。目前登录页和「我的微光手账」已经改成手绘风，其余屏还是旧皮肤，需要按同一套设计语言统一。

## 1. 权威代码在哪

- **权威副本只有一份**：服务器 `129.204.50.194:/home/ubuntu/workspace/schedule-system`，当前 HEAD `b7ab559`，工作区干净。
- 本地 `C:\Users\MR\Desktop\sc sys` **目前落后 6 个提交**（HEAD `8a0013a`，`index.html` 是旧版，`assets/` 还是 14.29 MB 的 PNG）→ **必须先按 §7 对齐，再动手**，否则改的是旧版，白干。
- 前端单文件：`public/gratitude/index.html`（约 333 KB，`<style>` 块 39.5 KB，`<script>` 内联）。

## 2. 部署链（先理解，再动手）

- nginx 实际服务的是 **`dist/gratitude/index.html`**（bind mount 进容器 `/usr/share/nginx/html`），**不是** `public/`。
- `dist/` 被 `.gitignore` 忽略 → **只提交 `public/`**；改完必须把 `public/gratitude/index.html` 同步到 `dist/gratitude/index.html`，否则线上看不到改动。
- 只改前端不需要重启服务；只有改后端 `src/server.js` 才需要 `pm2 restart gratitude`（端口 5004）。
- 线上地址：`https://yingyacy.top/gratitude/`；管理端是同一页面加 `?staff=1`。

## 3. 进度：2 个屏已完成，7 个待改

**已完成（改的时候照抄它们的写法）**

- `s-login` 登录页 —— 艺术标题 `theme-title-art` + 大树插画 + 纸质感表单
- `s-days` 我的微光手账 —— 水彩分割带 `journal-wash-divider` + 21 片感恩树叶格子 + 进度条 + 打卡成功动效

**待改（建议按这个顺序做，从简单到复杂）**

| 屏 id | 静态骨架 | 是什么 |
|---|---|---|
| `s-fill` | 331 B | 每日打卡表单：拍照上传 1–3 张；第 21 天额外有「上传视频」「上传录音」两个入口 |
| `s-detail` | 568 B | 单人 21 天详情列表（Day1…Day21 + 是否打卡 + 打卡时间） |
| `s-adminlogin` | 695 B | 管理登录（账号 / 密码 / 登录按钮） |
| `s-admin` | 2.6 KB | 打卡进度总表：工具栏（导出 Excel、导出打包 ZIP、刷新、测试模式、评委打分、评分结果、名单管理、退出管理）+ 筛选行 + 按人卡片网格 + 分页 |
| `s-judge` | 883 B | 评委入口（待评队列） |
| `s-scores` | 1.0 KB | 评分结果列表 |
| `s-score` | 120 KB | 评委打分表单（内含 base64 缩略图，注意别把页面体积再拉大） |

## 4. 设计语言：复用现成的，别另造一套

**颜色变量（`:root` 已定义）**

```
--green #497363    --night-green    --ink #243c35     --paper #fbfcf8
--mint #e0ece1     --yellow #f4e6a5 --accent #c97b54  --soft-coral
--blue #2e5c8a     --line #d8e2d8
```

**现成类名（直接套）**

`.screen` `.body` `.btn.pri` `.btn.acc` `.btn.ghost` `.cell` `.cell.today` `.cell.done` `.bar` `.progwrap` `.progrow` `.field` `.upload` `.thumbs` `.thumb` `.owner-mark` `.staff-tools` `.staff-filters` `.toast` `.modal-mask` `.modal-card` `.modal-body` `.record-summary` `.participant-*` `.roster-*` `.score-*` `.judge-*` `.viewer-*`

**插图资产（`public/gratitude/assets/*.webp`，12 个共 508 KB）**

`gratitude-title-art` `gratitude-tree-hero` `gratitude-journal-canopy` `gratitude-journal-wash` `gratitude-sapling-progress` `gratitude-leaf-sticker[-oak|-linden|-birch|-ginkgo|-red|-olive]`

**版式**：手机优先，基准视口 **390×844**；管理端宽屏走 `body.mat-wide`（容器 max-width 1680px，卡片 `minmax(340px,1fr)` 自动四列）。

## 5. 红线（碰了会出事）

1. **不改后端接口契约**：`POST /api/day` 只接收 `{participant_id, day_no, action_images}`（文字项已删除）；第 21 天的视频 / 录音走 `POST /api/upload` 的 `kind=video|audio`。
2. **不动打卡动效的四段时序和函数**：`savedFeedback()` → `flyLeafToTree()`（1.7s）→ 树脉动（620ms）→ `animateProgress()`，另有 `settleFeedback()` 在切后台时立刻落终态。这是刚调好的，不要重写。
3. **不引入任何外部依赖 / CDN / 网络字体**；所有样式内联在这一个文件里。
4. **不改数据库 schema**；`gratitude_uploads.kind` 是 `ENUM('action','other','image','video','audio')`。
5. **新增图片必须转 WebP、单张 ≤ 120 KB、页面总图 ≤ 800 KB**（现在 508 KB）。原来的 15 MB PNG 已淘汰，别再用。
6. **保留全部管理端功能和 `?staff=1` 入口**。
7. `test_mode` 现在是 `1`（为测试放开全部日期），**不要动**，上线前由陈辕关闭。

## 6. 每屏验收清单

- [ ] 提取 `<script>` 存成独立文件，`node --check` 通过
- [ ] 浏览器打开无 `console.error` / `pageerror`
- [ ] 390×844 截图：无横向滚动、无文字溢出、无遮挡
- [ ] 该屏所有按钮手点一遍，都有正常反应
- [ ] `public/` 与 `dist/` 两份内容一致（md5 相同）

## 7. 交接前必须先对齐本地（现在落后 6 个提交）

```powershell
cd "C:\Users\MR\Desktop\sc sys"

# 1) 先备份本地未提交的改版文件（14.29MB PNG + 旧 index.html）
$ts = Get-Date -Format yyyyMMdd-HHmmss
$bk = "C:\Users\MR\Desktop\_scsys-gratitude-backup-$ts"
New-Item -ItemType Directory -Force -Path $bk, "$bk\assets" | Out-Null
Copy-Item "public\gratitude\index.html" $bk
Copy-Item "public\gratitude\assets\*" "$bk\assets" -Recurse

# 2) 丢弃本地旧版，拉服务器最新（服务器含 WebP 压缩 + 4 个动效提交）
git checkout -- public/gratitude/index.html
git clean -fd public/gratitude/assets
git fetch --no-tags ssh://ubuntu@129.204.50.194/home/ubuntu/workspace/schedule-system main
git merge --ff-only FETCH_HEAD
git log --oneline -3        # 应为 b7ab559
```

对齐后 `public/gratitude/index.html` 的 md5 应为 `862f05dd4905d3a8c999a9564e6d0975`。

## 8. 分工

- **Codex**：只改本地 `C:\Users\MR\Desktop\sc sys`，一屏一个 commit（前缀 `style(感恩打卡): `）。**不要 push、不要碰服务器、不要动 `dist/`。**
- **陈辕**：收到改动后统一同步 `dist/`、push 到 GitHub 与服务器、跑全量截图验收。

## 9. 测试数据

- 学生端：学号 `123` / 姓名 `123`
- 管理端：`pengbei` / `525`
- 库内：11 人、128 条打卡、156 条素材（图 153 / 音频 3）
