"""
全量重建知识库：合并所有数据源，保留最长版本，重新分类
数据源：微信JSON + 比赛材料KB + 当前KB + 结构化数据头

用法: python rebuild_kb.py
"""

import json
import re
import os
from collections import defaultdict

KB_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "dify-kb")
WECHAT_JSON = os.path.join(os.path.dirname(__file__), "..", "..", "比赛材料", "知识库数据", "wechat-full-text.json")
COMPETITION_KB = os.path.join(os.path.dirname(__file__), "..", "..", "比赛材料", "知识库数据", "dify-kb")

# 微信文章噪音清洗
WECHAT_NOISE = [
    r"点击蓝字.*?\n", r"往期回顾[\s\S]{0,500}?(?=\n##|\n#|\Z)",
    r"编辑\s*[|｜丨]\s*[^\n]+", r"排版\s*[|｜丨]\s*[^\n]+",
    r"校对\s*[|｜丨]\s*[^\n]+", r"审核\s*[|｜丨]\s*[^\n]+",
    r"责编\s*[|｜丨]\s*[^\n]+", r"来源\s*[|｜丨]\s*[^\n]+",
    r"文案\s*[|｜丨]\s*[^\n]+", r"摄影\s*[|｜丨]\s*[^\n]+",
    r"初审\s*[|｜丨]\s*[^\n]+", r"终审\s*[|｜丨]\s*[^\n]+", r"复审\s*[|｜丨]\s*[^\n]+",
    r"长按识别.*?\n", r"扫码关注.*?\n", r"扫码下载.*?\n",
    r"阅读原文.*?\n", r"原文链接.*?\n",
    r"https?://mmbiz\.\S+", r"https?://mp\.weixin\.qq\.com\S+",
    r"文字与广师大[^\n]*\n", r"在这里没有距离\n",
    r"From\s+[^\n]*\n", r"· THE END ·[^\n]*\n",
    r"^▼\s*$", r"^▽\s*$",
    r"^\d{4}年\d{1,2}月\d{1,2}日\s*\d{2}:\d{2}\s*$",
    r"^[｜|丨].*?$",
]


def clean_wechat(text: str) -> str:
    for p in WECHAT_NOISE:
        text = re.sub(p, "", text, flags=re.MULTILINE)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


# 分类关键词（加权，精确类别需标题命中）
CATEGORIES = {
    "01-campus-life": {
        "keywords": ["宿舍", "食堂", "校车", "校园卡", "校园网", "快递", "报修", "门禁",
                      "图书馆", "自习室", "自习", "热水", "空调", "军训", "报到",
                      "假期", "寒假", "暑假", "水电", "停车", "电动自行车", "体育场",
                      "风雨球场", "场馆", "校医室", "医务室", "体检",
                      "校园体育", "运动会", "体育文化节", "校园跑", "体测",
                      "饮食", "饭堂", "餐", "超市", "理发", "干洗",
                      "返校", "离校", "交通车", "接驳",
                      "校园环境", "绿化", "施工", "维修", "停水", "停电"],
        "label": "校园生活", "weight": 1,
    },
    "02-academics": {
        "keywords": ["选课", "公选课", "课表", "校历", "补考", "缓考", "重修",
                      "绩点", "学分", "毕业论文", "毕业设计", "答辩", "转专业",
                      "学籍", "学位", "四六级", "教材", "教学计划", "培养方案",
                      "考试安排", "考场", "开题", "结题", "中期检查",
                      "毕业资格", "毕业审核", "AIGC检测", "抽检", "盲审",
                      "教学创新大赛", "教师教学", "师范生", "卓越班", "微专业",
                      "研究生培养", "研究生导师", "硕士研究生", "博士研究生"],
        "label": "教学教务", "weight": 1,
    },
    "03-psychology": {
        "keywords": ["心理咨询", "心理健康", "朋辈", "心理剧", "团体辅导",
                      "危机干预", "5·25", "心理委员", "心理中心", "情绪管理",
                      "心理测评", "心理普查", "心理培训", "C证"],
        "label": "心理健康", "weight": 2,
    },
    "04-career": {
        "keywords": ["招聘会", "校园招聘", "就业指导", "求职", "面试",
                      "职业生涯", "访企拓岗", "宣讲会", "校企合作", "奖学金",
                      "助学金", "助学贷款", "勤工助学", "资助育人", "困难补助",
                      "国家奖学金", "励志奖学金", "阳光就业", "人才引进",
                      "毕业生就业", "职业规划", "供需见面", "直播带岗",
                      "人才招聘", "人才对接", "企业宣讲"],
        "label": "就业资助", "weight": 2,
    },
    "05-safety": {
        "keywords": ["反诈", "诈骗", "消防演练", "防盗", "实验室安全",
                      "防灾减灾", "安全排查", "安全演练", "交通安全", "禁毒",
                      "国安", "保密教育", "应急疏散", "安全隐患", "消防检查",
                      "电动自行车安全", "防溺水", "扫黑"],
        "label": "安全规范", "weight": 2,
    },
}


def classify(title: str, text: str) -> str:
    full = title + " " + text[:500]
    scores = {}
    for cat, cfg in CATEGORIES.items():
        hits = sum(1 for kw in cfg["keywords"] if kw in full)
        scores[cat] = hits * cfg["weight"]
    for cat in ["03-psychology", "04-career", "05-safety"]:
        if scores.get(cat, 0) >= 2:
            title_hits = sum(1 for kw in CATEGORIES[cat]["keywords"] if kw in title)
            if title_hits == 0:
                scores[cat] = 0
    best = max(scores, key=scores.get)
    return best if scores[best] >= 2 else "06-departments"


def clean_body(text: str) -> str:
    """清理正文中的分隔符"""
    return re.sub(r"\n(?:---|===)\n", "\n***\n", text)


def rebuild():
    os.makedirs(KB_DIR, exist_ok=True)

    # title -> (total_chars, section_text) — 同标题保留最长版
    article_map: dict[str, tuple[int, str]] = {}
    structured_headers: dict[str, str] = {}

    def add(title: str, sec: str):
        chars = len(sec)
        if title in article_map:
            if chars > article_map[title][0]:
                article_map[title] = (chars, sec)
        else:
            article_map[title] = (chars, sec)

    # 0. 结构化数据头（来自比赛KB的非###段）
    if os.path.isdir(COMPETITION_KB):
        cat_map = {
            "01-campu-life.txt": "01-campus-life",
            "02-academics.txt": "02-academics",
            "03-psychology.txt": "03-psychology",
            "04-career.txt": "04-career",
            "05-safety.txt": "05-safety",
            "06-departments.txt": "06-departments",
        }
        for fname, cat in cat_map.items():
            path = os.path.join(COMPETITION_KB, fname)
            if not os.path.exists(path):
                continue
            content = open(path, encoding="utf-8").read()
            sections = re.split(r"\n(?:---|===)\n", content)
            first = sections[0].strip()
            if first and not first.startswith("###") and len(first) > 200:
                structured_headers[cat] = clean_body(first)
                print(f"Header: {cat} ({len(first)} chars)")

    # 1. 微信JSON
    if os.path.exists(WECHAT_JSON):
        wx_data = json.load(open(WECHAT_JSON, encoding="utf-8"))
        c = 0
        for a in wx_data:
            title = a.get("title", "").strip()
            if not title:
                continue
            text = clean_wechat(a.get("text", "")).strip()
            if len(text) < 50:
                continue
            sec = f"### {title}\n来源: {a['account']}\n\n{clean_body(text)}"
            add(title, sec)
            c += 1
        print(f"WeChat JSON: {c}")

    # 2. 比赛KB（跳过header section 0）
    if os.path.isdir(COMPETITION_KB):
        c = 0
        for fname in os.listdir(COMPETITION_KB):
            if not fname.endswith(".txt"):
                continue
            content = open(os.path.join(COMPETITION_KB, fname), encoding="utf-8").read()
            sections = re.split(r"\n(?:---|===)\n", content)
            for sec in sections[1:]:
                sec = sec.strip()
                if not sec:
                    continue
                m = re.search(r"^### (.+)$", sec, re.MULTILINE)
                if not m:
                    continue
                title = m.group(1).strip()
                body = re.sub(r"^#.*$", "", sec, flags=re.MULTILINE).strip()
                if len(body) < 50:
                    continue
                add(title, clean_body(sec))
                c += 1
        print(f"Competition KB: {c}")

    # 3. 当前KB
    cur_files = [f for f in os.listdir(KB_DIR) if f.endswith(".txt")]
    c = 0
    for fname in cur_files:
        content = open(os.path.join(KB_DIR, fname), encoding="utf-8").read()
        for sec in re.split(r"\n(?:---|===)\n", content):
            sec = sec.strip()
            if not sec:
                continue
            m = re.search(r"^### (.+)$", sec, re.MULTILINE)
            if not m:
                continue
            title = m.group(1).strip()
            body = re.sub(r"^#.*$", "", sec, flags=re.MULTILINE).strip()
            if len(body) < 50:
                continue
            add(title, clean_body(sec))
            c += 1
    print(f"Current KB: {c}")

    total = len(article_map)
    print(f"Merged unique: {total}")

    # 重新分类
    chunks_by_cat = defaultdict(list)
    for title, (_, sec) in article_map.items():
        body = re.sub(r"^#.*$", "", sec, flags=re.MULTILINE)
        chunks_by_cat[classify(title, body)].append(sec)

    # 清理旧文件
    for f in os.listdir(KB_DIR):
        if f.endswith(".txt"):
            os.remove(os.path.join(KB_DIR, f))

    # 写出
    written = 0
    for cat in ["01-campus-life", "02-academics", "03-psychology",
                "04-career", "05-safety", "06-departments"]:
        articles = chunks_by_cat.get(cat, [])
        fname = os.path.join(KB_DIR, f"{cat}.txt")
        with open(fname, "w", encoding="utf-8") as f:
            header = structured_headers.get(cat, "")
            if header:
                f.write(header)
                f.write("\n\n===\n\n")
            else:
                f.write(f"# {CATEGORIES.get(cat, {}).get('label', cat)}\n\n")
            for i, sec in enumerate(articles):
                f.write(sec)
                if i < len(articles) - 1:
                    f.write("\n===\n\n")
        size = os.path.getsize(fname) // 1024
        print(f"  {fname}: {len(articles)} articles, {size} KB")
        written += len(articles)

    print(f"\nTotal: {written} articles across 6 files")


if __name__ == "__main__":
    rebuild()
