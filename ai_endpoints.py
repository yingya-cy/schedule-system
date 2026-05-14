"""
AI 文本生成端点 — 供 Express 后端调用的通用 AI 接口
提供两个能力: 1) 非流式文本生成 (排课用)  2) SSE 流式输出 (心理咨询用)
"""

import json
import logging
from flask import request, jsonify, Response
from utils.ai_client import create_ark_client, AI_MODEL, strip_thinking

logger = logging.getLogger(__name__)


def ai_text(system_prompt: str, user_message: str, temperature: float = 0.7, timeout: float = 120.0) -> str:
    """通用文本生成。失败时 raise RuntimeError"""
    client = create_ark_client(timeout)
    try:
        response = client.chat.completions.create(
            model=AI_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            temperature=temperature,
        )
        content = response.choices[0].message.content
        return strip_thinking(content)
    except Exception as e:
        logger.error(f"AI text generation failed: {e}")
        raise RuntimeError(f"AI 调用失败: {str(e)}")


def ai_stream(system_prompt: str, messages: list[dict], temperature: float = 0.8):
    """SSE 流式生成，generator 内异常通过 error chunk 传出"""
    try:
        client = create_ark_client(timeout=300.0)
        stream = client.chat.completions.create(
            model=AI_MODEL,
            messages=[{"role": "system", "content": system_prompt}] + messages,
            temperature=temperature,
            stream=True,
        )
        in_think = False
        for chunk in stream:
            delta = chunk.choices[0].delta
            if not delta.content:
                continue
            text = delta.content

            # 流式处理 <think> 标签：跳过思考内容
            if '<think>' in text:
                in_think = True
                text = text.split('<think>', 1)[1] if text.split('<think>', 1)[1] else ''
            if in_think:
                if '</think>' in text:
                    in_think = False
                    text = text.split('</think>', 1)[1] if text.split('</think>', 1)[1] else ''
                    if not text:
                        continue
                else:
                    continue

            # 首 chunk 可能以换行开头（thinking 标签后的残留），去掉前导空白
            if text and text != text.lstrip():
                text = text.lstrip()
            if text:
                yield text
    except GeneratorExit:
        return  # 客户端断开，正常退出
    except Exception as e:
        logger.error(f"AI stream generation failed: {e}")
        yield f"\n[ERROR] {str(e)}"


def register_ai_routes(app):
    """注册 AI 相关 Flask 路由"""

    @app.route('/api/ai/text', methods=['POST'])
    def api_ai_text():
        """
        POST /api/ai/text
        Body: { system_prompt: str, user_message: str, temperature?: float }
        Response: { success: bool, text?: str, error?: str }
        """
        try:
            data = request.json
            if not data or 'system_prompt' not in data or 'user_message' not in data:
                return jsonify({'success': False, 'error': '缺少 system_prompt 或 user_message'}), 400

            text = ai_text(
                data['system_prompt'],
                data['user_message'],
                data.get('temperature', 0.7),
                data.get('timeout', 120.0),
            )
            return jsonify({'success': True, 'text': text})
        except RuntimeError as e:
            return jsonify({'success': False, 'error': str(e)}), 502
        except Exception as e:
            logger.exception("Unexpected error in /api/ai/text")
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/ai/stream', methods=['POST'])
    def api_ai_stream():
        """
        POST /api/ai/stream
        Body: { system_prompt: str, messages: [{role, content}, ...], temperature?: float }
        Response: text/event-stream
          data: {"chunk": "文字", "done": false, "error": null}
          data: {"chunk": "", "done": true, "error": null}
        """
        data = request.json
        if not data or 'system_prompt' not in data or 'messages' not in data:
            return jsonify({'success': False, 'error': '缺少 system_prompt 或 messages'}), 400

        def generate():
            try:
                for chunk in ai_stream(
                    data['system_prompt'],
                    data['messages'],
                    data.get('temperature', 0.8),
                ):
                    if chunk.startswith('\n[ERROR]'):
                        yield f"data: {json.dumps({'chunk': '', 'done': True, 'error': chunk.replace(chr(10) + '[ERROR] ', '')}, ensure_ascii=False)}\n\n"
                        return
                    yield f"data: {json.dumps({'chunk': chunk, 'done': False, 'error': None}, ensure_ascii=False)}\n\n"
                yield f"data: {json.dumps({'chunk': '', 'done': True, 'error': None}, ensure_ascii=False)}\n\n"
            except GeneratorExit:
                return

        return Response(generate(), mimetype='text/event-stream')
