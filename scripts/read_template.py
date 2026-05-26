"""读取比赛模板结构"""
import os, glob
from docx import Document

# Find template
base = os.path.join(os.path.expanduser("~"), "Desktop", "比赛材料", "附件")
files = glob.glob(os.path.join(base, "*.docx"))
if not files:
    # Try glob with wildcard
    for root, dirs, filenames in os.walk(os.path.join(os.path.expanduser("~"), "Desktop")):
        for f in filenames:
            if "作品报告模板" in f and f.endswith(".docx"):
                files = [os.path.join(root, f)]
                break

if not files:
    print("Template not found!")
    exit(1)

doc = Document(files[0])
print(f"Template: {files[0]}")
print(f"\n=== Structure ===\n")

for i, p in enumerate(doc.paragraphs):
    if p.text.strip():
        print(f"[{p.style.name}] {p.text[:150]}")

# Also check tables
for ti, table in enumerate(doc.tables):
    print(f"\n--- Table {ti} ---")
    for ri, row in enumerate(table.rows):
        cells = [c.text[:60] for c in row.cells]
        print(f"  Row {ri}: {' | '.join(cells)}")
