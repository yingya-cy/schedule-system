"""
图像处理工具模块
包含图像尺寸检测、课表类型识别、Base64编码等功能
"""

import base64
import logging
from PIL import Image

logger = logging.getLogger(__name__)


def calculate_dynamic_timeout(width, height):
    """
    根据图片尺寸计算动态超时时间
    规则：
    1. 基础超时：300秒（5分钟）
    2. 如果宽度 > 5000 且 高度 > 1000：增加120秒（2分钟）
    3. 如果宽度 > 8000 或 高度 > 8000：增加180秒（3分钟）
    4. 如果宽高比 > 15.0：增加60秒（1分钟）
    5. 最大超时：600秒（10分钟）
    """
    base_timeout = 300.0  # 5分钟基础超时
    additional_timeout = 0.0
    
    # 检查5000x1000以上的大图片
    if width > 5000 and height > 1000:
        additional_timeout += 120.0
        logger.info(f"检测到大图片 {width}x{height}，增加120秒超时")
    
    # 检查超大尺寸图片
    if width > 8000 or height > 8000:
        additional_timeout += 180.0
        logger.info(f"检测到超大图片 {width}x{height}，增加180秒超时")
    
    # 检查超宽图片
    if width / height > 15.0:
        additional_timeout += 60.0
        logger.info(f"检测到超宽图片 宽高比={width/height:.2f}，增加60秒超时")
    
    # 计算总超时时间，不超过最大值
    total_timeout = base_timeout + additional_timeout
    max_timeout = 600.0  # 10分钟最大超时
    
    if total_timeout > max_timeout:
        logger.info(f"计算超时 {total_timeout:.1f}秒超过最大值，限制为{max_timeout:.1f}秒")
        total_timeout = max_timeout
    
    logger.info(f"图片尺寸 {width}x{height}，动态超时设置为 {total_timeout:.1f}秒")
    return total_timeout


def auto_detect_schedule_type(image_path):
    """
    自动检测课表类型
    根据图片宽高比判断是普通课表还是超宽课表
    """
    try:
        with Image.open(image_path) as img:
            w, h = img.size
            ratio = w / h
            logger.info(f"Auto-detecting schedule type: {w}x{h}, ratio={ratio:.2f}")
            if ratio > 2.0:
                logger.info("Auto-detected: dense_wide")
                return 'dense_wide'
            else:
                logger.info("Auto-detected: standard")
                return 'standard'
    except Exception as e:
        logger.warning(f"Auto-detect failed: {e}, falling back to 'standard'")
        return 'standard'


def encode_image_to_base64(image_path):
    """
    将图片文件编码为Base64字符串
    """
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode('utf-8')
