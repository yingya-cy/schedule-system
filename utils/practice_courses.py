# -*- coding: utf-8 -*-
"""实践课程（PDF 页脚 `实践课程：` 行）解析与合并。

实践课程不在课表表格里，只出现在页脚，例如：
    实践课程：军事实践■赵猛(共2周)/16-17周;
    实践课程：教育见习（一）■郭新斌(共2周)/第13周;
竖型、横型课表的页脚格式一致，所以统一从 PDF 文本层提取，在
service.py 的解析链（竖型 -> 横型 -> AI）之后并入，两种版式都覆盖。

规则：
1. 军事实践：固定落在 星期一 1-2 节（与库内 83 条既有数据一致）；
2. 其它实践课程：课表内存在同名课程时沿用该课程的星期与节次，
   没有同名课程则暂不产出（2026-10-18 确认）；
3. 周次解析不出来时不产出，避免污染空闲计算。

另外：页脚文字有时会和课表格子粘在一起，被解析成名为
`实践课程：军事实践` 之类的假课程（横型课表上出现过），这类记录
在合并时一律剔除。
"""
import re

from utils.rule_parser import clean_course_name, parse_weeks

SYMBOLS = '★☆■◆'
MARK = '实践课程'
MILITARY = '军事实践'
REMARK = '实践课程；覆盖周次整周不参与空闲计算'
_STOP_WORDS = r'其他课程|打印时间|课程学时组成|学分'


def _record_name(record):
    return str(record.get('course_name') or record.get('course') or record.get('name') or '').strip()


def _split_items(text):
    """从 `实践课程：` 之后截取片段，按分号切条（换行可能是排版折行）。"""
    start = text.find(MARK)
    if start < 0:
        return []
    segment = text[start + len(MARK):start + len(MARK) + 400]
    segment = re.split(_STOP_WORDS, segment)[0]
    items = []
    for raw in re.split(r'[;；]', segment):
        flat = ' '.join(raw.split())
        if not flat:
            continue
        items.append(flat)
    return items


def _parse_item(item):
    symbol = ''
    for ch in item:
        if ch in SYMBOLS:
            symbol = ch
            break

    if symbol:
        head, _, tail = item.partition(symbol)
        name = clean_course_name(head)
        parts = tail.split('/')
        teacher = parts[0].strip() if parts else ''
        week_str = parts[1].strip() if len(parts) > 1 else ''
    else:
        match = re.search(r'/([^/]*周)\s*$', item)
        if match:
            week_str = match.group(1).strip()
            head = item[:match.start()].strip()
        else:
            week_str = ''
            head = item.strip()
        tokens = head.split()
        name = clean_course_name(tokens[0]) if tokens else ''
        teacher = ' '.join(tokens[1:]).strip() if len(tokens) > 1 else ''

    teacher = re.sub(r'[（(][^）)]*[）)]', '', teacher).strip()
    return name, teacher, week_str


def _sections_of(record):
    start = record.get('sectionStart')
    end = record.get('sectionEnd')
    if start is None or end is None:
        raw = str(record.get('section') or record.get('period') or '')
        match = re.search(r'(\d+)\s*[-~]\s*(\d+)', raw)
        if match:
            start, end = int(match.group(1)), int(match.group(2))
        else:
            match = re.search(r'(\d+)', raw)
            if match:
                start = end = int(match.group(1))
    if start is None or end is None:
        return None
    start, end = int(start), int(end)
    if start < 1 or end < start or end > 24:
        return None
    return start, end


def _build(name, teacher, weeks, weekday, span, raw):
    start, end = span
    return {
        'id': '%s-%s-%s-%s' % (weekday, name, start, ','.join(str(w) for w in weeks)),
        'course_name': name,
        'weekday': weekday,
        'section': '%d-%d' % (start, end),
        'sections': list(range(start, end + 1)),
        'sectionStart': start,
        'sectionEnd': end,
        'weeks': weeks,
        'weeks_list': weeks,
        'teacher': teacher,
        'category': 'practice',
        'remark': REMARK,
        'isPractice': True,
        'raw': '实践课程：%s' % raw,
    }


def merge_practice_records(text, records):
    """把页脚实践课程并入解析结果，返回新的记录列表。"""
    records = list(records or [])
    records = [r for r in records if MARK not in _record_name(r)]

    if not text or MARK not in text:
        return records

    has_military = any(_record_name(r) == MILITARY for r in records)
    added = []

    for item in _split_items(text):
        name, teacher, week_str = _parse_item(item)
        if not name:
            continue
        weeks = parse_weeks(week_str) if week_str else []
        if not weeks:
            continue

        if name == MILITARY:
            if has_military:
                continue
            added.append(_build(name, teacher, weeks, '星期一', (1, 2), item))
            continue

        span = None
        weekday = None
        for record in records:
            other = _record_name(record)
            if not other:
                continue
            if not (other == name or name in other or other in name):
                continue
            span = _sections_of(record)
            if not span:
                continue
            weekday = str(record.get('weekday') or record.get('day') or '星期一')
            break
        if not span or not weekday:
            continue  # 没有同名课程，暂不产出
        added.append(_build(name, teacher, weeks, weekday, span, item))

    return records + added
