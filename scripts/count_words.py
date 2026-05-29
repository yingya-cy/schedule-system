"""Count Chinese characters per section"""
import re

md = open("C:/Users/MR/Desktop/作品报告草稿.md", encoding="utf-8").read()
keys = ['一、作品概述', '二、作品设计与实现', '三、作品测试与分析', '四、创新性说明']
limits = [600, 1000, 1000, 500]

for key, limit in zip(keys, limits):
    start = md.find(f"## {key}")
    if start == -1:
        continue
    next_pos = len(md)
    for other in keys:
        pos = md.find(f"## {other}", start + 5)
        if pos != -1 and pos < next_pos:
            next_pos = pos
    content = md[start:next_pos]

    # Remove code blocks
    content = re.sub(r"```[\s\S]*?```", "", content)
    # Remove table rows
    content = re.sub(r"\|.*\|", "", content)
    # Remove markdown links: [text](url) → text
    content = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", content)
    # Count Chinese characters
    cn = len(re.findall(r"[一-鿿]", content))
    status = "OVER" if cn > limit else "OK"
    print(f"{key}: {cn}字 / {limit}字 [{status}]")
