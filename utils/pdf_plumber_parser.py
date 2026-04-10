"""
竖向PDF课表解析器（最终稳定版：无教师/地点）
"""

import re
import pdfplumber
import logging

logger = logging.getLogger(__name__)

DAY_NAMES = ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日']


# =========================
# 课程名清洗（增强版）
# =========================
def _extract_course_name_from_block(raw_course):
    lines = raw_course.strip().split('\n')
    valid_lines = []

    garbage_pattern = re.compile(
        r'^(?:[:：\d/★☆■◆\(（])|^(?:周学时|总学时|学分|理论|实践|注|选课|备注|第一|第[二三四五六七八九十]|考核|组成|学时组成)'
    )

    for line in lines:
        line = line.strip()
        if not line:
            continue
        if garbage_pattern.match(line):
            continue
        if len(line) == 1 and not re.match(r'[\u4e00-\u9fa5]', line):
            continue
        valid_lines.append(line)

    course = ''.join(valid_lines)

    course = re.sub(r'(学时\s*[:：]?\s*\d+/?\d*|学分\s*[:：]?\s*\d+(\.\d+)?)', '', course)
    course = re.sub(r'(分\s*[:：]\s*\d+(?:\.\d+)?)', '', course)
    course = re.sub(r'(组成\s*[:：]\s*(?:理论|实践)\s*[:：]\s*\d+\s*/\s*周总)', '', course)
    course = re.sub(r'(学时组成\s*[:：]\s*理论\s*[:：]\s*\d+\s*,\s*实践\s*[:：]\s*\d+\s*/\s*周总)', '', course)
    course = re.sub(r'(时\s*[:：]\s*\d+\s*/)', '', course)

    course = re.sub(r'[★☆■◆\n]', '', course).strip()
    course = re.sub(r'^总', '', course)
    course = re.sub(r'^\W+', '', course)

    return course


# =========================
# 周数字符串
# =========================
def _extract_weeks_text(text):
    text_cleaned = text.replace('\n', '')
    matches = re.findall(r'\d+-\d+周(?:\([单双]\))?|\d+周(?:\([单双]\))?', text_cleaned)
    return ','.join(matches) if matches else ''


# =========================
# 周数数组
# =========================
def _parse_weeks_to_list(week_str):
    weeks = set()
    
    # 先按逗号分割，处理每个独立的周数范围
    parts = week_str.split(',')
    
    for part in parts:
        part = part.strip()
        if not part:
            continue
        
        # 检查当前部分是否有单双周标记
        week_type = None
        if '(单)' in part or '（单）' in part:
            week_type = 'odd'
        elif '(双)' in part or '（双）' in part:
            week_type = 'even'
        
        # 匹配周数范围，例如 "2-4周(双)"
        range_match = re.match(r'(\d+)-(\d+)周(?:\([单双]\))?', part)
        if range_match:
            start_num = int(range_match.group(1))
            end_num = int(range_match.group(2))
            
            if week_type == 'odd':
                # 单周：只取奇数周
                weeks.update(range(start_num, end_num + 1, 2))
            elif week_type == 'even':
                # 双周：只取偶数周
                weeks.update(range(start_num + (start_num % 2), end_num + 1, 2))
            else:
                # 没有标记，取所有周
                weeks.update(range(start_num, end_num + 1))
            continue
        
        # 匹配单个周数，例如 "16周"
        single_match = re.match(r'(\d+)周(?:\([单双]\))?', part)
        if single_match:
            weeks.add(int(single_match.group(1)))

    return sorted(weeks)


# =========================
# 单元格解析
# =========================
def _parse_cell_text(raw_text):
    if not raw_text or not raw_text.strip():
        return []

    text = raw_text.strip()
    results = []

    parts = re.split(r'\n?\s*[（\(](\d+-\d+节?)[）\)]\s*', text)

    if len(parts) < 3:
        return []

    for i in range(1, len(parts), 2):
        period = parts[i]
        if not period.endswith('节'):
            period += '节'

        if i == 1:
            raw_course = parts[0]
        else:
            prev_block = parts[i - 1]
            lines = prev_block.strip().split('\n')
            raw_course = '\n'.join(lines[-3:]) if len(lines) >= 3 else prev_block

        course = _extract_course_name_from_block(raw_course)

        if not course or len(course) < 2:
            continue

        rest = parts[i + 1] if i + 1 < len(parts) else ""

        weeks_text = _extract_weeks_text(rest)
        weeks_list = _parse_weeks_to_list(weeks_text)

        result = {
            'course': course,
            'period': period,
            'weeks': weeks_text,
            'weeks_list': weeks_list,
            'is_fragment': False
        }

        results.append(result)

    return results


# =========================
# 主解析
# =========================

def _has_time_info(text):
    """检测文本是否包含时间信息（节次）"""
    if not text:
        return False
    return bool(re.search(r'\d+-\d+节?|\d+节', text))


def _has_weeks_info(text):
    """检测文本是否包含周数信息"""
    if not text:
        return False
    return bool(re.search(r'\d+-\d+周|\d+周', text))


def _has_incomplete_weeks(text):
    """检测文本是否包含未完成的周数范围（以"数字-"结尾）"""
    if not text:
        return False
    # 检测以"数字-"结尾，后面没有数字的情况
    return bool(re.search(r'\d+-\s*$', text))


def _extract_incomplete_weeks_prefix(text):
    """提取未完成的周数前缀（例如"11-"）"""
    if not text:
        return None
    match = re.search(r'(\d+)-\s*$', text)
    if match:
        return match.group(1)
    return None


def _is_weeks_only(text):
    """检测文本是否只包含周数信息（没有课程名和时间）"""
    if not text or not text.strip():
        return False
    
    text = text.strip()
    
    # 必须有周数信息
    if not _has_weeks_info(text):
        return False
    
    # 不能有时间信息
    if _has_time_info(text):
        return False
    
    # 不能有课程名（长度较长的中文文本）
    # 提取课程名，如果为空或很短，说明没有课程名
    course = _extract_course_name_from_block(text)
    if course and len(course) >= 2:
        return False
    
    return True


def _extract_weeks_only(text):
    """提取只有周数的文本中的周数"""
    if not text:
        return None
    
    # 提取周数
    matches = re.findall(r'\d+-\d+周(?:\([单双]\))?|\d+周(?:\([单双]\))?', text)
    if matches:
        return ','.join(matches)
    
    # 检测是否是补全的周数（例如"16周"）
    match = re.match(r'^(\d+)周$', text.strip())
    if match:
        return match.group(1) + '周'
    
    return None


def _extract_pending_course_name(text):
    """提取待匹配的课程名（只有课程名，没有时间信息）"""
    if not text or not text.strip():
        return None
    
    text = text.strip()
    
    # 如果包含时间信息，说明不是待匹配的课程名
    if _has_time_info(text):
        return None
    
    # 提取课程名
    course = _extract_course_name_from_block(text)
    
    # 如果课程名太短，可能是误判
    if not course or len(course) < 2:
        return None
    
    return course


def parse_vertical_pdf_with_plumber(pdf_path):
    records = []
    col_to_day = {}
    
    # 页面缓冲区：存储待匹配的课程名
    # 格式: {列索引: {'course': 课程名, 'page': 页码, 'row': 行号}}
    pending_courses = {}
    
    # 上一页课程缓冲区：用于合并额外周数
    # 格式: {列索引: 课程记录的索引（在records中）}
    last_page_courses = {}
    
    # 未完成周数缓冲区：存储未完成的周数范围
    # 格式: {列索引: {'record_idx': 课程记录索引, 'prefix': '11'}}
    pending_weeks_completion = {}

    logger.info(f'开始解析 PDF: {pdf_path}')

    try:
        with pdfplumber.open(pdf_path) as pdf:
            logger.info(f'PDF 页数: {len(pdf.pages)}')

            for page_num, page in enumerate(pdf.pages):
                logger.info(f'\n{"="*80}')
                logger.info(f'处理第 {page_num + 1} 页')
                logger.info(f'{"="*80}')

                tables = page.extract_tables()
                logger.info(f'表格数量: {len(tables) if tables else 0}')

                if not tables:
                    continue

                table = tables[0]
                logger.info(f'行数: {len(table)}')
                
                # 调试：显示前3行表格内容（帮助诊断图片型PDF）
                logger.info(f'\n[诊断] 表格前3行内容:')
                for row_idx, row in enumerate(table[:3]):
                    logger.info(f'  行{row_idx}: {row}')

                # 当前页的课程记录（用于下一页合并）
                current_page_courses = {}

                for row_idx, row in enumerate(table):
                    if not col_to_day:
                        for col_idx, cell in enumerate(row):
                            if cell:
                                for day in DAY_NAMES:
                                    if day in cell:
                                        col_to_day[col_idx] = day
                                        logger.info(f'检测到星期: 列{col_idx} -> {day}')
                        if col_to_day:
                            continue

                    for col_idx, cell in enumerate(row):
                        if col_idx in col_to_day:
                            # 情况1：检测只有周数的单元格（额外周数）
                            if _is_weeks_only(cell):
                                extra_weeks = _extract_weeks_only(cell)
                                if extra_weeks:
                                    # 优先从上一页的课程合并
                                    if col_idx in last_page_courses:
                                        record_idx = last_page_courses[col_idx]
                                        old_weeks = records[record_idx]['weeks']
                                        new_weeks = f"{old_weeks},{extra_weeks}"
                                        records[record_idx]['weeks'] = new_weeks
                                        records[record_idx]['weeks_list'] = _parse_weeks_to_list(new_weeks)
                                        logger.info(f'合并额外周数: 列{col_idx} 课程"{records[record_idx]["course"]}" 添加周数 "{extra_weeks}"')
                                    # 其次从待补全的周数合并
                                    elif col_idx in pending_weeks_completion:
                                        pending_info = pending_weeks_completion.pop(col_idx)
                                        record_idx = pending_info['record_idx']
                                        prefix = pending_info['prefix']
                                        # 补全周数范围
                                        completed_weeks = f"{prefix}-{extra_weeks}"
                                        old_weeks = records[record_idx]['weeks']
                                        new_weeks = f"{old_weeks},{completed_weeks}"
                                        records[record_idx]['weeks'] = new_weeks
                                        records[record_idx]['weeks_list'] = _parse_weeks_to_list(new_weeks)
                                        logger.info(f'补全周数范围: 列{col_idx} 课程"{records[record_idx]["course"]}" 补全 "{prefix}-" 为 "{completed_weeks}"')
                                    else:
                                        logger.warning(f'检测到孤立的周数: 列{col_idx}, 内容: {repr(cell[:50])}')
                                continue
                            
                            # 情况2：检测待匹配的课程名（只有课程名，没有时间信息）
                            pending_course = _extract_pending_course_name(cell)
                            if pending_course:
                                # 加入缓冲区
                                pending_courses[col_idx] = {
                                    'course': pending_course,
                                    'page': page_num,
                                    'row': row_idx
                                }
                                logger.info(f'检测到待匹配课程名: 列{col_idx} -> "{pending_course}" (页{page_num+1}, 行{row_idx})')
                                continue
                            
                            # 情况3：正常解析单元格
                            parsed_list = _parse_cell_text(cell)
                            
                            # 检查单元格中是否有多个时间信息模式
                            time_patterns = re.findall(r'[（\(](\d+-\d+节?)[）\)]', cell) if cell else []
                            
                            # 如果有多个时间模式，且缓冲区有待匹配的课程名
                            if len(time_patterns) > 1 and col_idx in pending_courses:
                                # 先处理第一个时间信息（匹配缓冲区）
                                pending_info = pending_courses.pop(col_idx)
                                course_name = pending_info['course']
                                
                                logger.info(f'跨页匹配成功（多门课程）: 列{col_idx} 课程"{course_name}" (页{pending_info["page"]+1}) 匹配到时间信息 (页{page_num+1})')
                                
                                # 提取第一个时间信息
                                first_period = time_patterns[0]
                                if not first_period.endswith('节'):
                                    first_period += '节'
                                
                                # 提取第一个时间信息对应的周数
                                # 查找第一个时间信息后面的周数（直到下一个时间信息或课程名）
                                first_time_match = re.search(r'[（\(]' + re.escape(time_patterns[0]) + r'[）\)](.*?)(?=[（\(]|$)', cell, re.DOTALL)
                                if first_time_match:
                                    first_weeks_text = _extract_weeks_text(first_time_match.group(1))
                                    first_weeks_list = _parse_weeks_to_list(first_weeks_text)
                                else:
                                    first_weeks_text = ''
                                    first_weeks_list = []
                                
                                result = {
                                    'course': course_name,
                                    'period': first_period,
                                    'weeks': first_weeks_text,
                                    'weeks_list': first_weeks_list,
                                    'is_fragment': False,
                                    'day': col_to_day[col_idx]
                                }
                                records.append(result)
                                record_idx = len(records) - 1
                                current_page_courses[col_idx] = record_idx
                                logger.info(f'添加跨页课程（多门课程中的第一门）: {result}')
                                
                                # 然后正常解析剩余的课程
                                # 从第二个时间信息开始解析
                                for parsed in parsed_list:
                                    parsed['day'] = col_to_day[col_idx]
                                    records.append(parsed)
                                    record_idx = len(records) - 1
                                    current_page_courses[col_idx] = record_idx
                                    logger.info(f'添加课程（多门课程中的后续课程）: {parsed}')
                            
                            # 如果解析失败（没有课程名），但有时间和周数信息
                            elif not parsed_list and _has_time_info(cell) and _has_weeks_info(cell):
                                # 从缓冲区查找匹配的课程名
                                if col_idx in pending_courses:
                                    pending_info = pending_courses.pop(col_idx)
                                    course_name = pending_info['course']
                                    
                                    logger.info(f'跨页匹配成功: 列{col_idx} 课程"{course_name}" (页{pending_info["page"]+1}) 匹配到时间信息 (页{page_num+1})')
                                    
                                    # 提取时间和周数信息
                                    time_match = re.search(r'(\d+-\d+节?)', cell)
                                    period = time_match.group(1) if time_match else ''
                                    if period and not period.endswith('节'):
                                        period += '节'
                                    
                                    weeks_text = _extract_weeks_text(cell)
                                    weeks_list = _parse_weeks_to_list(weeks_text)
                                    
                                    result = {
                                        'course': course_name,
                                        'period': period,
                                        'weeks': weeks_text,
                                        'weeks_list': weeks_list,
                                        'is_fragment': False,
                                        'day': col_to_day[col_idx]
                                    }
                                    records.append(result)
                                    record_idx = len(records) - 1
                                    current_page_courses[col_idx] = record_idx
                                    logger.info(f'添加跨页课程: {result}')
                                    
                                    # 检测未完成的周数范围
                                    if _has_incomplete_weeks(cell):
                                        prefix = _extract_incomplete_weeks_prefix(cell)
                                        if prefix:
                                            pending_weeks_completion[col_idx] = {
                                                'record_idx': record_idx,
                                                'prefix': prefix
                                            }
                                            logger.info(f'检测到未完成的周数范围: 列{col_idx} "{prefix}-" 等待补全')
                                else:
                                    logger.warning(f'检测到时间信息但无匹配课程名: 列{col_idx}, 内容: {repr(cell[:50])}')
                            else:
                                # 正常处理
                                for parsed in parsed_list:
                                    parsed['day'] = col_to_day[col_idx]
                                    records.append(parsed)
                                    record_idx = len(records) - 1
                                    current_page_courses[col_idx] = record_idx
                                    logger.info(f'添加课程: {parsed}')
                                    
                                    # 检测未完成的周数范围
                                    if _has_incomplete_weeks(cell):
                                        prefix = _extract_incomplete_weeks_prefix(cell)
                                        if prefix:
                                            pending_weeks_completion[col_idx] = {
                                                'record_idx': record_idx,
                                                'prefix': prefix
                                            }
                                            logger.info(f'检测到未完成的周数范围: 列{col_idx} "{prefix}-" 等待补全')
                
                # 更新上一页课程缓冲区
                last_page_courses = current_page_courses.copy()
            
            # 处理缓冲区中未匹配的课程名
            if pending_courses:
                logger.warning(f'\n缓冲区中还有 {len(pending_courses)} 个未匹配的课程名:')
                for col_idx, info in pending_courses.items():
                    logger.warning(f'  列{col_idx}: "{info["course"]}" (页{info["page"]+1}, 行{info["row"]})')
            
            # 处理未完成的周数范围
            if pending_weeks_completion:
                logger.warning(f'\n缓冲区中还有 {len(pending_weeks_completion)} 个未完成的周数范围:')
                for col_idx, info in pending_weeks_completion.items():
                    logger.warning(f'  列{col_idx}: "{info["prefix"]}-" (课程: {records[info["record_idx"]]["course"]})')

        # =========================
        # 其他课程
        # =========================
        full_text = '\n'.join([page.extract_text() or '' for page in pdf.pages])

        other_match = re.search(r'其他课程[：:](.*)', full_text)

        if other_match:
            logger.info('检测到其他课程')

            other_text = other_match.group(1).replace('\n', '')

            for item in other_text.split(';'):
                if not item.strip():
                    continue

                name_match = re.match(r'^([^★☆■◆(（]+)', item.strip())
                if not name_match:
                    continue

                c_name = name_match.group(1).strip()

                week_match = re.search(r'/([^/]+周)', item)
                w_str = week_match.group(1) if week_match else ''
                weeks_list = _parse_weeks_to_list(w_str)

                found_d, found_p = '其他', '其他时间'

                for r in records:
                    if r['course'] == c_name:
                        found_d = r['day']
                        found_p = r['period']
                        break

                record = {
                    'course': c_name,
                    'period': found_p,
                    'day': found_d,
                    'weeks': w_str,
                    'weeks_list': weeks_list,
                    'is_fragment': False
                }

                records.append(record)
                logger.info(f'添加其他课程: {record}')

    except Exception as e:
        logger.error(f'解析失败: {e}', exc_info=True)
        raise

    logger.info(f'解析完成，共 {len(records)} 条')
    return records