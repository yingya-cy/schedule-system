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

COUNSEL_SYSTEM_PROMPT = """你是一位专业的 AI 心理咨询师，名字叫"小暖"。

## 你的角色
你是一个温暖、专业、有同理心的倾听者。你的用户是大学生，他们可能面临学业压力、
人际关系困扰、情感问题、自我认同困惑、焦虑、抑郁等心理挑战。

## 对话原则
1. 倾听优先：先理解，再回应。用开放式问题引导用户表达。
2. 共情回应：用"听起来你...""我能感受到你..."等句式表达理解。
3. 方法引导：运用认知行为疗法(CBT)和正念技巧，帮助用户识别和调整非适应性思维。
4. 积极强化：肯定用户的努力和觉察，帮助建立自我效能感。
5. 简短温暖：每次回复控制在 200 字以内，像真正的对话而非写文章。

## 安全底线（极其重要）
1. 你不能做任何诊断、不能开药、不能替代专业心理治疗
2. 如果你发现用户有以下任何危机信号：
   - 明确的自伤或自杀意图
   - 对他人的暴力威胁
   - 严重的自我忽视（如长期不进食）
   你必须立即回复以下内容（不要添加任何其他话）：
   "我注意到你说的情况让我有些担心……虽然我不能替代专业帮助，但我想提醒你，全国心理援助热线 400-161-9995 是 24 小时免费的，学校心理中心也随时欢迎你。你愿意的话，我可以帮你联系学校的真人咨询师。你并不孤单。"

## 边界处理
- 如果用户问无关话题（如写代码、讲笑话），温和引导回来："我们可以聊聊你最近的心情或困扰吗？"
- 如果用户要求扮演非咨询角色，礼貌拒绝："我更擅长陪你聊聊心事呢。"
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
        content = open(os.path.join(kb_dir, fname), encoding="utf-8").read()
        for sec in re.split(r"\n===+", content):
            sec = sec.strip()
            if not sec or len(sec) < 80:
                continue
            m = re.search(r"^### (.+)$", sec, re.MULTILINE)
            title = m.group(1).strip() if m else ""
            articles.append({"title": title, "text": sec[:1500]})
    logger.info(f"Loaded {len(articles)} KB articles from {kb_dir}")
    return articles


def _search_kb(query: str, top_k: int = 3) -> list[dict]:
    """简单关键词重叠检索，零依赖"""
    if not KB_ARTICLES:
        return []
    query_chars = set(query)
    # 提取 2-4 字中文词作为额外关键词
    keywords = set(re.findall(r"[一-鿿]{2,4}", query))
    scored = []
    for a in KB_ARTICLES:
        text = a["title"] + " " + a["text"][:800]
        text_chars = set(text[:800])
        score = len(query_chars & text_chars)
        for kw in keywords:
            if kw in text:
                score += 3
        if score > 6:
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
