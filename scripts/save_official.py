"""
将 dify-kb 中的官网文章提取到 official-articles.json
"""
import json, os, re

KB_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "dify-kb")
OUT_FILE = os.path.join(os.path.dirname(__file__), "..", "..", "比赛材料", "知识库数据", "official-articles.json")

articles = []
for fname in sorted(os.listdir(KB_DIR)):
    if not fname.endswith(".txt"):
        continue
    content = open(os.path.join(KB_DIR, fname), encoding="utf-8").read()
    for sec in re.split(r"\n(?:===|---)", content):
        sec = sec.strip()
        if not sec or len(sec) < 80:
            continue
        m = re.search(r"^### (.+)$", sec, re.MULTILINE)
        title = m.group(1).strip() if m else ""
        # Only official articles have 日期: line
        if "日期:" in sec:
            articles.append({"title": title, "text": sec})

os.makedirs(os.path.dirname(OUT_FILE), exist_ok=True)
json.dump(articles, open(OUT_FILE, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(f"Saved {len(articles)} official articles to {OUT_FILE}")
