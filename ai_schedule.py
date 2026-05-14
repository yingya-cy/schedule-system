"""
AI 日程安排 — 课表 + 事项 -> 学习计划生成
"""
import json
import logging
from flask import request, jsonify
from ai_endpoints import ai_text

logger = logging.getLogger(__name__)

SCHEDULE_SYSTEM_PROMPT = """你是一位专业的学习规划师。你的任务是根据学生的课表和个人事项，制定一份详细的周学习计划。

## 规划原则
1. 课程时间不可占用 — 有课的时间段不能安排其他任务
2. 利用碎片时间 — 课间 30-60 分钟可安排轻量复习
3. 优先级排序 — 考试/作业 deadline 优先，日常复习其次
4. 劳逸结合 — 每 90 分钟学习后安排 15 分钟休息
5. 学科间交替 — 避免连续 3 小时学同一科目
6. 早晚效率 — 早上安排需要高度集中的任务，晚上安排整理/背诵

## 输出格式
你必须输出严格 JSON，不要包含 ```json 标记或其他文字：
{
  "weekly_plans": [
    {
      "week_start": "YYYY-MM-DD",
      "daily_plans": [
        {
          "date": "YYYY-MM-DD",
          "day_of_week": 1,
          "time_blocks": [
            {
              "start": "HH:MM",
              "end": "HH:MM",
              "task": "具体任务描述",
              "type": "study",
              "priority": "high",
              "note": ""
            }
          ]
        }
      ]
    }
  ],
  "summary": "本周学习计划概览，2-3 句话"
}

## 字段说明
- type: "study"(自习), "class"(上课), "activity"(活动), "break"(休息)
- priority: "high", "medium", "low"
- note: 补充说明，可为空字符串
- 时间块必须覆盖 08:00-22:00，相邻时间段不能有间隙
- 每天保留午餐（12:00-13:00）和晚餐（18:00-19:00）"""

SCHEDULE_USER_TEMPLATE = """学生信息：
- 年级：{grade}
- 专业：{major}

当前课表（本学期全部课程）：
{courses_json}

手动添加的事项：
{commitments_json}

请基于以上信息，生成从 {next_monday} 开始的一周（7天）学习计划。"""


def register_schedule_routes(app):
    """注册 AI 排课路由"""

    @app.route('/api/ai/schedule-plan', methods=['POST'])
    def schedule_plan():
        """
        POST /api/ai/schedule-plan
        Body: { courses, commitments, grade?, major?, next_monday }
        Response: { success, data: Plan }
        """
        try:
            data = request.json
            if not data or 'courses' not in data:
                return jsonify({'success': False, 'error': '缺少课表数据'}), 400

            courses_json = json.dumps(data['courses'], ensure_ascii=False, indent=2)
            commitments_json = json.dumps(data.get('commitments', []), ensure_ascii=False, indent=2)

            user_prompt = SCHEDULE_USER_TEMPLATE.format(
                grade=data.get('grade', '未知'),
                major=data.get('major', '未知'),
                courses_json=courses_json,
                commitments_json=commitments_json,
                next_monday=data.get('next_monday', '下周一'),
            )

            raw = ai_text(SCHEDULE_SYSTEM_PROMPT, user_prompt, temperature=0.3, timeout=180.0)

            # 尝试直接解析 JSON
            try:
                plan = json.loads(raw)
            except json.JSONDecodeError:
                # 尝试提取 JSON 对象
                import re
                match = re.search(r'(\{[\s\S]*\})', raw)
                if match:
                    plan = json.loads(match.group(1))
                else:
                    logger.error(f"Failed to parse AI response: {raw[:500]}")
                    return jsonify({'success': False, 'error': 'AI 返回格式异常，请重试', 'raw': raw[:1000]}), 502

            return jsonify({'success': True, 'data': plan})

        except RuntimeError as e:
            return jsonify({'success': False, 'error': str(e)}), 502
        except Exception as e:
            logger.exception("Unexpected error in /api/ai/schedule-plan")
            return jsonify({'success': False, 'error': str(e)}), 500
