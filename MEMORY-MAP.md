# 记忆库总索引 — 给 Codex 的衔接入口

> 生成：2026-10-13 by Hermes Agent
> 用途：让 Codex（或任何 agent）一眼看清「所有项目记忆在哪、各是什么、从哪读起」

---

## 一、记忆库地图（共 11 个项目库 + 2 个全局）

Claude 按 **cwd 自动隔离** — 在哪个目录工作就读哪个库。以下是全部库：

### ⭐ 主库（跨项目，最重要）
```
C:\Users\MR\.claude\projects\C--Users-MR\memory\
├── MEMORY.md                索引
├── about-me.md              用户身份/能力/性格/偏好/就业/恋爱状态
├── active-tasks.md          进行中的任务（9 个：sc-sys、客户三服务、朋辈 MBTI、21天打卡、能源管理、Go 代理、问卷、cc-connect、情感）
├── projects-overview.md     服务器、域名、路径、技术栈、工具、报告生成体系
├── server-infrastructure.md 现役 129.204.50.194（+旧机存档）：连接、Docker、nginx、PM2、在线站点
├── permanent-lessons.md     编码硬规则、工作方法、部署铁律、定价原则、情绪处理、数据校对能力边界
├── tech-experience.md       技术踩坑（python-docx / AI 生成 / Docker / nginx / 中文路径 / 论文智能体）
└── archive-completed.md     已完成事项时间线
```
**→ 读这个库就能掌握全局。其他库是补充细节。**

### 项目库（按 cwd 隔离）

| 库目录 | 内容 | 关键文件 |
|---|---|---|
| `c--Users-MR-Desktop-sc-sys` | **sc-sys 课表系统**（最主要的生产项目） | MEMORY.md（20+ 条索引）、feedback/session-lessons-*.md（5 篇会话经验）、feedback/anti-schedule-format-rules.md（反课表格式规则）、project/project-status.md、project/scoring-history.md |
| `C--Users-MR-cc-connect-tool` | cc-connect 工具 + **求职目标/公司清单**（汇丰/Shopee/银行系详解） | MEMORY.md（含大量招聘信息）、心理预约系统规划 |
| `C--Users-MR-Desktop-hakka-asr` | 客家话 ASR 项目 | project_hakka_asr.md（SenseVoiceSmall 微调）、user_cy.md |
| `C--Users-MR-Desktop-hakka-asr-app` | 同上（App 侧） | app_flutter.md（Flutter 开发状态） |
| `C--Users-MR-Desktop----nosql` | NoSQL 课程作业 | check-before-act.md、distinguish-assignments.md、pdf-fallback.md |
| `C--Users-MR-Desktop------------1` | 二手车价格预测（数据挖掘实训） | project-overview.md、data-dictionary.md、external-report-rebuild.md |
| `C--Users-MR-Desktop------` | 中文编码/Word 文档规范 | feedback_chinese-encoding.md、feedback_docx-workflow.md |
| `C--Users-MR-Desktop------1` | 俄罗斯方块课程作业 | project-overview.md |
| `C--Users-MR-Desktop-------------` | StatusLine 中文路径修复 | statusline-chinese-path-fix.md |
| `C--Users-MR-Desktop-作业-数学挖掘-实训` | 数学挖掘实训作业 | （2 个 md） |

### 全局记忆（跨项目）
```
C:\Users\MR\.claude\memory\
├── MEMORY.md
├── report-generation-system.md      报告生成体系（已并入主库 projects-overview）
└── statusline-chinese-path-fix.md
```

---

## 二、用户核心画像（速览）

```
陈辕，广师大 24 大数据1班，数据科学大三（2028届），**不写代码全靠 AI Agent**
潮汕人，偏好广东省内就业（广深优先），不卷算法/LeetCode

【沟通偏好】
· 不熟领域要求"从零大白话+生活比喻"
· 中文批注口语化，忌 AI 腔
· 交付物只给题目要求的，砍加分项
· 厌恶 AI 推算/编数据（日期/时间线/他人动机/文献引用一律不许推算）
· 要文件必须说明完整路径
· 会质疑结果真实性 → 须区分原始 vs 处理结果

【工作方式要求】
· 要自己干完、自己发现问题、非每步回来问（原话"你一直停下来干嘛"）
· 报"校验完成"必须逐个核过，禁用脚本跑通/单样本冒充全量
· 他说"XX呢/XX不正常"= 在替你查漏 → 立刻排查同类
· 他指方向时必须当场照做，别读完又绕回

【审美】
· 保图型只升质感（深蓝 #2E5C8A + 陶土橙 #C97B54）
· 网页/App UI 不用 emoji（改内联线性 SVG）
· 参与者端忌产品风（中性灰细边框），要学生向

【当前状态（2026-10-13）】
· 求职：2028届，先随便找一份实习即可；暑期实习 2027.2 底开
· 感情：与"小末"关系退回朋友（她称疲惫/不想被绑定未来）
```

---

## 三、生产环境速查

```
【服务器】129.204.50.194（ubuntu，免密 SSH）
· sc-sys 课表：https://yingyacy.top/   项目 /home/ubuntu/workspace/schedule-system
· 感恩打卡：https://yingyacy.top/gratitude/   pm2 gratitude:5004
· 其他站点：insurance(5001) / internship(5003) / survey(3099) / ai-agents(3100)

【旧服务器】47.120.29.188 —— 已停（存档在 server-infrastructure.md）

【域名】yingyacy.top（DNS→129.204.50.194）；ai.yingyacy.top；www 未解析
【备案】粤ICP备2026152719号（挂 7 页面）
```

---

## 四、进行中的项目（active-tasks.md 详）

```
1. **sc-sys 学术空间（课表系统）** ⭐ 最主要
   2026-10-13 最新：23 人课表入库 + 周次解析修复（commit 6146373）
   待办：重导验证 / 欧焙铃李俊锋核对 / 河源第七届导入

2. 客户三服务：论文智能体 / 实习手册 / 保险单
3. 朋辈 MBTI 测试 + 招新页
4. 21 天感恩打卡（已上线）
5. 能源管理
6. Go 代理
7. 舆情问卷（109 份数据）
8. cc-connect 工具
9. 情感状态
```

---

## 五、报告生成体系（跨项目工具）

```
位置：C:\Users\MR\.Codex\tools\report\   （原 ~/.claude/tools/report/）
· report_template.py        通用报告构建（ASCII-only，中文走 JSON 或 text_file）
· report_config_schema.json 配置 schema + 示例
· extract_template.py       从 docx 提取文字/表格/图片
· 封面模板_通用.docx         通用封面

命令：/build-report、/fix-report-format
关键坑：
· 不要用原始作业模板 docx 做封面（含作业说明文字）
· keep_with_next=True 可能致末页孤行
· 生成中文文档可靠路径：python3 -c 短命令 > 写 .txt > extract_template.py
```

---

## 六、给 Codex 的读法建议

```
【接手 sc-sys 相关工作】
  ① 读 c--Users-MR-Desktop-sc-sys/memory/MEMORY.md（索引）
  ② 读最新会话经验 feedback/session-lessons-20261013.md（本轮）
  ③ 需要时读 feedback/anti-schedule-format-rules.md（格式规则）

【接手任意新任务前】
  ① 读主库 C--Users-MR/memory/MEMORY.md（全局）
  ② 读 permanent-lessons.md（别再踩已知的坑）
  ③ 读 projects-overview.md + server-infrastructure.md（环境）

【用户偏好相关】
  → C--Users-MR/memory/about-me.md
```

**⚠️ 一条硬规则（本轮教训）**：
> **动手前先查记忆库。** 本轮我在 sc-sys 折腾了半天周次格式，事后才发现
> `feedback/anti-schedule-format-rules.md` 里早有格式文档。

---

## 七、记忆维护规则（各库通用）

```
① 按日期倒序：最新条目放最顶部
② 按内容分类，不按文件堆砌（优先融入现有文件）
③ 禁止新建会话总结文件（*_session_summary.md）
④ 每次保存后更新 MEMORY.md 索引
⑤ 文件名带日期（含 frontmatter：name/description/type/originSessionId）
```
