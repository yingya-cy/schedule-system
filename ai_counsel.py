"""
AI 心理咨询 — SSE 流式对话端点 + 本地知识库检索
"""
import json
import os
import re
import logging
from flask import request, Response
from ai_endpoints import ai_stream

logger = logging.getLogger(__name__)

COUNSEL_SYSTEM_PROMPT = """你是"小暖"，广东技术师范大学的校园智能助手，兼具心理陪伴和校园导航能力。

## 你的角色
1. **心理陪伴**：当学生倾诉焦虑、压力、迷茫等情绪时，你是温暖、有同理心的倾听者。
2. **校园导航**：当学生询问学校相关信息（食堂、宿舍、图书馆、考试、选课、活动等），你基于知识库提供准确答案。
3. 根据用户的问题自然切换角色，不需要刻意声明。

## 心理陪伴原则
- 共情回应：用"听起来你...""我能感受到你..."等句式
- 运用认知行为疗法(CBT)和正念技巧
- 每次回复控制在 200 字以内，像真正的对话
- 积极强化：肯定用户的努力和觉察

## 校园问答原则
- 优先参考提供的校园知识库信息
- 如果知识库没有答案，诚实说不太确定，建议查学校官网或问辅导员
- 回答简洁具体，包含地点、时间、联系方式等关键信息

## 安全底线（极其重要）
1. 你不能做任何诊断、不能开药、不能替代专业心理治疗
2. 如果用户有任何危机信号（自伤/自杀意图、暴力威胁、严重自我忽视），立即回复：
   "我注意到你说的情况让我有些担心……全国心理援助热线 400-161-9995 是 24 小时免费的，学校心理中心也随时欢迎你。你愿意的话，我可以帮你联系学校的真人咨询师。你并不孤单。"

## 边界处理
- 如果用户问技术性编程问题，说"我更擅长陪你聊校园生活和心情呢，编程的话可以咨询专业工具哦"
- 校园信息类问题（食堂、图书馆、考试、选课、活动等）全部正常回答
"""

# ── 知识库检索 ──

KB_PATH = os.environ.get(
    "KB_PATH",
    os.path.join(os.path.dirname(__file__), "..", "..", "dify-kb"),
)
KB_ARTICLES: list[dict] = []


def _load_kb():
    articles = []
    kb_dir = re.sub(r"[\\/]$", "", KB_PATH)
    if not os.path.isdir(kb_dir):
        logger.warning(f"KB path not found: {kb_dir}")
        return articles
    for fname in sorted(os.listdir(kb_dir)):
        if not fname.endswith(".txt"):
            continue
        raw = open(os.path.join(kb_dir, fname), encoding="utf-8").read()
        sections = re.split(r"\n===", raw)

        # 第一个 section 是结构化数据头（JSON-like），提取中文纯文本
        if sections:
            header = sections[0].strip()
            if header and not header.startswith("###"):
                cn_texts = re.findall(r"[一-鿿\d：:、，。；;!！?？\w]+", header)
                cn_clean = " ".join(t for t in cn_texts if len(t) > 3)
                fname_map = {
                    "01-campus-life.txt": "校园生活信息总览（各校区地址、交通、图书馆、食堂、宿舍、自习室等）",
                    "02-academics.txt": "教务信息总览",
                    "03-psychology.txt": "心理健康信息总览",
                    "04-career.txt": "就业资助信息总览",
                    "05-safety.txt": "安全信息总览",
                }
                title = fname_map.get(os.path.basename(fname), "")
                if title:
                    articles.append({"title": title, "text": cn_clean[:3000]})

        # 后续 section 是具体文章
        for sec in sections[1:]:
            sec = sec.strip()
            if not sec or len(sec) < 80:
                continue
            m = re.search(r"^### (.+)$", sec, re.MULTILINE)
            title = m.group(1).strip() if m else ""
            articles.append({"title": title, "text": sec[:2000]})
    logger.info(f"Loaded {len(articles)} KB articles from {kb_dir}")
    return articles


def _search_kb(query: str, top_k: int = 3) -> list[dict]:
    """关键词匹配检索，零依赖"""
    if not KB_ARTICLES:
        return []
    keywords = set()
    for wlen in (2, 3, 4):
        for i in range(len(query) - wlen + 1):
            sub = query[i:i + wlen]
            if all("一" <= c <= "鿿" for c in sub):
                keywords.add(sub)
    scored = []
    for a in KB_ARTICLES:
        title = a["title"]
        text = a["text"]
        score = 0
        # 标题命中加权
        for kw in keywords:
            if kw in title:
                score += 10
        # 正文命中
        search_text = title + " " + text[:2000]
        for kw in keywords:
            if kw in search_text:
                score += 1
        # 单字重叠（短查询的兜底）
        if len(query) <= 3:
            score += len(set(query) & set(search_text[:500]))
        if score > 0:
            scored.append((score, a))
    scored.sort(key=lambda x: -x[0])
    return [a for _, a in scored[:top_k]]


KB_ARTICLES = _load_kb()


def _build_system_prompt(user_message: str, user_context: str = "", teaching_week: str = "") -> str:
    """构建带上下文和知识库检索的 system prompt"""
    prompt = COUNSEL_SYSTEM_PROMPT

    # 用户画像
    if user_context:
        prompt += f"\n\n## 当前用户信息\n{user_context}"

    # 教学周
    if teaching_week:
        prompt += f"\n\n当前是教学第 {teaching_week} 周。"

    # 知识库检索
    kb_results = _search_kb(user_message)
    if kb_results:
        parts = []
        for a in kb_results:
            parts.append(f"【{a['title']}】\n{a['text'][:800]}")
        kb_text = "\n\n---\n\n".join(parts)
        prompt += f"\n\n## 校园知识库参考\n以下是从学校知识库检索到的相关信息，如果与用户问题相关可参考回答：\n{kb_text}\n注意：仅当知识库内容与用户问题直接相关时才引用，不要生硬植入。"

    return prompt


def register_counsel_routes(app):
    @app.route("/api/ai/counsel/stream", methods=["POST"])
    def counsel_stream():
        """
        POST /api/ai/counsel/stream
        Body: { messages: [{role, content}, ...], model?: str, profile?: object, teaching_week?: str, user_context?: str }
        """
        data = request.json
        if not data or "messages" not in data:
            return Response(
                f"data: {json.dumps({'error': '缺少 messages'})}\n\n",
                mimetype="text/event-stream",
            )

        messages: list[dict] = data["messages"]
        user_msg = ""
        for m in reversed(messages):
            if m.get("role") == "user":
                user_msg = m.get("content", "")
                break

        user_context = data.get("user_context", "")
        teaching_week = data.get("teaching_week", "")
        system_prompt = _build_system_prompt(user_msg, user_context, teaching_week)
        logger.info(f"Counsel stream: {len(messages)} msgs, week={teaching_week}, context_len={len(user_context)}")

        def generate():
            full_response = ""
            try:
                for chunk in ai_stream(
                    system_prompt,
                    messages,
                    temperature=0.8,
                    model=data.get("model"),
                ):
                    if chunk.startswith("\n[ERROR]"):
                        err_msg = chunk.replace("\n[ERROR] ", "")
                        yield f"data: {json.dumps({'chunk': '', 'done': True, 'error': err_msg}, ensure_ascii=False)}\n\n"
                        return
                    full_response += chunk
                    yield f"data: {json.dumps({'chunk': chunk, 'done': False, 'error': None}, ensure_ascii=False)}\n\n"
                yield f"data: {json.dumps({'chunk': '', 'done': True, 'error': None, 'full_length': len(full_response)}, ensure_ascii=False)}\n\n"
            except GeneratorExit:
                pass

        return Response(generate(), mimetype="text/event-stream")
