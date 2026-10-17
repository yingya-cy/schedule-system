# HANDOFF — 课表系统（sc-sys）2026-10-13

> 交接对象：Codex / 下一个接手的 agent
> 生成时间：2026-10-13 14:30 (UTC+8)
> 交接人：Hermes Agent

---

## 1. 目标与当前状态

**项目**：校园智联 课表管理系统（sc-sys）
**本轮目标**：把「第十四届白云校区」23 人课表导入生产库，并修正解析器的周次解析缺陷

**状态：基本完成，剩余 2 项待办（见 §6）**

| 项 | 状态 |
|---|---|
| 23 人课表入库（网编部 13 + 秘书部 10） | ✅ 完成 |
| 校区-届次联动（选白云→自动切白云第十四届第一学期） | ✅ 完成并上线 |
| 周次解析修复（"第N周"/单双周/斜杠） | ✅ 完成并部署 |
| 前端 `[1..18]` 兜底移除 | ✅ 完成并部署 |
| AI 读图切 DeepSeek（原豆包 key 过期） | ✅ 完成并生效 |
| 陈柳余 5 条错误周次修正 | ✅ 完成（22 条对齐 PDF） |
| **重新导入验证（解析器修复的端到端验证）** | ⬜ **待办** |
| **欧焙铃 / 李俊锋 数据核对** | ⬜ **待办** |

---

## 2. 关键路径与访问

### 服务器
```
主机：129.204.50.194（ubuntu，免密 SSH）
项目：/home/ubuntu/workspace/schedule-system   ← 【唯一有效副本】
旧副本：/home/ubuntu/schedule-system            ← 已废弃，勿改（ai-service 曾从它启动）
```

**⚠️ 判断哪份代码在用**：
```bash
sudo docker inspect <容器> --format '{{index .Config.Labels "com.docker.compose.project.working_dir"}}'
```

### Git
```
远程：git@github.com:yingya-cy/schedule-system.git（服务器走 SSH key）
HEAD：6146373  =  origin/main（完全同步）
SSH：GIT_SSH_COMMAND="ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes"
```

### 站点
```
主站：https://yingyacy.top/          课表中心：/files
管理入口：/files?staff=1
```

### Docker（4 个容器）
```
schedule-nginx       80/443（配置挂载自 workspace/nginx/）
schedule-backend     3000（代码打进镜像，改后端须 --build）
schedule-ai-service  5002（Flask，代码打进镜像）
schedule-mysql       宿主 3307
```

**⚠️ 改后端/ai-service 代码后**：
- 后端：`docker compose up -d --build backend`（约 3-5 分钟）
- ai-service：若构建失败（apt 源问题，已修 Dockerfile），可 `docker cp` 进容器 + `docker restart`

---

## 3. 本轮改动（已提交，commit 6146373）

```
utils/rule_parser.py          parse_weeks: 支持"第N周"/单双周/斜杠分隔
utils/cleaner.py              convert_week_to_list: 同上
utils/pdf_plumber_parser.py   _extract_weeks_text: 跨行截断修复
src/components/views/FilesView/utils.ts               去 [1..18] 兜底
src/components/views/FilesView/ScheduleUploadView.tsx 同上
src/components/views/FilesView/index.tsx              改用 store 的 campus
src/routes/terms.ts           GET /api/terms 支持 ?campus=
src/stores/appStore.ts        切校区自动切换届次
src/repositories/scheduleRepository.ts  超长字段截断防护
docker/ai-service.Dockerfile  兼容 Debian 12 apt 源
nginx/nginx.conf              /pdfjs/ 路由
```

### 未提交（有意排除）
```
.env.bak-20261013-091601       AI 配置备份
.env.bak-embed-20261013-091947 EMBEDDING 停用备份
nginx/quiz-api.conf            新配置，未启用
```

---

## 4. 解析器架构（重要背景）

### 三个解析路径
```
① 竖型（星期=行，y坐标不同）→ parse_vertical_pdf_with_plumber()
   格式：何定霓、何小杏等 21 人（教务系统"竖版"导出）

② 横型（星期=列，y坐标相同）→ parse_by_rules()  [后端 /api/ocr/horizontal_rules]
   格式：陈柳余、邓煌柏（WPS 表格导出）
   前端流程：extractRawTextForDetection() → POST 文本 → 后端解析
   失败才 fallback 到 /api/ocr/pdf（AI）

③ AI 图片识别 → /api/ocr/image 或 /api/ocr/pdf 兜底
   用于：李俊锋（纯图片 PDF）、欧焙铃（Type3 矢量字）
   模型：**DeepSeek deepseek-chat**（2026-10-13 从豆包切换）
```

### 前端类型判断
```typescript
// src/services/fileProcessor.ts:detectPdfType()
const tightDaysPattern = /星期一\s*星期二\s*星期三\s*星期四\s*星期五/i;
if (tightDaysPattern.test(text) || text.includes('时间段 节次')) return 'vertical';
return 'horizontal';
```

### 本轮修的核心 bug
```
【bug 1】rule_parser.parse_weeks / cleaner.convert_week_to_list
  · re.match(r'(\d+)周') 匹配不了 "第8周"（"第"卡在开头）→ 返回 []
  · "7-13周(单)" 的单双周标记未处理
  · 斜杠分隔 "1-2周/3周/5-6周" 只取第一段

【bug 2】前端兜底（根因，导致假数据入库）
  src/components/views/FilesView/utils.ts:52,80
  src/components/views/FilesView/ScheduleUploadView.tsx:239,250
  · if (!weeksStr) return Array.from({length:18},(_,i)=>i+1)
  · 解析失败被伪装成"全学期"，写入 [1..18] 假数据
  · 已改为 return []
```

---

## 5. 数据状态

```
白云第十四届第一学期（term_id=2）
  网编部 13 人 / 325 条
  秘书部 10 人 / 281 条
  合计 23 人 / 606 条

河源第七届第一学期（term_id=3）—— 空，待导入
```

### 已知特殊情况
| 人 | 情况 | 处理 |
|---|---|---|
| **陈柳余** | 横版；5 条周次曾错（[1..18]） | ✅ 已修正为 [8]、[7,9,11,13]、[1,2]、[3]、[9]，共 22 条对齐 PDF |
| **邓煌柏** | 横版；PDF 提不出（WPS 格式特殊） | ✅ 手工解析入库 18 条 |
| **李俊锋** | 纯图片 PDF（无字体，DCTDecode 图片） | ⬜ 走 AI 识别，数据未核 |
| **欧焙铃** | Type3 矢量字（有文字但逐字符拆碎） | ⬜ 用户称已重新导出正确 PDF，待重导 |

### 备份位置
```
/home/ubuntu/backup/
├── chenliuyu-before-20261013-101245.sql    陈柳余改前
├── commit-20261013-141630/                  提交前 11 文件快照
├── clear-kebiao-20261013-090651/            清空前全量
└── term-refactor-*/                         届次重构前
```

---

## 6. 待办（按优先级）

### ⬜ 待办 1：重新导入验证解析器修复
**为什么**：本轮改了 `rule_parser.py`/`cleaner.py`，但**没有端到端重导验证**（只改了 DB 数据 + 代码）。

**怎么做**：
```
1. 网页上传一份"横版 + 含第N周/单双周"的 PDF（如陈柳余）
2. 检查识别结果：周次是否正确（"第8周"→[8]、"7-13周(单)"→[7,9,11,13]）
3. 如果正确 → 修复确认有效；如果仍错 → 解析器还有遗漏
```

### ⬜ 待办 2：欧焙铃 / 李俊锋数据核对
```
· 欧焙铃：用户已重导 PDF（18 门）→ 核对周次/星期是否对
· 李俊锋：DB 有 31 条（AI 识别来源）→ 需对照图片核对
```

### ⬜ 待办 3：河源第七届第一学期课表
```
届次已建好（term_id=3），数据为空，待导入
```

### ⬜ 待办 4（可选）：前端 AI 识别准确性
```
DeepSeek 读图有系统性误差（实测："成考"被认成"成才"）
→ 若李俊锋/欧焙铃数据要精确，建议人工核对或让对方重导 PDF
```

---

## 7. 关键坑（血泪）

```
① 两个项目副本：改代码前先 docker inspect 看 working_dir 标签
② 单文件 bind mount：改 nginx.conf 后必须 docker restart（reload 无效）
③ 改 nginx.conf 前先 grep 查是否有同名 location（曾因重复 location 挂站）
④ 后端/ai-service 代码打进镜像：改了要 --build 或 docker cp + restart
⑤ .env 改了要 docker compose up -d（重建容器才读新 env）
⑥ merge 会覆盖未提交的部署配置（nginx.conf / docker-compose.yml）
   → 容器里可能还有正确版本，可用 docker exec cat 捞出
⑦ 前端"兜底逻辑"会掩盖解析失败（本轮修的 [1..18] 就是）
⑧ AI 识别的"成功"不等于"准确"（会幻觉出 [1..18] 这类全周次）
```

---

## 8. 记忆与文档位置

```
【正式记忆库 · Codex 读的】
C:\Users\MR\.claude\projects\C--Users-MR\memory\
├── MEMORY.md                 索引
├── permanent-lessons.md      ← 2026-10-13 数据校对能力边界（本轮教训）
├── tech-experience.md        技术踩坑
├── projects-overview.md      项目资产
└── server-infrastructure.md  服务器详情

【Hermes 记忆（Codex 读不到）】
D:\hermes\memories\MEMORY.md

【项目文档】
/home/ubuntu/workspace/schedule-system/CLAUDE.md
```

---

## 9. 建议 Codex 先做的事

```bash
# 1. 确认代码状态
ssh ubuntu@129.204.50.194
cd /home/ubuntu/workspace/schedule-system
git log --oneline -3          # 应看到 6146373
git status --short            # 应只有 .bak 和 quiz-api.conf

# 2. 确认服务
sudo docker ps | grep schedule

# 3. 然后处理 §6 的待办 1（重新导入验证）
```

**⚠️ 注意**：本轮所有改动**都在 6146373 提交里**，不要重复实现。
