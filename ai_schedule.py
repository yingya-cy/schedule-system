"""
AI 日程安排 — 课表 + 事项 -> 学习计划生成
"""
import json
import logging
from flask import request, jsonify
from ai_endpoints import ai_text

logger = logging.getLogger(__name__)

SCHEDULE_SYSTEM_PROMPT = """你是一个懂大学生的学习搭子，不是冷冰冰的排课机器。你的计划要有温度、有个性、有呼吸感。

## 学校作息时间表（每节课 40 分钟）
上午: 第1节 08:20-09:00 | 课间10分 | 第2节 09:10-09:50 | 大课间20分 | 第3节 10:10-10:50 | 课间10分 | 第4节 11:00-11:40
下午: 第5节 13:50-14:30 | 课间10分 | 第6节 14:40-15:20 | 大课间20分 | 第7节 15:40-16:20 | 课间10分 | 第8节 16:30-17:10
晚上: 第9节 18:40-19:20 | 课间10分 | 第10节 19:30-20:10 | 课间10分 | 第11节 20:20-21:00
sections [1,2]=08:20-09:50，[3,4]=10:10-11:40，以此类推。start/end 对齐上述时间。

## 你的风格
- 像朋友一样给建议，不要像教务系统一样填表
- 每天可以有不同的节奏：周一猛学、周三轻松、周五收尾
- 如果用户给了偏好（夜猫子/早起鸟/某个科目焦虑），认真呼应
- task 描述用口语化短句，比如「把第三章例题刷一遍」比「复习高数」更好
- note 里可以夹一句鼓励或小提醒

## 约束（必须遵守）
1. 有课的时间段准确标 class，task 写课程名
2. 每块 ≥40 分钟，相邻空闲节次合并，不切碎片
3. 每天 block 数量不强制，有课的日子 3-5 块，没课的日子 4-6 块
4. 每周有 1-2 天安排轻松一点，不要天天打鸡血
5. 事项中的考试/deadline 优先安排

## 输出格式
严格 JSON：
{
  "weekly_plans": [{
    "week_start": "YYYY-MM-DD",
    "daily_plans": [{
      "date": "YYYY-MM-DD",
      "day_of_week": 1,
      "time_blocks": [{
        "start": "HH:MM", "end": "HH:MM",
        "task": "口语化短句",
        "type": "study|class|activity|break",
        "priority": "high|medium|low",
        "note": "鼓励或提醒，可为空"
      }]
    }]
  }],
  "summary": "像朋友总结这周，2-3 句话"
}"""

SCHEDULE_USER_TEMPLATE = """学生：{grade}{major}（第{current_week}周）
课表：{courses_json}
事项：{commitments_json}
{custom_prompt}
生成从 {next_monday} 开始的一周计划。"""


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

            custom = (data.get('custom_prompt') or '').strip()
            custom_prompt = f"用户额外要求：\n{custom}" if custom else ""

            user_prompt = SCHEDULE_USER_TEMPLATE.format(
                grade=data.get('grade', '未知'),
                major=data.get('major', '未知'),
                current_week=data.get('current_week', '?'),
                courses_json=courses_json,
                commitments_json=commitments_json,
                custom_prompt=custom_prompt,
                next_monday=data.get('next_monday', '下周一'),
            )

            raw = ai_text(SCHEDULE_SYSTEM_PROMPT, user_prompt, temperature=0.3, timeout=180.0, model=data.get('model'))

            # Strip markdown code blocks (```json ... ```)
            import re
            cleaned = raw.strip()
            code_block_match = re.search(r'```(?:json)?\s*([\s\S]*?)```', cleaned)
            if code_block_match:
                cleaned = code_block_match.group(1).strip()

            # Try to find and fix common JSON issues
            plan = None
            errors = []

            # Attempt 1: direct parse
            try:
                plan = json.loads(cleaned)
            except json.JSONDecodeError as e1:
                errors.append(f"direct: {e1}")

            # Attempt 2: extract first JSON object via regex
            if plan is None:
                obj_match = re.search(r'(\{[\s\S]*\})', cleaned)
                if obj_match:
                    try:
                        plan = json.loads(obj_match.group(1))
                    except json.JSONDecodeError as e2:
                        errors.append(f"regex: {e2}")

            # Attempt 3: fix trailing comma before closing brace/bracket
            if plan is None:
                fixed = re.sub(r',\s*([}\]])', r'\1', cleaned)
                obj_match = re.search(r'(\{[\s\S]*\})', fixed)
                if obj_match:
                    try:
                        plan = json.loads(obj_match.group(1))
                    except json.JSONDecodeError as e3:
                        errors.append(f"fix-commas: {e3}")

            # Attempt 4: json_repair library (handles missing commas, trailing commas, etc.)
            if plan is None:
                try:
                    from json_repair import repair_json
                    repaired = repair_json(cleaned)
                    plan = json.loads(repaired)
                except Exception as e4:
                    errors.append(f"json-repair: {e4}")

            if plan is None:
                logger.error(f"Failed to parse AI response after 3 attempts: {'; '.join(errors)}")
                logger.error(f"Raw (first 800 chars): {raw[:800]}")
                return jsonify({
                    'success': False,
                    'error': f'AI 返回格式异常: {errors[-1] if errors else "unknown"}',
                    'raw': raw[:1000],
                }), 502

            return jsonify({'success': True, 'data': plan})

        except RuntimeError as e:
            return jsonify({'success': False, 'error': str(e)}), 502
        except Exception as e:
            logger.exception("Unexpected error in /api/ai/schedule-plan")
            return jsonify({'success': False, 'error': str(e)}), 500
