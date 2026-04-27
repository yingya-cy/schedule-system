# Excel 解析工具模块
# 读取 Excel 文件内容为结构化文本，保留单元格位置信息

import logging
import re
import json
import io
from typing import Any
from openpyxl import load_workbook
from openpyxl.utils import get_column_letter

logger = logging.getLogger(__name__)


def excel_to_text(file_path: str, max_rows: int = 50) -> str:
    """
    将 Excel 文件转换为结构化文本，保持单元格位置信息

    Args:
        file_path: Excel 文件路径
        max_rows: 最大读取行数（防止超大文件）

    Returns:
        结构化文本，每行格式："| 列A | 列B | 列C | ..."
    """
    try:
        wb = load_workbook(file_path, data_only=True, read_only=True)
        ws = wb.active

        rows_data = []
        for row_idx, row in enumerate(ws.iter_rows(max_row=max_rows), start=1):
            row_values = []
            for cell in row:
                col_letter = get_column_letter(cell.column)
                val = cell.value
                if val is None:
                    row_values.append("")
                else:
                    val_str = str(val).replace('\n', ' ').replace('\r', ' ').strip()
                    row_values.append(val_str)

            # 跳过空行
            if any(v.strip() for v in row_values):
                rows_data.append(f"[Row {row_idx}] " + " | ".join(row_values))

        wb.close()
        return "\n".join(rows_data)

    except Exception as e:
        logger.error(f"Excel 解析失败: {e}")
        raise


def excel_to_text_with_format(file_path: str, max_rows: int = 50) -> dict[str, Any]:
    """
    将 Excel 文件转换为带格式信息的字典

    Args:
        file_path: Excel 文件路径
        max_rows: 最大读取行数

    Returns:
        {
            "text": "结构化文本",
            "merged_cells": ["A1:C1", ...],
            "column_widths": {"A": 10, "B": 15, ...},
            "header_row": 1,
            "total_rows": 50
        }
    """
    try:
        wb = load_workbook(file_path, data_only=True)
        ws = wb.active

        # 提取文本内容
        text_lines = []
        for row_idx, row in enumerate(ws.iter_rows(max_row=max_rows), start=1):
            row_values = []
            for cell in row:
                val = cell.value
                if val is None:
                    row_values.append("")
                else:
                    val_str = str(val).replace('\n', ' ').replace('\r', ' ').strip()
                    row_values.append(val_str)

            if any(v.strip() for v in row_values):
                text_lines.append(f"[Row {row_idx}] " + " | ".join(row_values))

        # 提取合并单元格信息
        merged_cells = [str(mc) for mc in ws.merged_cells.ranges]

        # 提取列宽信息
        column_widths = {}
        for col_idx in range(1, ws.max_column + 1):
            col_letter = get_column_letter(col_idx)
            if col_letter in ws.column_dimensions:
                column_widths[col_letter] = ws.column_dimensions[col_letter].width

        result = {
            "text": "\n".join(text_lines),
            "merged_cells": merged_cells,
            "column_widths": column_widths,
            "header_row": 1,
            "total_rows": ws.max_row,
            "total_columns": ws.max_column
        }

        wb.close()
        return result

    except Exception as e:
        logger.error(f"Excel 带格式解析失败: {e}")
        raise


def parse_excel_for_template(file_path: str) -> dict[str, Any]:
    """
    解析 Excel 文件，提取评分模板结构

    返回:
    {
        "name": "模板名称",
        "total_score": 100,
        "dimensions": [
            {
                "name": "形象",
                "max_score": 20,
                "subdimensions": [
                    {"name": "仪容仪表", "max_score": 10, "description": ""},
                    {"name": "台风", "max_score": 10, "description": ""}
                ]
            }
        ]
    }
    """
    from utils.ai_client import create_ark_client, DOUBAO_MODEL
    from prompts.scoring_prompts import TEMPLATE_PARSE_PROMPT
    import tempfile
    import os

    # 读取 Excel 内容
    excel_data = excel_to_text_with_format(file_path)

    # 构建 prompt
    prompt = TEMPLATE_PARSE_PROMPT.format(excel_content=excel_data["text"])

    # 调用 AI
    client = create_ark_client(timeout=60.0)
    response = client.chat.completions.create(
        model=DOUBAO_MODEL,
        messages=[{"role": "user", "content": [{"type": "text", "text": prompt}]}],
        temperature=0.01
    )

    content = response.choices[0].message.content

    # 提取 JSON
    json_match = re.search(r'(\{[\s\S]*\})', content)
    if json_match:
        result = json.loads(json_match.group(1))
        return result

    raise ValueError(f"AI 返回格式错误，无法解析模板: {content[:200]}")


def parse_excel_for_contestants(file_path: str) -> dict[str, Any]:
    """
    解析 Excel 文件，提取选手名单

    返回:
    {
        "contestants": [
            {"number": "01", "name": "张三", "group_name": "A组"},
            ...
        ]
    }
    """
    from utils.ai_client import create_ark_client, DOUBAO_MODEL
    from prompts.scoring_prompts import CONTESTANTS_PARSE_PROMPT
    import re

    # 读取 Excel 内容
    excel_data = excel_to_text_with_format(file_path)

    # 构建 prompt
    prompt = CONTESTANTS_PARSE_PROMPT.format(excel_content=excel_data["text"])

    # 调用 AI
    client = create_ark_client(timeout=60.0)
    response = client.chat.completions.create(
        model=DOUBAO_MODEL,
        messages=[{"role": "user", "content": [{"type": "text", "text": prompt}]}],
        temperature=0.01
    )

    content = response.choices[0].message.content

    # 提取 JSON
    json_match = re.search(r'(\{[\s\S]*\})', content)
    if json_match:
        result = json.loads(json_match.group(1))
        return result

    raise ValueError(f"AI 返回格式错误，无法解析选手名单: {content[:200]}")


def fill_template_with_results(
    template_path: str,
    result_data: dict[str, Any]
) -> bytes:
    """
    读取模板 Excel，填充结果数据，返回文件二进制

    Args:
        template_path: 模板 Excel 文件路径
        result_data: {
            "results": [
                {
                    "rank": 1,
                    "number": "01",
                    "name": "张三",
                    "group_name": "A组",
                    "total_score": 95.5,
                    "dimension_scores": {"形象": 20, "台风": 18},
                    "score_count": 3
                }
            ],
            "competition": {
                "name": "比赛名称",
                "template": {...}
            }
        }

    Returns:
        填充后的 Excel 文件二进制
    """
    from utils.ai_client import create_ark_client, DOUBAO_MODEL
    from prompts.scoring_prompts import TEMPLATE_FORMAT_ANALYSIS_PROMPT
    from openpyxl import load_workbook
    from openpyxl.styles import Font, Alignment, Border, Side
    import re
    import json
    import io

    # 1. 读取模板文件
    wb = load_workbook(template_path)
    ws = wb.active

    # 提取模板文本内容用于 AI 分析
    template_lines = []
    for row_idx, row in enumerate(ws.iter_rows(max_row=20), start=1):
        row_values = [str(cell.value) if cell.value else "" for cell in row]
        if any(v.strip() for v in row_values):
            template_lines.append(f"[Row {row_idx}] " + " | ".join(row_values))

    template_text = "\n".join(template_lines)
    merged_cells = [str(mc) for mc in ws.merged_cells.ranges]

    # 2. 调用 AI 分析模板格式
    prompt = TEMPLATE_FORMAT_ANALYSIS_PROMPT.format(
        template_content=template_text,
        merged_cells=", ".join(merged_cells),
        result_data=json.dumps(result_data, ensure_ascii=False)
    )

    client = create_ark_client(timeout=120.0)
    response = client.chat.completions.create(
        model=DOUBAO_MODEL,
        messages=[{"role": "user", "content": [{"type": "text", "text": prompt}]}],
        temperature=0.01
    )

    content = response.choices[0].message.content

    # 3. 解析 AI 返回的格式配置
    json_match = re.search(r'(\{[\s\S]*\})', content)
    if not json_match:
        raise ValueError(f"AI 返回格式错误: {content[:200]}")

    format_config = json.loads(json_match.group(1))

    # 4. 根据格式配置填充数据
    fill_config = format_config.get("fill_config", {})

    results = result_data.get("results", [])
    header_row = fill_config.get("header_row", 1)
    data_start_row = fill_config.get("data_start_row", 2)

    # 填充每一行结果
    for i, result in enumerate(results):
        row_num = data_start_row + i

        # 按列映射填充
        column_map = fill_config.get("column_map", {})
        for col_letter, field in column_map.items():
            cell = ws[f"{col_letter}{row_num}"]
            value = result.get(field, "")
            if value is not None:
                cell.value = value

    # 5. 返回二进制
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output.read()
