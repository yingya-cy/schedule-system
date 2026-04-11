"""
课程数据清洗器
包含终极完美清洗算法V3
"""

import re


def clean_schedule_ultimate(ai_extracted_json):
    """
    终极完美清洗算法V3：时序倒流 + 时间区间重叠检测 + 表头星期校验 + 大间隔换天检测 + 超大跨度课程重复模式检测
    解决单元格内部乱序问题（如10-11和9-11在同一天同一单元格）
    解决跨天重叠问题（如星期二1-8节，星期三3-4节）
    解决超大跨度课程重复模式问题（如1-8节课程重复输出，中间插入其他课程）
    核心原则：表头节数信息不可靠，优先使用课程信息中的准确节数
    新增：基于用户提出的方案，根据重复输出次数判断是否为同一天课程
    """
    
    # 判断是否为超大跨度课程（跨度≥6节）
    def is_super_wide_course(section_str):
        if not section_str: return False
        match = re.search(r'(\d+)\s*-\s*(\d+)', str(section_str))
        if match:
            start = int(match.group(1))
            end = int(match.group(2))
            span = end - start + 1  # 计算跨度（包含两端）
            return span >= 6  # 跨度≥6节定义为超大跨度课程
        return False
    
    class SuperWideTracker:
        """超大跨度课程追踪器"""
        def __init__(self):
            self.reset()
        
        def reset(self):
            """重置追踪器状态"""
            self.active = False  # 是否正在追踪
            self.super_wide_course = None  # 当前追踪的超大跨度课程
            self.repeat_count = 0  # 重复次数
            self.interrupt_count = 0  # 打断次数
            self.expected_repeats = 4  # 期望的重复次数（1-8节应该是4次）
            self.super_start = 0  # 超大跨度课程开始节次
            self.super_end = 0  # 超大跨度课程结束节次
        
        def start_tracking(self, course):
            """开始追踪新的超大跨度课程"""
            self.active = True
            self.super_wide_course = course
            self.repeat_count = 1
            self.interrupt_count = 0
            
            # 提取时间范围
            section = course.get('section', '')
            match = re.search(r'(\d+)\s*-\s*(\d+)', section)
            if match:
                self.super_start = int(match.group(1))
                self.super_end = int(match.group(2))
        
        def is_same_super_wide(self, course):
            """检查是否为相同的超大跨度课程"""
            if not self.super_wide_course:
                return False
            
            return (course.get('course_name') == self.super_wide_course.get('course_name') and
                    course.get('section') == self.super_wide_course.get('section'))
        
        def is_within_time_range(self, course):
            """检查课程是否在超大跨度课程的时间范围内"""
            if not self.active:
                return False
            
            section = course.get('section', '')
            match = re.search(r'(\d+)\s*-\s*(\d+)', section)
            if not match:
                return False
            
            course_start = int(match.group(1))
            course_end = int(match.group(2))
            
            return (course_start >= self.super_start and course_end <= self.super_end)
        
        def process_course(self, course, curr_header_day=0, last_header_day=0, interval=0):
            """
            处理课程，返回是否应该跳过换天
            新增参数：curr_header_day, last_header_day, interval 用于更精确的判断
            """
            if not self.active:
                # 检查是否是新的超大跨度课程
                if is_super_wide_course(course.get('section', '')):
                    self.start_tracking(course)
                    return False  # 超大跨度课程本身不需要跳过换天
                return False
            
            # 正在追踪超大跨度课程
            if self.is_same_super_wide(course):
                # 相同的超大跨度课程，重复次数增加
                self.repeat_count += 1
                
                # 检查是否完成期望的重复次数
                if self.repeat_count + self.interrupt_count >= self.expected_repeats:
                    self.reset()
                
                return False  # 超大跨度课程本身不需要跳过换天
            
            # 不同的课程，检查是否在时间范围内
            if self.is_within_time_range(course):
                # 【新增】边界条件检查：如果满足以下条件，即使课程在时间范围内，也不跳过换天
                should_skip = True
                
                # 条件1：表头明确指示换天（表头星期不同）
                if curr_header_day != 0 and last_header_day != 0 and curr_header_day != last_header_day:
                    # 表头明确指示换天，优先信任表头
                    should_skip = False
                    self.reset()  # 表头不同，结束当前追踪
                
                # 条件2：间隔特别大（>6节），即使课程在时间范围内也强制换天
                elif interval > 6:  # 特别大间隔阈值
                    # 同一天内不太可能有这么大的间隔，很可能是跨天了
                    should_skip = False
                    self.reset()  # 间隔太大，结束当前追踪
                
                # 条件3：课程名称完全不同，可能不是真正的打断课程
                elif (self.super_wide_course and 
                      course.get('course_name') != self.super_wide_course.get('course_name')):
                    # 课程名称不同，需要进一步判断
                    # 这里可以添加更多判断条件，比如教师、教室等是否相同
                    pass
                
                if should_skip:
                    # 在时间范围内，是打断课程
                    self.interrupt_count += 1
                    
                    # 检查是否完成期望的重复次数
                    if self.repeat_count + self.interrupt_count >= self.expected_repeats:
                        self.reset()
                    
                    return True  # 打断课程应该跳过换天
                else:
                    # 不跳过换天，结束当前追踪
                    self.reset()
                    return False
            
            # 不在时间范围内，结束当前追踪
            self.reset()
            return False
    
    # 从课程信息中提取节数范围（这是准确的信息）
    def get_section_range(section_str):
        if not section_str: return [999, 999]
        match = re.search(r'(\d+)\s*-\s*(\d+)', str(section_str))
        if match: return [int(match.group(1)), int(match.group(2))]
        match_single = re.search(r'(\d+)', str(section_str))
        if match_single: return [int(match_single.group(1)), int(match_single.group(1))]
        return [999, 999]
    
    # 只从表头中提取星期信息（汉字部分），忽略可能错误的节数信息
    def get_weekday_from_header(header_str):
        if not header_str: return 0
        # 只匹配星期汉字，忽略后面的所有内容
        if "一" in header_str: return 1
        if "二" in header_str: return 2
        if "三" in header_str: return 3
        if "四" in header_str: return 4
        if "五" in header_str: return 5
        return 0
    
    # 从表头中提取节次信息（当单元格内没有节次信息时使用）
    def get_section_from_header(header_str):
        if not header_str: return ""
        # 尝试从表头中提取节次信息，如"一/1-2"中的"1-2"
        match = re.search(r'[/\-](\d+\s*-\s*\d+)', str(header_str))
        if match:
            return match.group(1) + "节"
        return ""
    
    # 判断两个时间段是否有重叠/包含关系
    def is_overlap(start1, end1, start2, end2):
        return max(start1, start2) <= min(end1, end2)
    
    cleaned_data = []
    
    current_computed_weekday = 1  
    last_start = -1
    last_end = -1
    last_header_day = 0
    just_flipped_day = False
    
    # 新增：超大跨度课程追踪器
    super_wide_tracker = SuperWideTracker()
    
    for idx, course in enumerate(ai_extracted_json):
        if not course or course.get("course_name") == "超宽课程":
            continue
            
        # 从课程信息中获取准确的节数范围
        # 优先使用单元格内的节次信息，如果没有则使用表头节次作为兜底
        cell_section = course.get("section", "")
        if not cell_section:
            # 单元格内没有节次信息，使用表头节次作为兜底
            cell_section = get_section_from_header(course.get("_debug_header", ""))
            # 更新course中的section字段
            course["section"] = cell_section
        
        curr_start, curr_end = get_section_range(cell_section)
        
        # 从表头中提取星期信息（只使用汉字部分）
        curr_header_text = course.get("_debug_header", "")
        curr_header_day = get_weekday_from_header(curr_header_text)
        
        should_flip_day = False
        
        # 【新增】表头星期校验：如果表头指示的星期大于当前计算的星期，直接更新
        if curr_header_day > current_computed_weekday:
            # 表头明确指示了更大的星期数，直接跳转到该星期
            current_computed_weekday = curr_header_day
            just_flip_day = True  # 标记为刚刚换天
            # 重置重叠检测状态
            last_start = curr_start
            last_end = curr_end
        
        # 计算节数间隔（用于超大跨度课程检测）
        interval = 0
        if last_end != 999 and curr_start != 999:
            interval = last_end - curr_start
        
        # 【核心】超大跨度课程模式检测
        # 传递表头信息和间隔，用于更精确的判断
        should_skip_for_super_wide = super_wide_tracker.process_course(
            course, curr_header_day, last_header_day, interval
        )
        
        # 【核心判定逻辑V3 - 集成超大跨度课程检测】
        
        # 情况1：发生了时间倒流（基于准确的课程节数）
        if curr_start < last_start:
            should_flip_day = True
            
            # 【规则1】如果当前课程是被打断的课程，且应该跳过换天，则给予免死
            if should_skip_for_super_wide:
                should_flip_day = False
            else:
                # 原有的免死逻辑
                need_mercy = False
                
                # --- 情况1a：表头星期不同 ---
                # 如果表头星期不同，优先换天（不给予免死）
                if curr_header_day != 0 and curr_header_day != last_header_day:
                    # 表头星期不同，坚持换天
                    pass
                    
                # --- 情况1b：表头星期相同 + 时间重叠 ---
                # 只有同时满足这两个条件才给予免死（解决10-11和9-11乱序问题）
                elif curr_header_day != 0 and curr_header_day == last_header_day:
                    if last_start != 999 and curr_start != 999:
                        if is_overlap(last_start, last_end, curr_start, curr_end):
                            need_mercy = True
                        # 表头相同但时间不重叠，坚持换天
                    # 表头相同但节数无效，坚持换天
                        
                # --- 情况1c：没有表头信息，只有时间重叠 ---
                elif curr_header_day == 0 and last_start != 999 and curr_start != 999:
                    if is_overlap(last_start, last_end, curr_start, curr_end):
                        need_mercy = True
                    # 无表头且时间不重叠，坚持换天
                
                # 应用免死决定
                if need_mercy:
                    should_flip_day = False
        
        # 情况2：时间相等（如3-4节和3-4节）
        elif curr_start == last_start and curr_start != 999:
            # 此时看表头星期是否变化
            if curr_header_day > current_computed_weekday:
                current_computed_weekday = curr_header_day
                should_flip_day = True  # 表头指示换天
            elif course.get("weekday", 1) > current_computed_weekday and curr_header_day == 0:
                # 没表头的话，信任大模型的推断
                current_computed_weekday = course.get("weekday")
                should_flip_day = True
        
        # 情况3：大间隔强制换天检测（解决跨天重叠问题）
        # 例如：星期二的1-8节，星期三的3-4节
        elif last_end != 999 and curr_start != 999:
            # 使用前面计算的interval
            # 如果间隔过大（如从8节到3节，间隔5节），考虑强制换天
            if interval > 4:  # 阈值设为4节
                should_flip_day = True
                # 【规则2】如果当前课程是被打断的课程，且应该跳过换天，则给予免死
                if should_skip_for_super_wide:
                    should_flip_day = False
                else:
                    # 原有的表头检查逻辑
                    if curr_header_day != 0 and curr_header_day == last_header_day:
                        # 表头相同，可能不是换天
                        # 但是：如果间隔特别大（>6节），即使表头相同也强制换天
                        # 因为同一天内不太可能有这么大的间隔
                        if interval <= 6:  # 中等间隔（4-6节），保留表头保护
                            should_flip_day = False
                        # 特别大间隔（>6节），即使表头相同也换天

        # ---------------- 判定完毕执行操作 ----------------
        
        if should_flip_day:
            current_computed_weekday += 1
            just_flipped_day = True  # 标记刚刚换天
            
        # 防跨列漏跳保护（兜底跟随大模型跳过无课的整天）
        ai_weekday = course.get("weekday", current_computed_weekday)
        if isinstance(ai_weekday, int) and current_computed_weekday < ai_weekday <= 5:
            current_computed_weekday = ai_weekday
            just_flipped_day = True  # AI指示换天，也标记为刚刚换天
              
        # 封顶保护
        if current_computed_weekday > 5:
            current_computed_weekday = 5

        # 写回清洗结果
        course["weekday"] = current_computed_weekday
        
        if 'week' in course and 'weeks_list' not in course:
            course['weeks_list'] = convert_week_to_list(course.get('week'))
        
        cleaned_data.append(course)
        
        # 更新追踪器
        if curr_start != 999:
            # 如果刚刚换天，重置重叠检测状态
            if just_flipped_day:
                last_start = curr_start
                last_end = curr_end
                just_flipped_day = False  # 重置标记
            else:
                last_start = curr_start
                last_end = curr_end
            
            if curr_header_day != 0:
                last_header_day = curr_header_day

    return cleaned_data

def convert_week_to_list(week_data):
    """
    将 AI 返回的 week 对象转换为 weeks_list 数组
    支持格式：
    - {"type":"range", "start":1, "end":16, "rule":"all"} -> [1,2,3,...,16]
    - {"type":"range", "start":1, "end":8, "rule":"odd"} -> [1,3,5,7]
    - {"type":"range", "start":2, "end":8, "rule":"even"} -> [2,4,6,8]
    - {"type":"multi_range", "ranges": [...], "rule":"all"} -> 合并所有范围
    - {"type":"list", "weeks":[3,7]} -> [3,7]
    """
    if not week_data:
        return []
    
    if isinstance(week_data, list):
        return week_data
    
    if isinstance(week_data, str):
        return []
    
    if not isinstance(week_data, dict):
        return []
    
    week_type = week_data.get('type')
    
    if week_type == 'list':
        return sorted(week_data.get('weeks', []))
    
    if week_type == 'range':
        start = week_data.get('start', 1)
        end = week_data.get('end', 1)
        rule = week_data.get('rule', 'all')
        
        if rule == 'odd':
            return list(range(start, end + 1, 2))
        elif rule == 'even':
            first = start if start % 2 == 0 else start + 1
            return list(range(first, end + 1, 2))
        else:
            return list(range(start, end + 1))
    
    if week_type == 'multi_range':
        ranges = week_data.get('ranges', [])
        rule = week_data.get('rule', 'all')
        weeks = set()
        
        for r in ranges:
            start = r.get('start', 1)
            end = r.get('end', 1)
            
            if rule == 'odd':
                weeks.update(range(start, end + 1, 2))
            elif rule == 'even':
                first = start if start % 2 == 0 else start + 1
                weeks.update(range(first, end + 1, 2))
            else:
                weeks.update(range(start, end + 1))
        
        return sorted(weeks)
    
    return []


def enrich_footer_courses(courses):
    if not courses: return []
    master_map = {} 
    for c in courses:
        name = c.get('course_name')
        if name and c.get('weekday') and c.get('section'):
            master_map[name] = c
            
    for c in courses:
        name = c.get('course_name')
        if name in master_map and (not c.get('weekday') or not c.get('section')):
            master = master_map[name]
            if not c.get('weekday'): c['weekday'] = master.get('weekday')
            if not c.get('section'): c['section'] = master.get('section')
            if not c.get('classroom'): c['classroom'] = master.get('classroom')
            if not c.get('teacher'): c['teacher'] = master.get('teacher')
            c['remark'] = (c.get('remark') or '') + " [已从主表补全元数据]"
        
        if 'week' in c and 'weeks_list' not in c:
            c['weeks_list'] = convert_week_to_list(c.get('week'))
    
    return courses