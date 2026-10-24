import unittest
from pathlib import Path

from utils.pdf_plumber_parser import _extract_other_courses_text, parse_vertical_pdf_with_plumber


class FakePage:
    def extract_tables(self):
        return [[["\u5176\u4ed6\u8bfe\u7a0b\uff1a\u793e\u4f1a\u4e3b\u4e49\n\u7406\u8bba\u25a0\u9648\u8001\u5e08/13-14\u5468/\u65e0;"]]]

    def extract_text(self):
        return "\u5176\u4ed6\u8bfe\u7a0b\uff1a\u793e\u4f1a\u4e3b\u4e49\n\u7406\u8bba\u25a0\u9648\u8001\u5e08/13-14\u5468/\u65e0;"


class FakePdf:
    pages = [FakePage()]


class OtherCourseWrappingTests(unittest.TestCase):
    def test_uses_full_table_cell_across_line_break(self):
        self.assertEqual(
            _extract_other_courses_text(FakePdf()),
            "\u793e\u4f1a\u4e3b\u4e49\u7406\u8bba\u25a0\u9648\u8001\u5e08/13-14\u5468/\u65e0;",
        )

    def test_liu_huiling_pdf_keeps_last_other_course(self):
        path = (Path.home() / "Desktop" / "\u670b\u8f88" / "\u7b2c\u4e03\u5c4a\u670b\u8f88" /
                "\u8bfe\u8868" / "\u5ba3\u4f20\u90e8\u8bfe\u8868" / "\u5218\u6167\u73b2(1).pdf")
        if not path.exists():
            self.skipTest("source PDF unavailable")
        records = parse_vertical_pdf_with_plumber(str(path))
        matches = [row for row in records if row["course"] ==
                   "\u6bdb\u6cfd\u4e1c\u601d\u60f3\u548c\u4e2d\u56fd\u7279\u8272\u793e\u4f1a\u4e3b\u4e49\u7406\u8bba\u4f53\u7cfb\u6982\u8bba"
                   and row["weeks_list"] == [13, 14]]
        self.assertEqual(len(matches), 1)
        self.assertEqual((matches[0]["day"], matches[0]["period"]), ("\u661f\u671f\u4e94", "6-8\u8282"))

    def test_other_wrapped_source_pdfs(self):
        root = (Path.home() / "Desktop" / "\u670b\u8f88" /
                "\u7b2c\u4e03\u5c4a\u670b\u8f88" / "\u8bfe\u8868")
        cases = [
            ("\u7b56\u5212\u90e8\u8bfe\u8868", "\u5468\u5bb6\u4e50.pdf",
             "\u8d70\u5728\u524d\u5217\u7684\u5e7f\u4e1c\u5b9e\u8df5", [6, 7, 8]),
            ("\u7b56\u5212\u90e8\u8bfe\u8868", "\u5468\u5bb6\u4e50.pdf",
             "\u6bdb\u6cfd\u4e1c\u601d\u60f3\u548c\u4e2d\u56fd\u7279\u8272\u793e\u4f1a\u4e3b\u4e49\u7406\u8bba\u4f53\u7cfb\u6982\u8bba", [13, 14]),
            ("\u7f51\u7f16\u90e8\u8bfe\u8868", "\u5218\u4f9d\u6db5.pdf",
             "\u4e60\u8fd1\u5e73\u65b0\u65f6\u4ee3\u4e2d\u56fd\u7279\u8272\u793e\u4f1a\u4e3b\u4e49\u601d\u60f3\u6982\u8bba", [13, 14]),
            ("\u7f51\u7f16\u90e8\u8bfe\u8868", "\u9648\u60a6\u83f2.pdf",
             "\u4e60\u8fd1\u5e73\u65b0\u65f6\u4ee3\u4e2d\u56fd\u7279\u8272\u793e\u4f1a\u4e3b\u4e49\u601d\u60f3\u6982\u8bba", [13, 14]),
        ]
        for folder, filename, title, weeks in cases:
            path = root / folder / filename
            if not path.exists():
                continue
            with self.subTest(filename=filename, title=title):
                records = parse_vertical_pdf_with_plumber(str(path))
                self.assertTrue(any(row["course"] == title and row["weeks_list"] == weeks
                                    for row in records))


if __name__ == "__main__":
    unittest.main()
