"""填充比赛作品报告模板"""
import glob, os
from docx import Document
from docx.shared import Pt, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from copy import deepcopy

# Find template
base = os.path.join(os.path.expanduser("~"), "Desktop")
template_path = None
for root, dirs, filenames in os.walk(base):
    for f in filenames:
        if "作品报告模板" in f and f.endswith(".docx"):
            template_path = os.path.join(root, f)
            break
    if template_path:
        break

if not template_path:
    print("Template not found!")
    exit(1)

doc = Document(template_path)

# ── Cover page info (first few paragraphs) ──
# Find and fill cover fields
for p in doc.paragraphs:
    if "作品名称" in p.text and "____________" in p.text:
        # Replace the placeholder
        for run in p.runs:
            if "作品名称" in run.text:
                run.text = "作品名称：校园智联——多智能体协同的智慧校园服务平台"
                break
    elif "参赛选手" in p.text:
        # Don't fill - rule says no personal info
        pass
    elif "指导教师" in p.text:
        pass

# ── Find the main content table ──
table = doc.tables[0] if doc.tables else None
if not table:
    print("No table found in template!")
    exit(1)

# Remove the instruction row (row 0 is likely header or instructions)
# Table rows: Row 0 = 作品概述(title+desc), Row 1 = 设计与实现, etc...

# Content mapping: row -> (section_title, content_md)
# We'll add content as new paragraphs inside each row's cell

sections = {
    0: ("一、作品概述", """本团队在参与学生部门工作中，亲历了三个具体痛点。

课表收集效率低下：部门需要汇总数十名成员来自不同年级、不同专业的课表以安排活动时间。传统做法是一个人一个人的收截图后人工对比统计，一轮下来至少半天。

比赛评分流程割裂：一场30个作品、20位评委、10个维度的比赛，从评分模板导入、选手名单录入、评委打分、去最高最低统计分到结果导出，各环节在纸质表格和Excel之间反复切换。

心理关怀被动缺失：课表里的压力信号（某天满课、考试连排）、比赛后的成绩焦虑，没有人去主动发现。学生必须自己走向心理服务，心理服务不会在数据里走向学生。

从第一个痛点出发做课表OCR，发现课表数据可以驱动更多——逐步生长出三条智能线：学习规划线（课表OCR→AI日程规划，识别课表后自动生成个性化周计划）、活动管理线（AI解析评分模板与选手名单→评委扫码打分→去最高最低统计分→导出报告）、心理关怀线（AI陪伴"小暖"→校园知识库44个公众号+11个官网栏目共565篇文章→混合检索+自然语言摘要）。

三条线共享用户数据层：课表数据同时驱动学习规划和压力感知，用户画像通过数据飞轮持续更新——每轮对话后AI自动提取用户关注点和情绪，下次对话自动带入上下文。

评分模块已在真实比赛中投入使用（20+评委、30+作品、10个评分维度）。智能体对话已部署在线服务，支持Dify/Flask双后端自动切换。"""),

    1: ("二、作品设计与实现", """系统采用前后端分离架构，前端React 19+TypeScript+Vite+Tailwind CSS 4，状态管理Zustand，动画motion；后端Express.js+TypeScript作为API网关；AI微服务Flask(Python)+Dify智能体编排；数据库MySQL 8.0；文件存储阿里云OSS。

Express API网关统一处理认证(JWT)、限流、路由分发。AI请求根据环境变量AI_COUNSEL_BACKEND自动路由到Dify或Flask。Flask模式：Express→Flask→DeepSeek V4，Flask内建本地知识库检索（滑动窗口中文关键词匹配+自然语言校区摘要）。Dify模式：Express→Dify→DeepSeek V4，Dify内配置知识库检索(bge-m3 Embedding)+Rerank(bge-reranker-v2-m3)+Tavily联网搜索+对话记忆(conversation_id)+用户画像注入。

日程规划：课表图片→Flask PyMuPDF OCR→LLM解析→个性化周计划JSON。心理陪伴：SSE流式输出，前端实时渲染Markdown。Dify工作流中配置知识库检索+Rerank精排，每个用户消息在到达LLM前经过知识库增强。

校园知识库双重覆盖：微信公众号44个账号432篇+学校官网4站点11栏目Python爬虫自动抓取168篇，总计565篇。6类分类：校园生活/教学教务/心理健康/就业资助/安全规范/综合活动。Dify端Embedding+Rerank混合检索，Flask端滑动窗口中文关键词匹配。

数据飞轮：对话后调DeepSeek提取用户关注话题、情绪倾向、潜在需求，存入localStorage画像。每3轮更新，下次对话自动注入System Prompt。对话增强功能包括AI自动标题、追问建议、打断对话。前后端双重危机关键词检测（自伤/自杀/暴力），命中弹出全国心理援助热线400-161-9995。"""),

    2: ("三、作品测试与分析", """评分模块在真实校园比赛中投入使用：20+评委、30+作品、10个评分维度、600+条评分数据，数据一致性100%。测试中发现"一键提交"在部分已提交+部分未提交混合状态下的边界bug，该问题单人测试无法触发，仅在真实多评委并发场景下暴露。

AI模块性能：课表OCR准确率课程名~92%，时间/地点~97%。日程规划耗时~34秒(Flask直连)/~90秒(Dify工作流)。心理陪伴SSE首字延迟<2秒。危机关键词检测率100%。校园知识问答准确率：知识库覆盖范围内>90%（图书馆/食堂/心理咨询/四六级/考试安排等常见问题均能正确回答）。

知识库：44个公众号+4个官方网站，11个官网栏目覆盖通知公告/学校要闻/综合新闻/教学/科研/学术/研究生/双百/本科教学/河源校区。总565篇（微信397+官网168）。时效性2024-2026年一手信息。更新方式：微信每日增量同步+官网爬虫按需抓取。

自动化测试：Vitest单元+集成测试559个全部通过。Playwright E2E测试16个布局健康检查用例。TypeScript strict:true，类型检查零错误。"""),

    3: ("四、创新性说明", """本作品由参赛团队独立设计、开发完成。前端React+TypeScript，后端Express.js+Flask，AI编排Dify+DeepSeek V4，Embedding模型bge-m3。所有代码团队原创，AI辅助编码工具用于加速开发，核心架构设计、业务逻辑和智能体编排策略由团队成员自主完成。

核心创新：
1. 从真实痛点生长，而非为了AI而AI。系统起点是"课表太难收"和"评分太乱"，AI是后来逐步引入的解法工具。评分环节不使用AI调整分数——规则本身透明，不需要黑箱。
2. 多智能体数据协同+数据飞轮。课表数据同时驱动日程规划和压力感知。对话后AI自动提取用户画像（关注话题/情绪/需求），存入画像系统，实现"越聊越懂你"的自我进化能力。
3. 校园知识库双重覆盖。微信公众号44个账号432篇+学校官网自动化爬虫4站点11栏目168篇，总计565篇。双后端检索策略（Dify Embedding+Rerank/Flask滑动窗口关键词匹配）。
4. 实赛验证，不是Demo。评分模块已跑过真实比赛。AI对话已部署在线服务。559个自动化测试全部通过。

合规性：符合国家人工智能、数据安全及网络安全相关法律法规。所用大模型API和Embedding模型为合规商用服务。知识库数据来源于学校公开发布信息。"""),

    4: ("五、总结", """本作品从校园真实痛点出发，逐步生长出覆盖学习规划、活动管理、心理关怀三条智能线的综合服务平台。通过AI与传统规则的合理分工、知识库检索与自然语言摘要的混合策略、数据飞轮驱动的用户画像进化、以及经过真实比赛验证的系统稳定性，实现了从需求识别到服务落地的完整闭环。系统全部功能支持浏览器访问，可在校园部门级推广使用。"""),

    5: ("六、参考文献", """[1] 教育部等九部门. 关于加快推进教育数字化的意见[Z]. 2025.
[2] Dify. Dify开源智能体开发平台文档[EB/OL]. https://docs.dify.ai.
[3] DeepSeek. DeepSeek API技术文档[EB/OL]. https://api-docs.deepseek.com.
[4] 硅基流动. SiliconFlow模型服务文档[EB/OL]. https://docs.siliconflow.cn.
[5] GB/T 7714-2015, 信息与文献 参考文献著录规则[S]."""),
}

# For each row in the table, clear existing content and add our text
for row_idx, (section_title, content) in sections.items():
    if row_idx >= len(table.rows):
        continue
    row = table.rows[row_idx]
    cell = row.cells[0]  # First (and only) cell

    # Remove existing content paragraphs (keep first paragraph as title)
    existing_paras = cell.paragraphs
    # Clear all paragraphs
    for p in existing_paras:
        p.text = ""

    # Set title
    existing_paras[0].text = section_title
    for run in existing_paras[0].runs:
        run.font.size = Pt(14)
        run.font.bold = True

    # Add content paragraphs
    for line in content.split("\n"):
        line = line.strip()
        if not line:
            continue
        p = cell.add_paragraph(line)
        p.style = cell.paragraphs[0].style
        for run in p.runs:
            run.font.size = Pt(11)
        # Set first line indent for body text
        p.paragraph_format.first_line_indent = Pt(22)

# ── Save ──
output = os.path.join(os.path.expanduser("~"), "Desktop", "校园智联_作品报告.docx")
doc.save(output)
print(f"Saved: {output}")
