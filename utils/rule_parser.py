import re

def clean_course_name(name):
    # 移除开头的非中英文特殊字符
    name = re.sub(r'^[^\u4e00-\u9fa5a-zA-Z]+', '', name)
    return name.strip()

def parse_weeks(s):
    if not s:
        return []
    s = s.replace('周', '')
    parts = s.split(',')
    weeks = []
    for p in parts:
        p = p.strip()
        if not p:
            continue
        if '-' in p:
            parts_dash = p.split('-')
            if len(parts_dash) == 2:
                try:
                    start, end = int(parts_dash[0]), int(parts_dash[1])
                    for i in range(start, end + 1):
                        weeks.append(i)
                except ValueError:
                    pass
        else:
            try:
                weeks.append(int(p))
            except ValueError:
                pass
    return sorted(list(set([w for w in weeks if not isinstance(w, float)])))

def build_record_from_text(text, day, session_raw, section_start, section_end):
    type_match = re.search(r'[★☆■◆]', text)
    c_type = type_match.group(0) if type_match else '其他'

    course_name_raw = re.sub(r'^(?:第)?\d+-\d+(?:节)?\s*', '', text)
    course_name_raw = re.split(r'[★☆■◆]', course_name_raw)[0]
    course_name_raw = re.split(r'(?:周数|教师|老师|地点|教室|校区|学分|备注|教学班)[:：]', course_name_raw)[0]
    course_name = clean_course_name(course_name_raw)

    def get_value(key):
        match = re.search(f"{key}[:：]\\s*([^\\n/]+)", text)
        return match.group(1).strip() if match else ''

    week_str = get_value('周数')
    if not week_str:
        week_match = re.search(r'((?:\d+-\d+|\d+)(?:周)(?:,(?:\d+-\d+|\d+)(?:周)?)*)', text)
        week_str = week_match.group(1) if week_match else ''
    
    weeks = parse_weeks(week_str)
    
    teacher = get_value('教师') or get_value('老师')
    
    category_map = {
        '★': 'theory',
        '☆': 'lab',
        '■': 'practice',
        '◆': 'computer'
    }
    
    weeks_str_joined = ",".join(map(str, weeks))
    
    category_map = {
        '★': 'theory',
        '☆': 'lab',
        '■': 'practice',
        '◆': 'computer'
    }
    
    return {
        "id": f"{day}-{course_name}-{section_start}-{weeks_str_joined}",
        "groupId": f"{course_name}-{teacher}",
        "course_name": course_name,
        "type": c_type,
        "category": category_map.get(c_type, 'other'),
        "weekday": day,
        "section": session_raw,
        "sectionStart": section_start,
        "sectionEnd": section_end,
        "weeks": weeks,
        "teacher": teacher,
        "classroom": get_value('地点') or get_value('教室'),
        "campus": get_value('校区'),
        "credits": get_value('学分'),
        "remark": get_value('备注') or get_value('选课备注'),
        "teachingClass": get_value('教学班'),
        "classComposition": get_value('教学班组成'),
        "examType": get_value('考核方式'),
        "hoursComposition": get_value('课程学时组成'),
        "weeklyHours": get_value('周学时'),
        "totalHours": get_value('总学时'),
        "raw": text
    }

def parse_by_rules(text):
    processed = text
    # 中文去空格
    processed = re.sub(r'([\u4e00-\u9fa5])\s+([\u4e00-\u9fa5])', r'\1\2', processed)
    # 在“学分结束 + 下一课程”之间强制换行，避免课程粘连
    processed = re.sub(r'(学分[:：][0-9.]+)\s+(?=[^\s])', r'\1\n', processed)
    # 用“节次”作为强制分割点
    processed = re.sub(r'(?<!\d)((?:第)?\d+-\d+(?:节)?\s+)', r'\n\1', processed)
    # 标记“其他课程”
    processed = re.sub(r'(其他课程|实践环节|非排课)', r'\n[SECTION_OTHER]\n\1', processed)
    # 删除无用词
    processed = re.sub(r'(上午|下午|晚上|节次)', '', processed)

    parts = processed.split('[SECTION_OTHER]')
    main_text = parts[0]
    other_text = parts[1] if len(parts) > 1 else ''

    lines = [l.strip() for l in main_text.split('\n') if l.strip()]

    days = ['星期一','星期二','星期三','星期四','星期五','星期六','星期日']
    short_days = ['周一','周二','周三','周四','周五','周六','周日']

    chunks = []
    current_day = '未知'
    current_chunk = ''
    chunk_day = '未知'

    for line in lines:
        if re.match(r'^\d+$', line):
            continue
        
        found_day = next((d for d in days if d in line), None)
        if not found_day:
            found_day = next((d for d in short_days if d in line), None)
            
        if found_day:
            current_day = found_day.replace('周','星期') if found_day.startswith('周') else found_day
            if line.strip() == found_day:
                continue

        if re.search(r'学年|学期|学号|姓名|行政班', line) and not re.search(r'学分|周数|教师|地点', line):
            continue

        is_new_course = re.match(r'^(?:第)?\d+-\d+(?:节)?', line)
        if is_new_course and current_chunk:
            chunks.append({"text": current_chunk, "day": chunk_day})
            current_chunk = line
            chunk_day = current_day
        else:
            if not current_chunk:
                chunk_day = current_day
            current_chunk += ('\n' if current_chunk else '') + line
            
    if current_chunk:
        chunks.append({"text": current_chunk, "day": chunk_day})

    records = []

    for chunk_obj in chunks:
        text_chunk, day = chunk_obj["text"], chunk_obj["day"]
        if not re.match(r'^(?:第)?\d+-\d+(?:节)?', text_chunk):
            continue

        session_match = re.match(r'^(?:第)?(\d+)-(\d+)(?:节)?', text_chunk)
        section_start = int(session_match.group(1)) if session_match else None
        section_end = int(session_match.group(2)) if session_match else None
        session_raw = f"{section_start}-{section_end}" if section_start is not None and section_end is not None else ""

        is_error = False
        error_message = ""
        if section_start is not None and section_end is not None:
            if section_end - section_start >= 8 or section_start > section_end or section_start > 14:
                is_error = True
                error_message = f"节次范围异常 ({session_raw})"

        sub_courses = []
        current_sub = ""
        chunk_lines = text_chunk.split('\n')
        for line in chunk_lines:
            has_symbol = bool(re.search(r'[★☆■◆]', line))
            starts_with_session = bool(re.match(r'^(?:第)?\d+-\d+(?:节)?', line))
            
            if has_symbol and not starts_with_session and bool(re.search(r'[★☆■◆]', current_sub)):
                sub_courses.append(current_sub)
                current_sub = line
            else:
                current_sub += ('\n' if current_sub else '') + line
                
        if current_sub:
            sub_courses.append(current_sub)

        for sub_text in sub_courses:
            final_sub_text = sub_text.strip()
            final_sub_text = re.sub(r'^(?:第)?\d+-\d+(?:节)?\s*', '', final_sub_text)
            if session_raw:
                final_sub_text = f"{session_raw}   {final_sub_text}"

            record = build_record_from_text(final_sub_text, day, session_raw, section_start, section_end)
            record["isError"] = is_error
            if is_error:
                record["errorMessage"] = error_message
            records.append(record)

    if other_text:
        clean_other = re.sub(r'(其他课程|实践环节|非排课)[:：]?', '', other_text)
        other_items = [s.strip() for s in re.split(r'[\n;；]', clean_other) if s.strip()]

        for item in other_items:
            if '打印时间' in item or '★: 理论' in item or '☆: 实验' in item:
                continue
            if re.match(r'^\d+$', item):
                continue
                
            symbol_match = re.search(r'[★☆■◆]', item)
            if not symbol_match:
                continue
                
            symbol = symbol_match.group(0)
            parts = item.split(symbol)
            course_name_raw = parts[0].strip()
            course_name = clean_course_name(course_name_raw)

            rest_parts = parts[1].split('/')
            teacher_raw = rest_parts[0] if len(rest_parts) > 0 else ''
            teacher = re.sub(r'\(.*?\)', '', teacher_raw).strip()
            week_str_other = rest_parts[1] if len(rest_parts) > 1 else ''
            weeks_other = parse_weeks(week_str_other)

            matched_record = None
            for r in records:
                if (r["course_name"] == course_name or course_name in r["course_name"] or r["course_name"] in course_name) and r["teacher"] == teacher:
                    matched_record = r
                    break
            
            if not matched_record:
                for r in records:
                    if r["course_name"] == course_name or course_name in r["course_name"] or r["course_name"] in course_name:
                        matched_record = r
                        break

            if matched_record:
                new_record = matched_record.copy()
                new_record["weeks"] = weeks_other
                new_record["type"] = symbol
                category_map = {'★': 'theory', '☆': 'lab', '■': 'practice', '◆': 'computer'}
                new_record["category"] = category_map.get(symbol, 'other')
                new_record["course_name"] = f"{matched_record['course_name']}（其他课程）"
                new_record["id"] = f"{new_record['weekday']}-{new_record['course_name']}-{new_record['sectionStart']}-{','.join(map(str, weeks_other))}"
                
                new_raw = matched_record["raw"]
                new_raw = re.sub(r'[★☆■◆]', symbol, new_raw)
                if re.search(r'周数[:：]', new_raw):
                    new_raw = re.sub(r'(周数[:：]\s*)[^\/]+', f"\\g<1>{week_str_other}", new_raw)
                else:
                    new_raw += f" / 周数: {week_str_other}"
                new_raw = new_raw.replace(matched_record["course_name"], new_record["course_name"])
                new_record["raw"] = new_raw
                records.append(new_record)
            else:
                record = build_record_from_text(item, '其他', '', None, None)
                record["course_name"] = f"{course_name}（其他课程）"
                record["weeks"] = weeks_other
                record["teacher"] = teacher
                record["type"] = symbol
                records.append(record)

    return records
