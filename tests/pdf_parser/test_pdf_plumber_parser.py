import os
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from utils.pdf_plumber_parser import (
    _extract_course_name_from_block,
    _parse_coded_table,
    _parse_cell_text,
    parse_vertical_pdf_with_plumber,
)


class PdfParserRegressionTests(unittest.TestCase):
    def test_course_name_starting_with_second_is_not_discarded(self):
        self.assertEqual(_extract_course_name_from_block('第二外国语Ⅲ★'), '第二外国语Ⅲ')
        self.assertEqual(_extract_course_name_from_block('第二语言习得★'), '第二语言习得')
        self.assertEqual(_extract_course_name_from_block('第一外国语Ⅰ★'), '第一外国语Ⅰ')
        self.assertEqual(_extract_course_name_from_block('理论力学★'), '理论力学')

    def test_year_range_in_title_is_not_a_period(self):
        cell = '中国共产党红色革命三十年史（1919-1949）★\n(9-11节)6-16周/校区:白云校区'
        courses = _parse_cell_text(cell)
        self.assertEqual(len(courses), 1)
        self.assertEqual(courses[0]['course'], '中国共产党红色革命三十年史（1919-1949）')
        self.assertEqual(courses[0]['period'], '9-11节')
        self.assertEqual(courses[0]['weeks_list'], list(range(6, 17)))

    def test_course_after_previous_page_metadata_is_recovered(self):
        cell = (
            '班组成:25电信1;25电信2/考\n'
            '核方式:考试/选课备注:/课\n'
            '程学时组成:理论:42,实验\n'
            ':6/周学时:3/总学时:40/学分\n'
            ':3.0\n信号与系统★\n'
            '(9-11节)1-4周,6-12周/校区:白云校区'
        )
        courses = _parse_cell_text(cell)
        self.assertEqual(len(courses), 1)
        self.assertEqual(courses[0]['course'], '信号与系统')

    def test_unpaired_course_name_after_other_classes_is_preserved(self):
        cell = (
            '人工智能基础★\n(3-4节)1-16周/校区:白云校区/'
            '学分:2.0\n创新与创业基础★'
        )
        self.assertEqual(_parse_cell_text(cell)[0]['course'], '人工智能基础')
        self.assertEqual(_extract_course_name_from_block(cell.split('学分:2.0')[-1]), '创新与创业基础')

    def test_unpaired_course_name_without_star_is_preserved(self):
        cell = (
            '创新与创业基础★\n(5-6节)第17周/校区:白云校区/'
            '学分:2.0\n毛泽东思想和中国特色\n社会主义理论体系概论'
        )
        trailing = cell.split('(5-6节)')[-1]
        self.assertEqual(
            _extract_course_name_from_block(trailing),
            '毛泽东思想和中国特色社会主义理论体系概论',
        )

    def test_coded_table_keeps_each_entry_and_week_range(self):
        table = [
            [None, None, '星期一', '星期二'],
            [None, None, '课程甲/123456789/(1-2节)1-2周/教室', None],
            [None, None, None, '课程乙/987654321/(9-11节)第15周/教室'],
        ]
        records = _parse_coded_table(table)
        self.assertEqual(len(records), 2)
        self.assertEqual(records[0]['course'], '课程甲')
        self.assertEqual(records[0]['weeks_list'], [1, 2])
        self.assertEqual(records[1]['day'], '星期二')
        self.assertEqual(records[1]['period'], '9-11节')
        self.assertEqual(records[1]['weeks_list'], [15])

    def test_coded_second_course_name_excludes_previous_location(self):
        table = [
            [None, None, '星期一'],
            [None, None, '课程甲/123456789/(1-2节)1-2周/地点:一教\n教师:甲\n课程乙/987654321/(3-4节)3-4周/二教'],
        ]
        records = _parse_coded_table(table)
        self.assertEqual([record['course'] for record in records], ['课程甲', '课程乙'])

    def test_completed_course_clears_stale_cross_page_pending_name(self):
        first = MagicMock()
        first.extract_tables.return_value = [[[None, None, '星期一'], [None, None, '课程甲★']]]
        first.extract_text.return_value = ''
        second = MagicMock()
        second.extract_tables.return_value = [[
            [None, None, '课程甲★\n(1-2节)1-2周/校区:白云校区'],
            [None, None, '(3-4节)第3周/校区:白云校区'],
        ]]
        second.extract_text.return_value = ''
        opened = MagicMock()
        opened.__enter__.return_value.pages = [first, second]
        with patch('utils.pdf_plumber_parser.pdfplumber.open', return_value=opened):
            records = parse_vertical_pdf_with_plumber('unused.pdf')
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]['course'], '课程甲')

    def test_mixed_coded_table_is_not_accepted_as_partial_success(self):
        page = MagicMock()
        page.extract_tables.return_value = [[
            [None, None, '星期一'],
            *[
                [None, None, f'课程甲/123456789/(1-2节)第{week}周/教室']
                for week in range(1, 6)
            ],
            [None, None, '普通课程★\n(3-4节)第6周/教室'],
        ]]
        opened = MagicMock()
        opened.__enter__.return_value.pages = [page]
        with patch('utils.pdf_plumber_parser.pdfplumber.open', return_value=opened):
            with self.assertRaisesRegex(ValueError, '混有未识别课程'):
                parse_vertical_pdf_with_plumber('unused.pdf')

    def test_cross_page_and_second_language_from_original_pdfs(self):
        root = os.environ.get('SCHEDULE_PDF_ROOT')
        if not root:
            self.skipTest('SCHEDULE_PDF_ROOT is not set')

        cases = [
            ('策划部课表/曾思阳.pdf', '第二外国语Ⅲ', '星期五', '1-2节', 16),
            ('策划部课表/曾思阳.pdf', '第二语言习得', '星期二', '3-4节', 17),
            ('秘书部课表/吴俊鹏.pdf', '创新与创业基础', '星期三', '7-8节', 16),
            ('秘书部课表/吴俊鹏.pdf', '信号与系统', '星期三', '9-11节', 12),
            ('策划部课表/杨悦希.pdf', '中国共产党红色革命三十年史（1919-1949）', '星期二', '9-11节', 16),
            ('策划部课表/周家乐.pdf', '理论力学', '星期二', '1-2节', 17),
            ('策划部课表/周家乐.pdf', '理论力学', '星期日', '1-2节', 2),
            ('策划部课表/周家乐.pdf', '毛泽东思想和中国特色社会主义理论体系概论', '星期二', '6-8节', 16),
        ]
        cache = {}
        for relative_path, course, day, period, last_week in cases:
            path = Path(root) / relative_path
            self.assertTrue(path.is_file(), path)
            if path not in cache:
                cache[path] = parse_vertical_pdf_with_plumber(str(path))
            self.assertTrue(
                any(
                    r['course'] == course and r['day'] == day and
                    r['period'] == period and last_week in r['weeks_list']
                    for r in cache[path]
                ),
                (relative_path, course, day, period, last_week),
            )

    def test_coded_timetable_from_original_pdf(self):
        root = os.environ.get('SCHEDULE_PDF_ROOT')
        if not root:
            self.skipTest('SCHEDULE_PDF_ROOT is not set')
        path = Path(root) / '网编部课表/邓煌柏.pdf'
        records = parse_vertical_pdf_with_plumber(str(path))
        self.assertEqual(len(records), 20)  # 19 grid entries plus one intentional other course
        self.assertTrue(any(
            record['course'] == '高等数学I(上)' and
            record['day'] == '星期四' and
            record['period'] == '9-11节' and
            record['weeks_list'] == [15]
            for record in records
        ))


if __name__ == '__main__':
    unittest.main()
