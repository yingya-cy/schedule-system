"""
AI客户端工具模块
包含OpenAI客户端创建和配置
"""

from openai import OpenAI

ARK_API_KEY = "504492dc-9d32-40ea-b42d-862240611a15" 
DOUBAO_MODEL = "doubao-seed-2.0-pro" 


def create_ark_client(timeout=300.0):
    """
    创建OpenAI客户端，支持动态超时设置
    """
    return OpenAI(
        api_key=ARK_API_KEY,
        base_url="https://ark.cn-beijing.volces.com/api/coding/v3",
        timeout=timeout
    )


# 默认客户端（用于不需要图片尺寸的场景）
ark_client = create_ark_client(300.0)
