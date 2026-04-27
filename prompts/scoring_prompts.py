# 评分系统专用 Prompt

TEMPLATE_PARSE_PROMPT = """你是专业评分模板解析专家。请从以下Excel内容中提取评分模板结构。

Excel内容：
{excel_content}

请严格按以下JSON格式返回（只返回JSON，不要任何解释）：
{{
    "name": "模板名称（如：形象评分模板）",
    "total_score": 总分,
    "dimensions": [
        {{
            "name": "维度名称",
            "max_score": 满分,
            "is_optional": false,
            "description": "维度的详细评分说明或标准（必须填写，不能为空）",
            "subdimensions": [
                {{
                    "name": "子维度名称",
                    "max_score": 满分,
                    "description": "子维度的评分标准说明（必须填写，不能为空。格式：'要点1。要点2。要点3。'）"
                }}
            ]
        }}
    ]
}}

注意事项：
1. description 字段绝对不能为空！每个维度必须有描述。
2. 描述格式要求：3-5个句子，用句号分隔，描述清楚评分要点。
3. 如果Excel中有原文说明，提取出来并补全。
4. 如果Excel中没有说明，根据维度名称、满分值、所属比赛类型（短视频/演讲/才艺等）推断合理的评分标准描述。
5. 推断示例：视频内容(30分) -> "视频内容的完整性和深度。主题是否突出、逻辑是否清晰。内容充实度、创意性、可看性。"
6. 只返回合法JSON，不要代码块标记。
"""

CONTESTANTS_PARSE_PROMPT = """你是专业选手名单解析专家。请从以下Excel内容中提取选手信息。

Excel内容：
{excel_content}

请严格按以下JSON格式返回（只返回JSON，不要任何解释）：
{{
    "contestants": [
        {{
            "number": "编号（如：01）",
            "name": "选手姓名",
            "group_name": "组别（如：A组，没有则填空字符串）"
        }}
    ]
}}

注意事项：
1. 识别表头行，通常是第一行或前几行
2. 映射列：找编号列、姓名列、组别列
3. 如果表头明确写了"编号"、"姓名"、"组别"，按表头映射
4. 如果表头没有明确名称，根据数据内容判断（如"01"、"张三"这样的数据）
5. 只返回合法JSON，不要代码块标记
"""

TEMPLATE_FORMAT_ANALYSIS_PROMPT = """你是一个Excel格式分析专家。用户上传了一个Excel模板文件，希望把比赛结果填充到这个模板中。

模板Excel内容：
{template_content}

模板中的合并单元格：
{merged_cells}

需要填充的数据：
{result_data}

请分析这个模板的格式意图，返回JSON配置指导如何填充数据：

{{
    "fill_config": {{
        "header_row": 表头所在行号（通常是1）,
        "data_start_row": 数据开始填充的行号（通常是2）,
        "column_map": {{
            "A": "rank",
            "B": "number",
            "C": "name",
            "D": "group_name",
            "E": "total_score",
            "F": "score_count",
            "G": "dimension_形象",
            "H": "dimension_台风"
        }},
        "keep_merged_cells": true/false,
        "notes": "格式分析说明"
    }},
    "template_format": {{
        "description": "对这个模板格式的描述",
        "column_count": 列数,
        "expected_columns": ["排名", "编号", "姓名", "组别", "总分", ...]
    }}
}}

注意事项：
1. 仔细分析表头行，识别各列对应的数据字段
2. 排名(rank)、编号(number)、姓名(name)、组别(group_name)是基础字段
3. 总分(total_score)、评分人数(score_count)是可选字段
4. 如果模板中包含评分维度列（如"形象(20)"、"台风(15)"），识别这些列并映射到dimension_scores中的对应维度
5. 合并单元格如果有，需要在keep_merged_cells中标注
6. 只返回合法JSON，不要代码块标记
"""
