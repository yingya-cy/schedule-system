"""
竖向PDF课表解析器
使用pdfplumber库解析竖向排列的PDF课表
"""

import re
import pdfplumber
import logging

logger = logging.getLogger(__name__)

DAY_NAMES = ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日']


def _extract_course_name_from_block(raw_course):
    lines = raw_course.strip().split('\n')
    valid_lines = []
    garbage_pattern = re.compile(r'^(?:[:：\d/★☆■◆\(（（])|^(?:周学时|总学时|学分|理论|实践|注|选课|备注|第一|第[二三四五六七八九十]|考核)')
    for line in lines:
        line = line.strip()
        if not line: continue
        if garbage_pattern.match(line): continue
        if len(line) == 1 and not re.match(r'[\u4e00-\u9fa5]', line): continue
        valid_lines.append(line)
    course = ''.join(valid_lines)
    course = re.sub(r'[★☆■◆\n]', '', course).strip()
    return course


def _parse_cell_text(raw_text):
    if not raw_text or not raw_text.strip(): return []
    text = raw_text.strip()
    results = []
    parts = re.split(r'\n?\s*[（\(](\d+-\d+节?)[）\)]\s*', text)
    if len(parts) < 3: return []
    for i in range(1, len(parts), 2):
        period = parts[i]
        if not period.endswith('节'): period += '节'
        if i == 1:
            raw_course = parts[0]
            credit_matches = list(re.finditer(r'学\s*\n?\s*分\s*\n?\s*[:：]\s*\n?\s*\d+(?:\.\d+)?\s*\n?', raw_course))
            if credit_matches: raw_course = raw_course[credit_matches[-1].end():]
            course = _extract_course_name_from_block(raw_course)
        else:
            prev_block = parts[i-1]
            credit_matches = list(re.finditer(r'学\s*\n?\s*分\s*\n?\s*[:：]\s*\n?\s*\d+(?:\.\d+)?\s*\n?', prev_block))
            if credit_matches:
                split_idx = credit_matches[-1].end()
                raw_course = prev_block[split_idx:]
            else:
                lines = prev_block.strip().split('\n')
                raw_course = '\n'.join(lines[-3:]) if len(lines) >= 3 else prev_block
            course = _extract_course_name_from_block(raw_course)
        if not course or len(course) < 2: continue
        rest_and_next = parts[i+1] if i+1 < len(parts) else ""
        credit_matches = list(re.finditer(r'学\s*\n?\s*分\s*\n?\s*[:：]\s*\n?\s*\d+(?:\.\d+)?', rest_and_next))
        rest = rest_and_next[:credit_matches[-1].end()] if credit_matches else rest_and_next
        weeks_match = re.search(r'(\d+-\d+周|\d+周)', rest)
        results.append({
            'course': course, 'period': period, 'weeks': weeks_match.group(1) if weeks_match else '',
            'teacher': '', 'location': '', 'is_fragment': False
        })
    return results


def parse_vertical_pdf_with_plumber(pdf_path):
    records = []
    col_to_day = {} 
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page_num, page in enumerate(pdf.pages):
                tables = page.extract_tables()
                if not tables: continue
                table = tables[0]
                for row_idx, row in enumerate(table):
                    if not col_to_day:
                        for col_idx, cell in enumerate(row):
                            if cell and isinstance(cell, str):
                                for day in DAY_NAMES:
                                    if day in cell.strip(): col_to_day[col_idx] = day; break
                        if col_to_day: continue
                    for col_idx, cell in enumerate(row):
                        if col_idx in col_to_day:
                            for parsed in _parse_cell_text(cell):
                                parsed['day'] = col_to_day[col_idx]
                                records.append(parsed)
        
        full_text = '\n'.join([page.extract_text() or '' for page in pdf.pages])
        other_match = re.search(r'其他课程[：:](.*?)(?=\n[★☆■◆(]|$)', full_text, re.DOTALL)
        if other_match:
            other_text = other_match.group(1).replace('\n', '').strip()
            for item in other_text.split(';'):
                if not item.strip(): continue
                c_name = re.match(r'^([^★☆■◆(（]+)', item.strip()).group(1).strip()
                w_str = (re.search(r'/([^/]+(?:周))', item) or re.Match()).group(1) if re.search(r'/([^/]+(?:周))', item) else ''
                found_d, found_p = '其他', '其他时间'
                for r in records:
                    if r['course'] == c_name: found_d, found_p = r['day'], r['period']; break
                records.append({ 'course': c_name, 'period': found_p, 'day': found_d, 'weeks': w_str, 'teacher': '', 'location': '', 'is_fragment': False })
    except Exception as e: 
        logger.error(f'pdfplumber failed: {e}')
        raise
    return records


# PDF类型检测函数
def detect_pdf_type_from_text(text: str) -> str:
    """
    检测PDF类型（竖型/横型）
    核心探测特征：竖版PDF由于表格结构，"星期一"等表头会被提取并且全部挤在同一行
    """
    tight_days_pattern = re.compile(r'星期一\s*星期二\s*星期三\s*星期四\s*星期五', re.IGNORECASE)
    raw_text_compact = text.replace('\n', ' ').replace('\t', ' ')
    
    if tight_days_pattern.search(raw_text_compact) or '时间段 节次' in raw_text_compact:
        return 'vertical'
    else:
        return 'horizontal'