import unittest
from pathlib import Path
from unittest.mock import patch

from utils.pdf_plumber_parser import (
    _complete_pending_weeks,
    _extract_course_name_from_block,
    _has_time_info,
    _parse_cell_text,
    _parse_weeks_to_list,
    parse_vertical_pdf_with_plumber,
)


class FakePage:
    def __init__(self, table):
        self._table = table

    def extract_tables(self):
        return [self._table]

    def extract_text(self):
        return ""


class FakePdf:
    def __init__(self, pages):
        self.pages = pages

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        return False


class CrossPageWeeksTests(unittest.TestCase):
    def test_accepts_period_without_section_suffix(self):
        records = _parse_cell_text(
            "Data Structures\n(1-2)1-4\u5468"
        )
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["period"], "1-2\u8282")
        self.assertEqual(records[0]["weeks_list"], [1, 2, 3, 4])

    def test_expands_range_with_week_prefix(self):
        self.assertEqual(_parse_weeks_to_list("\u7b2c1-4\u5468"), [1, 2, 3, 4])

    def test_week_range_is_not_mistaken_for_period_without_suffix(self):
        self.assertFalse(_has_time_info("9\u5468(\u5355),10-16\u5468"))
        self.assertTrue(_has_time_info("(1-2)1-4\u5468"))

    def test_completes_week_range_from_next_page_prefix(self):
        course = "Java\u9762\u5411\u5bf9\u8c61\u7a0b\u5e8f\u8bbe\u8ba1"
        fake_pdf = FakePdf([
            FakePage([
                ["\u661f\u671f\u4e09"],
                [course + "\u25c6\n(9-11\u8282)1-2\u5468,4-6\u5468(\u53cc),7-"],
            ]),
            FakePage([
                ["9\u5468(\u5355),10-16\u5468/\u6821\u533a:\u767d\u4e91\u6821\u533a/\u573a\u5730:\u4e09\u6559205"],
            ]),
        ])

        with patch("utils.pdf_plumber_parser.pdfplumber.open", return_value=fake_pdf):
            records = parse_vertical_pdf_with_plumber("unused.pdf")

        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["course"], course)
        self.assertEqual(records[0]["weeks"], "1-2\u5468,4-6\u5468(\u53cc),7-9\u5468(\u5355),10-16\u5468")
        self.assertEqual(
            records[0]["weeks_list"],
            [1, 2, 4, 6, 7, 9, 10, 11, 12, 13, 14, 15, 16],
        )

    def test_merges_standalone_prefixed_week_range_from_next_page(self):
        course = "Data Structures"
        fake_pdf = FakePdf([
            FakePage([
                ["\u661f\u671f\u4e09"],
                [course + "\n(1-2\u8282)1-2\u5468"],
            ]),
            FakePage([["\u7b2c10-16\u5468"]]),
        ])

        with patch("utils.pdf_plumber_parser.pdfplumber.open", return_value=fake_pdf):
            records = parse_vertical_pdf_with_plumber("unused.pdf")

        self.assertEqual(len(records), 1)
        self.assertEqual(
            records[0]["weeks_list"],
            [1, 2, 10, 11, 12, 13, 14, 15, 16],
        )

    def test_rejects_page_overflow_metadata_as_course_name(self):
        fragment = (
            "\u5468\u971e/\u6559\u5b66\u73ed\u5f62\u52bf\u4e0e\u653f\u7b56\uff081\uff09\u4e0a-0074/"
            "\u6559\u5b66\u73ed\u7ec4\u6210:25\u8ba1\u79d1\u56fd\u96451/\u8003\u6838\u65b9\u5f0f:\u8003\u67e5"
        )
        self.assertEqual(_extract_course_name_from_block(fragment), "")

    def test_keeps_pending_state_when_next_cell_starts_with_range(self):
        records = [{"weeks": "1-2\u5468", "weeks_list": [1, 2]}]
        pending = {0: {"record_idx": 0, "prefix": "7"}}

        completed = _complete_pending_weeks(
            records,
            pending,
            0,
            "9-10\u5468/\u6821\u533a:\u767d\u4e91\u6821\u533a",
        )

        self.assertFalse(completed)
        self.assertIn(0, pending)
        self.assertEqual(records[0]["weeks_list"], [1, 2])

    def test_keeps_pending_state_for_malformed_continuation(self):
        malformed = [
            "9\u5468(\u5355",
            "9\u5468,garbage",
            "9\u5468foo",
        ]
        for cell in malformed:
            with self.subTest(cell=cell):
                records = [{"weeks": "1-2\u5468", "weeks_list": [1, 2]}]
                pending = {0: {"record_idx": 0, "prefix": "7"}}

                completed = _complete_pending_weeks(
                    records, pending, 0, cell
                )

                self.assertFalse(completed)
                self.assertIn(0, pending)
                self.assertEqual(records[0]["weeks_list"], [1, 2])

    def test_completes_prefixed_single_week_endpoint(self):
        records = [{"weeks": "1-2\u5468", "weeks_list": [1, 2]}]
        pending = {0: {"record_idx": 0, "prefix": "7"}}

        completed = _complete_pending_weeks(
            records,
            pending,
            0,
            "\u7b2c9\u5468(\u5355),10-16\u5468/\u6821\u533a:\u767d\u4e91\u6821\u533a",
        )

        self.assertTrue(completed)
        self.assertNotIn(0, pending)
        self.assertEqual(
            records[0]["weeks_list"],
            [1, 2, 7, 9, 10, 11, 12, 13, 14, 15, 16],
        )

    def test_cheng_guo_source_pdf_keeps_all_cross_page_weeks(self):
        path = (
            Path.home()
            / "Desktop"
            / "\u670b\u8f88"
            / "\u7b2c\u4e03\u5c4a\u670b\u8f88"
            / "\u8bfe\u8868"
            / "\u5916\u8054\u90e8\u8bfe\u8868_PDF_20261014"
            / "\u7a0b\u679c.pdf"
        )
        if not path.exists():
            self.skipTest("source PDF unavailable")

        records = parse_vertical_pdf_with_plumber(str(path))
        matches = [
            row for row in records
            if row["course"] == "Java\u9762\u5411\u5bf9\u8c61\u7a0b\u5e8f\u8bbe\u8ba1"
            and row["day"] == "\u661f\u671f\u4e09"
            and row["period"] == "9-11\u8282"
        ]
        self.assertEqual(len(matches), 1)
        self.assertEqual(
            matches[0]["weeks_list"],
            [1, 2, 4, 6, 7, 9, 10, 11, 12, 13, 14, 15, 16],
        )


if __name__ == "__main__":
    unittest.main()
