"""
爬取学校官网最新通知公告，对接知识库

用法:
    python crawl_school.py              # 增量更新（默认最近3天）
    python crawl_school.py --days 7     # 最近7天
    python crawl_school.py --full       # 全量（不限日期）

输出: dify-kb/07-school-official.txt（学校官方通知）
"""

import json
import os
import re
import sys
import time
from datetime import datetime, timedelta
from collections import defaultdict
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

# ── 配置 ──
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "dify-kb")
STATE_FILE = os.path.join(os.path.dirname(__file__), "crawl_state.json")
OFFICIAL_JSON = os.path.join(os.path.dirname(__file__), "..", "..", "比赛材料", "知识库数据", "official-articles.json")
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"

# 爬取源：列表页 + 所属分类
SOURCES = [
    {
        "name": "学校通知公告",
        "list_url": "https://www.gpnu.edu.cn/index/tzgg.htm",
        "detail_base": "https://www.gpnu.edu.cn",
        "category": "06-departments",
        "pagination": "tzgg/{}.htm",  # page 534, 533, ...
    },
    {
        "name": "教务处通知",
        "list_url": "https://jwc.gpnu.edu.cn/jwxx/tzgg.htm",
        "detail_base": "https://jwc.gpnu.edu.cn",
        "category": "02-academics",
        "pagination": None,  # jwc uses jsp list
    },
    {
        "name": "研究生院通知",
        "list_url": "https://yjsc.gpnu.edu.cn/index/tzgg/18.htm",
        "detail_base": "https://yjsc.gpnu.edu.cn",
        "category": "02-academics",
        "pagination": "index/tzgg/{}.htm",
    },
    {
        "name": "河源校区通知",
        "list_url": "https://hyxqgwh.gpnu.edu.cn/index/tzgg.htm",
        "detail_base": "https://hyxqgwh.gpnu.edu.cn",
        "category": "01-campus-life",
        "pagination": "index/tzgg/{}.htm",
    },
    {
        "name": "学校要闻",
        "list_url": "https://www.gpnu.edu.cn/index/xxyw1.htm",
        "detail_base": "https://www.gpnu.edu.cn",
        "category": "06-departments",
        "pagination": "xxyw1/{}.htm",
    },
    {
        "name": "综合新闻",
        "list_url": "https://www.gpnu.edu.cn/index/zhxw.htm",
        "detail_base": "https://www.gpnu.edu.cn",
        "category": "06-departments",
        "pagination": "zhxw/{}.htm",
    },
    {
        "name": "本科教学",
        "list_url": "https://www.gpnu.edu.cn/index/bkjxxx.htm",
        "detail_base": "https://www.gpnu.edu.cn",
        "category": "02-academics",
        "pagination": "bkjxxx/{}.htm",
    },
    {
        "name": "科研信息",
        "list_url": "https://www.gpnu.edu.cn/index/kyxx.htm",
        "detail_base": "https://www.gpnu.edu.cn",
        "category": "02-academics",
        "pagination": "kyxx/{}.htm",
    },
    {
        "name": "学术活动",
        "list_url": "https://www.gpnu.edu.cn/index/xshd.htm",
        "detail_base": "https://www.gpnu.edu.cn",
        "category": "06-departments",
        "pagination": "xshd/xsyg/{}.htm",
    },
    {
        "name": "研究生教育",
        "list_url": "https://www.gpnu.edu.cn/index/yjsjyxx.htm",
        "detail_base": "https://www.gpnu.edu.cn",
        "category": "02-academics",
        "pagination": "yjsjyxx/{}.htm",
    },
    {
        "name": "双百行动",
        "list_url": "https://www.gpnu.edu.cn/index/sbxd/gzdt.htm",
        "detail_base": "https://www.gpnu.edu.cn",
        "category": "06-departments",
        "pagination": "sbxd/gzdt/{}.htm",
    },
    {
        "name": "校团委通知",
        "list_url": "https://tw.gpnu.edu.cn/",
        "detail_base": "https://tw.gpnu.edu.cn",
        "category": "06-departments",
        "pagination": None,
    },
]

# 内容提取的选择器（按优先级）
CONTENT_SELECTORS = [
    ".article-con",
    ".article-text",
    ".article_content",
    "#article_content",
    ".wp_articlecontent",
    ".TRS_Editor",
    ".content",
    "article",
    ".text-content",
    ".entry-content",
]

# 已有分类关键词（与 sync_kb.py 保持一致）
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
        "weight": 1,
    },
    "02-academics": {
        "keywords": ["选课", "公选课", "课表", "校历", "补考", "缓考", "重修",
                      "绩点", "学分", "毕业论文", "毕业设计", "答辩", "转专业",
                      "学籍", "学位", "四六级", "教材", "教学计划", "培养方案",
                      "教学督导", "考试安排", "考场", "开题", "结题", "中期检查",
                      "毕业资格", "毕业审核", "AIGC检测", "抽检", "盲审",
                      "教学创新大赛", "教师教学", "师范生", "卓越班", "微专业"],
        "weight": 1,
    },
    "03-psychology": {
        "keywords": ["心理咨询", "心理健康", "朋辈", "心理剧", "团体辅导",
                      "危机干预", "5·25", "心理委员", "心理中心", "情绪管理",
                      "心理测评", "心理普查", "心理培训", "C证"],
        "weight": 2,
    },
    "04-career": {
        "keywords": ["招聘会", "校园招聘", "就业指导", "求职", "面试",
                      "职业生涯", "访企拓岗", "宣讲会", "校企合作", "奖学金",
                      "助学金", "助学贷款", "勤工助学", "资助育人", "困难补助",
                      "国家奖学金", "励志奖学金", "阳光就业", "人才引进",
                      "毕业生就业", "职业规划", "供需见面", "直播带岗"],
        "weight": 2,
    },
    "05-safety": {
        "keywords": ["反诈", "诈骗", "消防演练", "防盗", "实验室安全",
                      "防灾减灾", "安全排查", "安全演练", "交通安全", "禁毒",
                      "国安", "保密教育", "应急疏散", "安全隐患", "消防检查"],
        "weight": 2,
    },
}


def load_state() -> dict:
    """加载爬取状态（已处理URL + 上次爬取时间）"""
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"seen_urls": [], "last_crawl": None}


def save_state(state: dict):
    with open(STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)


def fetch_page(url: str, timeout: int = 15) -> str | None:
    """抓取页面HTML"""
    try:
        resp = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=timeout)
        resp.encoding = resp.apparent_encoding or "utf-8"
        if resp.status_code == 200:
            return resp.text
        print(f"  HTTP {resp.status_code}: {url}")
        return None
    except Exception as e:
        print(f"  Error fetching {url}: {e}")
        return None


def extract_article_links(html: str, base_url: str) -> list[dict]:
    """从列表页提取文章链接"""
    soup = BeautifulSoup(html, "html.parser")
    links = []

    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        # 匹配 info/xxx/xxx.htm 格式的详情页链接（有无前导 / 均可）
        if re.search(r"info/\d+/\d+\.htm", href):
            title = a.get_text(strip=True)
            if title and len(title) > 4:
                full_url = urljoin(base_url, href)
                # 提取发布日期（通常在链接附近的 <span> 或 <font> 里）
                parent = a.find_parent(["li", "div", "td", "tr"])
                date_str = ""
                if parent:
                    date_el = parent.find(["span", "font", "em"], class_=re.compile(r"date|time|pub", re.I))
                    if not date_el:
                        date_el = parent.find(["span", "font"], string=re.compile(r"\d{4}[-/]\d{2}[-/]\d{2}"))
                    if date_el:
                        date_str = date_el.get_text(strip=True)
                links.append({"title": title, "url": full_url, "date_str": date_str})

    return links


def extract_article_content(html: str) -> str | None:
    """从文章详情页提取正文内容"""
    soup = BeautifulSoup(html, "html.parser")

    # 尝试各种选择器
    content_el = None
    for selector in CONTENT_SELECTORS:
        content_el = soup.select_one(selector)
        if content_el:
            break

    if not content_el:
        # 回退：找包含最多文本的 div
        candidates = []
        for div in soup.find_all("div"):
            text_len = len(div.get_text(strip=True))
            if 200 < text_len < 20000:
                candidates.append((text_len, div))
        if candidates:
            content_el = max(candidates, key=lambda x: x[0])[1]

    if not content_el:
        return None

    # 移除脚本、样式、导航元素
    for tag in content_el.find_all(["script", "style", "nav", "footer"]):
        tag.decompose()

    text = content_el.get_text(separator="\n", strip=True)
    return clean_text(text)


def clean_text(text: str) -> str:
    """清洗文本"""
    if not text:
        return ""
    lines = text.split("\n")
    cleaned = []
    # 导航关键词（常见菜单项，内容少且独立成行时跳过）
    nav_keywords = [
        "规章制度", "办事指南", "培养方案", "学籍管理", "教学管理",
        "课程教材", "教学安排", "质量监控", "教学奖励", "调停课公告",
        "专业学位", "实践教学", "基地建设", "管理规定", "科研学术",
        "会议论坛", "项目管理", "下载中心", "快速链接", "联系我们",
        "学校官网", "研究生招生网", "二级学院网站", "招生信息网",
        "首页", "学院概况", "师资队伍", "人才培养", "科学研究",
        "招生就业", "学生工作", "新闻动态", "通知公告", "信息公开",
    ]
    skip_patterns = [
        r"^作者：", r"^来源：", r"^审核：", r"^编辑：", r"^摄影：",
        r"^发布：", r"^浏览：", r"^字体：", r"^打印：", r"^关闭",
        r"^上一条：", r"^下一条：", r"^【关闭】", r"^版权所有",
        r"^地址：", r"^电话：", r"^传真：", r"^邮编：",
        r"^当前位置", r"^>>", r"^发布时间：", r"^发布日期：",
        r"^浏览次数", r"^作者", r"^审核人", r"^编辑：",
        r"^邮箱：", r"^Copyright", r"^©", r"^All Rights",
        r"^粤ICP", r"^教ICP", r"^网站地图", r"^法律声明",
    ]
    for line in lines:
        line = line.strip()
        if not line:
            continue
        if len(line) <= 20 and line in nav_keywords:
            continue
        if any(re.match(p, line) for p in skip_patterns):
            continue
        if line in ("大", "中", "小"):
            continue
        cleaned.append(line)

    text = "\n".join(cleaned)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def classify_article(title: str, text: str) -> str:
    """根据标题+正文加权分类，未匹配的归入综合"""
    full = title + " " + text[:500]
    scores = {}
    for cat, cfg in CATEGORIES.items():
        hits = sum(1 for kw in cfg["keywords"] if kw in full)
        scores[cat] = hits * cfg["weight"]

    # 精确类别（心理、就业、安全）要求在标题中出现，避免"列举式提及"
    precise_cats = {"03-psychology", "04-career", "05-safety"}
    for cat in precise_cats:
        if scores.get(cat, 0) >= 2:
            title_hits = sum(1 for kw in CATEGORIES[cat]["keywords"] if kw in title)
            if title_hits == 0:
                scores[cat] = 0

    best = max(scores, key=scores.get)
    if scores[best] >= 2:
        return best
    return "06-departments"


def parse_date(date_str: str) -> datetime | None:
    """尝试解析日期字符串"""
    patterns = [
        r"(\d{4})[-/](\d{1,2})[-/](\d{1,2})",
        r"(\d{4})年(\d{1,2})月(\d{1,2})日",
    ]
    for p in patterns:
        m = re.search(p, date_str)
        if m:
            return datetime(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    return None


def is_recent(date_str: str, days: int) -> bool:
    """判断日期是否在最近 N 天内"""
    dt = parse_date(date_str)
    if not dt:
        return True  # 解析不了日期默认保留
    return dt >= datetime.now() - timedelta(days=days)


def chunk_and_save(all_articles: list[dict]):
    """分类保存到 dify-kb 格式"""
    os.makedirs(OUT_DIR, exist_ok=True)

    # 按分类聚合
    chunks_by_cat = defaultdict(list)
    for a in all_articles:
        cat = a.get("category", "06-departments")
        chunks_by_cat[cat].append(a)

    total = 0
    for cat, articles in chunks_by_cat.items():
        fname = os.path.join(OUT_DIR, f"{cat}.txt")

        # 追加模式（不覆盖已有的微信文章）
        existing = ""
        if os.path.exists(fname):
            with open(fname, "r", encoding="utf-8") as f:
                existing = f.read()

        new_content = []
        for a in articles:
            title = a["title"]
            # 避免重复
            if f"### {title}" not in existing:
                new_content.append(f"### {title}")
                new_content.append(f"来源: {a['source']}")
                new_content.append(f"日期: {a.get('date', '')}")
                new_content.append(f"")
                new_content.append(a["text"])
                new_content.append(f"")
                new_content.append(f"---")
                new_content.append(f"")
                total += 1

        if new_content:
            with open(fname, "a", encoding="utf-8") as f:
                f.write("\n".join(new_content))

            size_kb = os.path.getsize(fname) // 1024
            print(f"  {cat}.txt: +{len(articles)} articles (appended), {size_kb} KB")

    print(f"  Total new chunks: {total}")


def find_list_pages(html: str, base_url: str, pagination_pattern: str | None) -> list[str]:
    """从列表页提取分页链接"""
    pages = [base_url]  # 当前页总是包含在内
    if not pagination_pattern:
        return pages

    soup = BeautifulSoup(html, "html.parser")
    for a in soup.find_all("a", href=True):
        href = a["href"]
        # 匹配分页模式
        m = re.search(r"(\d+)\.htm", href)
        if m:
            page_num = int(m.group(1))
            full = urljoin(base_url, href)
            if full not in pages:
                pages.append(full)

    # 只取前5页（最新的内容）
    return pages[:5]


def main():
    # 避免 Windows GBK 终端编码报错（不影响数据写入，数据都是 UTF-8）
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

    days = 3
    for i, arg in enumerate(sys.argv):
        if arg == "--days" and i + 1 < len(sys.argv):
            days = int(sys.argv[i + 1])
        elif arg == "--full":
            days = 365 * 10  # 10年，等于不限

    print(f"=== School Official Site Crawler (last {days} days) ===")
    print(f"Output: {OUT_DIR}/")
    print()

    state = load_state()
    seen_urls = set(state.get("seen_urls", []))
    all_articles = []

    for src in SOURCES:
        print(f"[{src['name']}] {src['list_url']}")

        # 1. 抓取列表页
        list_html = fetch_page(src["list_url"])
        if not list_html:
            continue

        # 2. 找分页（只匹配当前源的分页目录，避免把文章详情页当成列表页）
        list_pages = [src["list_url"]]
        if src.get("pagination"):
            # 从 pagination 提取目录名，如 "tzgg/{}.htm" 或 "index/tzgg/{}.htm" → "tzgg"
            pag_base = src["pagination"].split("{")[0].rstrip("/")
            pag_dir = pag_base.split("/")[-1]
            pag_re = re.compile(re.escape(pag_dir) + r"/\d+\.htm")
            soup = BeautifulSoup(list_html, "html.parser")
            for a in soup.find_all("a", href=True):
                href = a["href"]
                if pag_re.search(href):
                    full = urljoin(src["list_url"], href)
                    if full not in list_pages:
                        list_pages.append(full)

        # 只爬前3页列表
        list_pages = list_pages[:3]
        print(f"  List pages to crawl: {len(list_pages)}")

        # 3. 提取所有文章链接
        all_links = []
        for lp_url in list_pages:
            html = fetch_page(lp_url)
            if html:
                links = extract_article_links(html, src["detail_base"])
                all_links.extend(links)
            time.sleep(0.5)

        # 去重
        unique_links = []
        seen_in_batch = set()
        for link in all_links:
            if link["url"] not in seen_in_batch:
                seen_in_batch.add(link["url"])
                unique_links.append(link)

        print(f"  Articles found: {len(unique_links)}")

        # 4. 抓取每篇文章
        new_count = 0
        for i, link in enumerate(unique_links):
            if link["url"] in seen_urls:
                continue

            print(f"  [{i+1}/{len(unique_links)}] {link['title'][:40]}...")
            article_html = fetch_page(link["url"])
            if not article_html:
                continue

            content = extract_article_content(article_html)
            if not content or len(content) < 50:
                print(f"    No content found, skipping")
                continue

            # 从文章页提取日期（比列表页更可靠）
            date_str = link.get("date_str", "")
            if not date_str:
                date_m = re.search(r"(\d{4}[-/]\d{1,2}[-/]\d{1,2})", article_html)
                if not date_m:
                    date_m = re.search(r"(\d{4}年\d{1,2}月\d{1,2}日)", article_html)
                if date_m:
                    date_str = date_m.group(1)

            # 日期过滤
            if days < 3650 and date_str:
                if not is_recent(date_str, days):
                    seen_urls.add(link["url"])
                    continue

            # 从 <title> 提取标题（比列表页标题更准确）
            soup = BeautifulSoup(article_html, "html.parser")
            title_tag = soup.find("title")
            page_title = title_tag.get_text(strip=True) if title_tag else link["title"]
            # 去掉 "广东技术师范大学" 后缀
            page_title = re.sub(r"[-–—|].*$", "", page_title).strip()

            category = classify_article(page_title, content)

            all_articles.append({
                "title": page_title,
                "url": link["url"],
                "source": src["name"],
                "category": category,
                "date": link.get("date_str", ""),
                "text": content[:3000],
            })

            seen_urls.add(link["url"])
            new_count += 1
            time.sleep(1.5)  # 礼貌爬取

        print(f"  New articles: {new_count}")

    # 5. 保存结果
    print()
    print("=" * 40)
    print(f"Total new articles: {len(all_articles)}")

    if all_articles:
        chunk_and_save(all_articles)
        state["seen_urls"] = list(seen_urls)
        state["last_crawl"] = datetime.now().isoformat()
        save_state(state)
        print(f"State saved: {STATE_FILE}")
        print(f"\nDone! Run Dify Knowledge Pipeline to re-index.")
    else:
        print("No new articles. Knowledge base is up to date.")


if __name__ == "__main__":
    main()
