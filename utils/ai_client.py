"""
AI客户端工具模块
包含OpenAI客户端创建和配置
"""

import os
import re
from openai import OpenAI

AI_API_KEY = os.environ.get("AI_API_KEY", "")
AI_BASE_URL = os.environ.get("AI_BASE_URL", "https://api.minimax.chat/v1")
AI_MODEL = os.environ.get("AI_MODEL", "doubao-seed-2.0-pro")
AI_VISION_MODEL = os.environ.get("AI_VISION_MODEL", "doubao-seed-2.0-pro")
AI_TEXT_MODEL = os.environ.get("AI_TEXT_MODEL", "deepseek-v4-pro")

# MiniMax 独立 API 配置
MINIMAX_API_KEY = os.environ.get("MINIMAX_API_KEY", "")
MINIMAX_BASE_URL = os.environ.get("MINIMAX_BASE_URL", "https://api.minimax.chat/v1")
MINIMAX_MODEL = os.environ.get("MINIMAX_MODEL", "MiniMax-M2.7")


def strip_thinking(content: str) -> str:
    """去除 MiniMax 等推理模型的 <think>...</think> 标签内容，返回纯输出"""
    if '</think>' in content:
        return content.split('</think>')[-1].strip()
    return content


def extract_json_array(content: str):
    """从 AI 回复中提取 JSON 数组"""
    clean = strip_thinking(content)
    match = re.search(r'(\[[\s\S]*\])', clean)
    if match:
        return match.group(1)
    return None


def extract_json_object(content: str):
    """从 AI 回复中提取 JSON 对象"""
    clean = strip_thinking(content)
    match = re.search(r'(\{[\s\S]*\})', clean)
    if match:
        return match.group(1)
    return None


def get_client_and_model(requested_model: str | None = None, timeout: float = 300.0):
    """
    根据 model 名称返回 (client, effective_model)。
    - minimax 开头的走 MiniMax 独立 API
    - 其他走火山引擎 Ark
    """
    if requested_model and requested_model.lower().startswith('minimax'):
        return (
            OpenAI(api_key=MINIMAX_API_KEY, base_url=MINIMAX_BASE_URL, timeout=timeout),
            MINIMAX_MODEL,
        )
    return (
        OpenAI(api_key=AI_API_KEY, base_url=AI_BASE_URL, timeout=timeout),
        requested_model or AI_TEXT_MODEL,
    )


def create_ark_client(timeout=300.0):
    """
    创建OpenAI兼容客户端（仅 Ark，供 OCR 等视觉任务使用）
    """
    return OpenAI(
        api_key=AI_API_KEY,
        base_url=AI_BASE_URL,
        timeout=timeout
    )


# 默认客户端（用于不需要图片尺寸的场景）
ark_client = create_ark_client(300.0)
