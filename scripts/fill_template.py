"""填写比赛作品报告 docx 模板"""
import re, os, glob
from docx import Document
from docx.shared import Pt, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH

# Load markdown content
md_path = os.path.join(os.path.expanduser("~"), "Desktop", "作品报告草稿.md")
with open(md_path, encoding="utf-8") as f:
    md = f.read()

# Parse sections from markdown
sections = {}
current_section = None
current_content = []
section_titles = {
    "一、作品概述": "一、作品概述",
    "二、作品设计与实现": "二、作品设计与实现",
    "三、作品测试与分析": "三、作品测试与分析",
    "四、创新性说明": "四、创新性说明",
    "五、总结": "五、总结",
    "六、参考文献": "六、参考文献",
}

for line in md.split("\n"):
    for key, title in section_titles.items():
        if line.strip().startswith(f"## {key}"):
            if current_section:
                sections[current_section] = "\n".join(current_content)
            current_section = key
            current_content = []
            break
    else:
        if current_section:
            current_content.append(line)

if current_section:
    sections[current_section] = "\n".join(current_content)


def strip_markdown(text):
    """Strip markdown formatting for Word"""
    text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)
    text = re.sub(r"`([^`]+)`", r"\1", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = re.sub(r"^>.*\n?", "", text, flags=re.MULTILINE)
    text = re.sub(r"^#+\s", "", text, flags=re.MULTILINE)
    text = re.sub(r"-{3,}", "", text)
    text = re.sub(r"```[\s\S]*?```", "", text)
    return text.strip()


def add_paragraphs(doc, text):
    """Add paragraphs from text with formatting"""
    paragraphs = text.split("\n\n")
    for para_text in paragraphs:
        para_text = para_text.strip()
        if not para_text:
            continue
        para_text = strip_markdown(para_text)

        # Handle table lines
        if para_text.startswith("|") and para_text.endswith("|"):
            continue  # Simple tables not supported, skip

        p = doc.add_paragraph()
        p.paragraph_format.first_line_indent = Cm(0.74)  # ~2 chars
        run = p.add_run(para_text)
        run.font.name = "宋体"
        run.font.size = Pt(12)  # 小四号
        p.paragraph_format.line_spacing = 1.5


# Find template
base = os.path.join(os.path.expanduser("~"), "Desktop")
template_path = None
for root, dirs, filenames in os.walk(base):
    for f in filenames:
        if "作品报告模板" in f and f.endswith(".docx"):
            template_path = os.path.join(root, f)
            break
    if template_path:
        break

if not template_path:
    print("Template not found! Searching...")
    # Search in subdirectories
    for root, dirs, filenames in os.walk(os.path.join(base, "比赛材料")):
        for f in filenames:
            if "作品报告模板" in f or "模板" in f:
                if f.endswith(".docx"):
                    template_path = os.path.join(root, f)
                    print(f"Found: {template_path}")
                    break
    if not template_path:
        # Search desktop broadly
        for root, dirs, filenames in os.walk(base):
            for f in filenames:
                if "模板" in f and f.endswith(".docx"):
                    template_path = os.path.join(root, f)
                    print(f"Found: {template_path}")
                    break
            if template_path:
                break

if not template_path:
    print("ERROR: No template found!")
    print("Please place the template on Desktop and try again.")
    exit(1)

doc = Document(template_path)

# First, find and clear the instruction page content
# Remove all paragraphs that have instruction text
instructions_to_remove = ["填写说明", "1. 所有参赛项目", "2. 作品报告采用", "3. 作品报告中各项目", "4. 作品报告模板", "5. 为保证网评"]
for p in doc.paragraphs:
    for instr in instructions_to_remove:
        if instr in p.text:
            p.text = ""
            break

# Find the main content table
table = None
for t in doc.tables:
    if len(t.rows) >= 5:
        table = t
        break

if table:
    # Row mapping: section title + content replacement
    section_rows = {
        "一、作品概述": 0,
        "二、作品设计与实现": 1,
        "三、作品测试与分析": 2,
        "四、创新性说明": 3,
        "五、总结": 4,
        "六、参考文献": 5,
    }

    for section_name, row_idx in section_rows.items():
        if section_name not in sections:
            continue
        if row_idx >= len(table.rows):
            continue

        row = table.rows[row_idx]
        cell = row.cells[0]

        # Clear all paragraphs in cell
        for p in cell.paragraphs:
            p.text = ""

        # Set section title (first paragraph)
        title_p = cell.paragraphs[0]
        title_run = title_p.add_run(section_name)
        title_run.font.name = "宋体"
        title_run.font.size = Pt(12)
        title_run.font.bold = True

        # Add content paragraphs
        content = sections[section_name]
        content = strip_markdown(content)
        # Remove the section header line from content
        content = re.sub(r"^" + re.escape(section_name) + r"\s*", "", content).strip()

        for para_text in content.split("\n\n"):
            para_text = para_text.strip()
            if not para_text or para_text.startswith("|"):
                continue

            # Handle bold markers
            para_text = re.sub(r"\*\*(.+?)\*\*", r"\1", para_text)

            p = cell.add_paragraph()
            p.paragraph_format.first_line_indent = Cm(0.74)
            p.paragraph_format.line_spacing = 1.5
            run = p.add_run(para_text)
            run.font.name = "宋体"
            run.font.size = Pt(12)

        print(f"  Filled: {section_name}")

# Save
desktop = os.path.expanduser("~")
# Use English filename to avoid encoding issues
output = os.path.join(desktop, "Desktop", "作品报告_匿名版.docx")
doc.save(output)
print(f"\nSaved: {output}")
print("Done! Open and check formatting.")
