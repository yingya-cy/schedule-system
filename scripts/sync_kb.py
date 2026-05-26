"""
校园知识库自动同步脚本
1. 从 wechat-download-api 拉取各公众号最新文章
2. 清洗 + 分类 + 分块
3. 替换知识库文件
4. 触发 Dify 索引更新

用法:
    python sync_kb.py              # 增量更新
    python sync_kb.py --full       # 全量重建

Dify 配置:
    创建 Knowledge Pipeline，数据源选"本地文件"，指向 dify-kb/ 文件夹
"""

import json
import os
import re
import sys
import time
import urllib.request
from datetime import datetime
from collections import defaultdict

# ── 配置 ──
WECHAT_API = "http://localhost:1300"
DIFY_API_URL = os.environ.get("DIFY_URL", "http://localhost:5001")
DIFY_KB_API_KEY = os.environ.get("DIFY_KB_API_KEY", "")
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "dify-kb")
FULL_TEXT_FILE = os.path.join(os.path.dirname(__file__), "..", "..", "wechat-full-text.json")
ALL_ARTICLES_FILE = os.path.join(os.path.dirname(__file__), "..", "..", "wechat-all-articles.json")

# 已订阅的公众号 fakeid 列表
SUBSCRIBED_FAKEIDS = [
    "MjM5MzY1MTI4Ng==",  # 广师大招生就业办公室
    "Mzk0NjY3MjUwMw==",  # 广师大心理健康教育与咨询中心
    "MzA5MzUwNDczOA==",  # 广师大青年
    "MzA5MjkwODM4OQ==",  # 广师大学生视界
    "MzIwMzA3NzIyNg==",  # 早安广师大
    "MzIwMTgzMzgxNA==",  # 广东技术师范大学教务处
    "Mzg5MjUxMzA3MQ==",  # 广师大网安视界
    "MzkzMzI1MTM3NQ==",  # 广师大自动化学院
    "Mzg2OTAwNDQ2Mg==",  # 广师大机电青年
    "MzU1NTg1MTM3Nw==",  # 广师大外国语学院
    "MzIzODgwMDYzMg==",  # 广师大数科团学
    "MzU0MjAxNjc5Mw==",  # 广师大教科团学
    "MzU5MTg2NTA1Ng==",  # 广师大电信学院
    "MzUxMTM5Mjc4OA==",  # 广师大科教
]

# 分类关键词
CATEGORIES = {
    "01-campu-life": ["宿舍", "食堂", "网络", "校园网", "快递", "交通", "校车", "水电", "空调", "热水",
                      "超市", "开放时间", "图书馆", "自习", "教室", "美食", "饮水", "报修", "门禁", "校园卡",
                      "报到", "新生", "入学", "军训", "开学", "假期", "寒假", "暑假", "指南", "攻略"],
    "02-academics": ["选课", "考试", "四六级", "补考", "缓考", "重修", "学分", "绩点",
                     "毕业论文", "答辩", "实习", "教学计划", "课程", "公选课", "选修",
                     "转专业", "学籍", "毕业资格", "学位", "教材", "课表", "校历"],
    "03-psychology": ["心理", "咨询", "健康", "情绪", "焦虑", "压力", "抑郁", "5·25",
                      "朋辈", "心理剧", "团体辅导", "危机", "援助", "热线"],
    "04-career": ["就业", "招聘", "求职", "面试", "简历", "实习", "职业", "生涯",
                  "企业", "岗位", "薪资", "助学贷款", "助学金", "奖学金", "勤工", "资助",
                  "困难补助", "国家奖学金", "励志奖学金"],
    "05-safety": ["安全", "消防", "反诈", "诈骗", "防盗", "实验室", "隐患",
                  "处分", "违纪", "考勤", "请假", "宿舍管理", "卫生检查", "制度", "规范"],
    "06-departments": ["学院", "比赛", "竞赛", "活动", "大赛", "讲座", "文化", "晚会",
                       "运动会", "辩论", "演讲", "志愿", "社会实践", "三下乡", "百千万", "表彰"],
}


# ── 工具函数 ──

def clean_text(text: str) -> str:
    if not text:
        return ""
    text = re.sub(r"<[^>]+>", "", text)
    patterns = [
        r"点击蓝字.*?\n", r"往期回顾[\s\S]{0,500}?(?=\n##|\n#|\Z)",
        r"编辑\s*[|｜]\s*[^\n]+", r"排版\s*[|｜]\s*[^\n]+",
        r"校对\s*[|｜]\s*[^\n]+", r"审核\s*[|｜]\s*[^\n]+",
        r"责编\s*[|｜]\s*[^\n]+", r"来源\s*[|｜]\s*[^\n]+",
        r"文案\s*[|｜]\s*[^\n]+", r"摄影\s*[|｜]\s*[^\n]+",
        r"长按识别.*?\n", r"扫码关注.*?\n",
        r"https?://mmbiz\.\S+", r"https?://mp\.weixin\.qq\.com\S+",
    ]
    for p in patterns:
        text = re.sub(p, "", text, flags=re.MULTILINE)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def classify_article(title: str, text: str) -> str:
    full = title + " " + text[:500]
    scores = {}
    for cat, keywords in CATEGORIES.items():
        scores[cat] = sum(1 for kw in keywords if kw in full)
    best = max(scores, key=scores.get)
    return best if scores[best] >= 2 else "06-departments"


def is_fresh(title: str, pubtime: str = "") -> bool:
    for y in ["2017", "2018", "2019", "2020", "2021", "2022", "2023"]:
        if y in title or y in pubtime:
            return False
    return True


# ── 步骤 1：拉取新文章 ──

def fetch_new_articles():
    """从 wechat-download-api 拉取各公众号最新文章"""
    print("[1/4] Fetching articles from wechat-download-api...")

    # 加载已有索引
    existing = set()
    if os.path.exists(ALL_ARTICLES_FILE):
        with open(ALL_ARTICLES_FILE, "r", encoding="utf-8") as f:
            existing = {a["url"] for a in json.load(f) if a.get("url")}

    new_articles = []
    for fid in SUBSCRIBED_FAKEIDS:
        url = f"{WECHAT_API}/api/public/articles?fakeid={fid}&count=10"
        try:
            resp = urllib.request.urlopen(url, timeout=15)
            data = json.loads(resp.read().decode())
            if data.get("success"):
                articles = data.get("data", [])
                if isinstance(articles, dict):
                    articles = articles.get("list", articles.get("articles", []))
                for a in articles:
                    article_url = a.get("link", "") or a.get("url", "")
                    if article_url and article_url not in existing:
                        new_articles.append(a)
            time.sleep(1)
        except Exception as e:
            print(f"  API error for {fid}: {e}")

    print(f"  New articles: {len(new_articles)}")
    return new_articles


# ── 步骤 2：下载全文 + 清洗 ──

def download_and_clean(articles):
    """下载每篇文章全文，清洗去噪"""
    print("[2/4] Downloading full text...")

    # 加载已有全文
    existing_full = []
    if os.path.exists(FULL_TEXT_FILE):
        with open(FULL_TEXT_FILE, "r", encoding="utf-8") as f:
            existing_full = json.load(f)

    done_urls = {a["url"] for a in existing_full}
    new_full = []
    for i, a in enumerate(articles):
        article_url = a.get("link", "") or a.get("url", "")
        if not article_url or article_url in done_urls:
            continue

        body = json.dumps({"url": article_url}).encode()
        req = urllib.request.Request(
            f"{WECHAT_API}/api/article",
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            resp = urllib.request.urlopen(req, timeout=30)
            data = json.loads(resp.read().decode())
            if data.get("success") and data.get("data"):
                text = data["data"].get("plain_content", "") or data["data"].get("content", "")
                cleaned = clean_text(text)
                if len(cleaned) >= 50 and is_fresh(a.get("title", "")):
                    new_full.append({
                        "account": a.get("_account", ""),
                        "title": a.get("title", ""),
                        "url": article_url,
                        "text": cleaned[:3000],
                        "pubtime": data["data"].get("publish_time_str", ""),
                    })
                    done_urls.add(article_url)
            time.sleep(3)
        except Exception as e:
            print(f"  Download error: {e}")

    print(f"  Downloaded: {len(new_full)} new articles")
    return existing_full + new_full


# ── 步骤 3：分类 + 分块 + 写文件 ──

def chunk_and_save(all_articles):
    """按类别分块，写入 dify-kb/ 目录"""
    print("[3/4] Chunking and saving...")

    os.makedirs(OUT_DIR, exist_ok=True)
    chunks_by_cat = defaultdict(list)

    for a in all_articles:
        title = a.get("title", "")
        text = a.get("text", "")
        if len(text) < 50:
            continue
        cat = classify_article(title, text)
        chunks_by_cat[cat].append(a)

    total_chunks = 0
    for cat, articles in chunks_by_cat.items():
        fname = os.path.join(OUT_DIR, f"{cat}.txt")
        with open(fname, "w", encoding="utf-8") as f:
            cat_name = cat.replace("01-", "").replace("02-", "").replace("03-", "")
            cat_name = cat_name.replace("04-", "").replace("05-", "").replace("06-", "")
            f.write(f"# {cat_name}\n\n")
            for a in articles:
                f.write(f"### {a['title']}\n")
                f.write(f"来源: {a['account']}\n")
                f.write(f"{a['text']}\n\n---\n\n")
                total_chunks += 1
        size_kb = os.path.getsize(fname) // 1024
        print(f"  {cat}.txt: {len(articles)} articles, {size_kb} KB")

    print(f"  Total: {total_chunks} chunks across {len(chunks_by_cat)} categories")
    return total_chunks


# ── 步骤 4：触发 Dify 重新索引 ──

def trigger_dify_reindex():
    """通过 Dify API 触发知识库重新索引（如果配了 API Key）"""
    if not DIFY_KB_API_KEY:
        print("[4/4] Dify KB API key not set, skipping reindex.")
        print("  Knowledge Pipeline will auto-detect new files on next poll.")
        return

    print("[4/4] Triggering Dify reindex...")
    try:
        req = urllib.request.Request(
            f"{DIFY_API_URL}/v1/datasets/process",
            data=b"{}",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {DIFY_KB_API_KEY}",
            },
            method="POST",
        )
        resp = urllib.request.urlopen(req, timeout=15)
        print(f"  Response: {resp.status}")
    except Exception as e:
        print(f"  Dify API error: {e}")
        print("  Manually reindex in Dify: Knowledge → Pipeline → Run")


# ── 主流程 ──

def main():
    full_rebuild = "--full" in sys.argv

    if full_rebuild:
        print("=== FULL REBUILD MODE ===")
        # 从 wechat-download-api 拉取所有文章
        # (全量重建需要较长时间)
    else:
        print("=== INCREMENTAL UPDATE ===")

    start = time.time()

    new_articles = fetch_new_articles()

    if new_articles or full_rebuild:
        # 注意：增量模式下只下载新文章，全量需要额外逻辑
        if full_rebuild:
            # 先拉索引，再全量下载（略）
            pass

        all_full = download_and_clean(new_articles)
        with open(FULL_TEXT_FILE, "w", encoding="utf-8") as f:
            json.dump(all_full, f, ensure_ascii=False, indent=2)

        total = chunk_and_save(all_full)
        trigger_dify_reindex()

        elapsed = time.time() - start
        print(f"\nSync complete! {total} chunks updated in {elapsed:.0f}s")
        print(f"Files: {OUT_DIR}/")
    else:
        print("\nNo new articles. Knowledge base is up to date.")


if __name__ == "__main__":
    main()
