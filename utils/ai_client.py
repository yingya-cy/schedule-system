"""
AI客户端工具模块
包含OpenAI客户端创建和配置
"""

import os
import re
from openai import OpenAI

AI_API_KEY = os.environ.get("AI_API_KEY", "")
AI_BASE_URL = os.environ.get("AI_BASE_URL", "https://api.minimax.chat/v1")
AI_MODEL = os.environ.get("AI_MODEL", "MiniMax-M2.7")


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


def create_ark_client(timeout=300.0):
    """
    创建OpenAI兼容客户端，支持动态超时设置
    """
    return OpenAI(
        api_key=AI_API_KEY,
        base_url=AI_BASE_URL,
        timeout=timeout
    )


# 默认客户端（用于不需要图片尺寸的场景）
ark_client = create_ark_client(300.0)
