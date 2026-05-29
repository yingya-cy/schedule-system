"""
Dify 外部知识库 API + 本地 Embedding 语义检索
"""
import os, re, json, logging, sys, hashlib, time

logging.basicConfig(level=logging.INFO, stream=sys.stdout)
logger = logging.getLogger("kb_server")

from flask import Flask, request, jsonify
import urllib.request

app = Flask(__name__)

KB_PATH = "/kb-data"
EMBEDDING_API = os.environ.get("EMBEDDING_API", "https://api.siliconflow.cn/v1/embeddings")
EMBEDDING_KEY = os.environ.get("EMBEDDING_KEY", "")
EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL", "BAAI/bge-m3")
RERANK_API = os.environ.get("RERANK_API", "https://api.siliconflow.cn/v1/rerank")
RERANK_KEY = os.environ.get("RERANK_KEY", EMBEDDING_KEY)
RERANK_MODEL = os.environ.get("RERANK_MODEL", "BAAI/bge-reranker-v2-m3")
CACHE_FILE = "/tmp/kb_embeddings.json"


def load_kb():
    articles = []
    if not os.path.isdir(KB_PATH):
        return articles
    for fname in sorted(os.listdir(KB_PATH)):
        if not fname.endswith(".txt"):
            continue
        content = open(os.path.join(KB_PATH, fname), encoding="utf-8").read()
        for sec in re.split(r"\n===+", content):
            sec = sec.strip()
            if not sec or len(sec) < 80:
                continue
            m = re.search(r"^### (.+)$", sec, re.MULTILINE)
            title = m.group(1).strip() if m else ""
            # 只用前 800 字符做检索（加速 Embedding）
            articles.append({"title": title, "text": sec[:2000], "search_text": sec[:800]})
    logger.info(f"Loaded {len(articles)} articles")
    return articles


def get_embedding(text: str) -> list[float] | None:
    """调用硅基流动 bge-m3 获取 embedding"""
    if not EMBEDDING_KEY:
        return None
    try:
        data = json.dumps({"model": EMBEDDING_MODEL, "input": text}).encode()
        req = urllib.request.Request(EMBEDDING_API, data=data, headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {EMBEDDING_KEY}",
        })
        resp = urllib.request.urlopen(req, timeout=15)
        result = json.loads(resp.read())
        return result["data"][0]["embedding"]
    except Exception as e:
        logger.warning(f"Embedding failed: {e}")
        return None


def cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = sum(x * x for x in a) ** 0.5
    nb = sum(y * y for y in b) ** 0.5
    return dot / (na * nb) if na and nb else 0


def build_index():
    """预计算所有文章的 embedding 并缓存"""
    if os.path.exists(CACHE_FILE):
        cached = json.load(open(CACHE_FILE))
        if cached.get("count") == len(KB_ARTICLES):
            logger.info(f"Loaded {cached['count']} embeddings from cache")
            return cached["embeddings"]

    logger.info(f"Building embeddings for {len(KB_ARTICLES)} articles (this may take a while)...")
    embeddings = []
    for i, a in enumerate(KB_ARTICLES):
        emb = get_embedding(a["search_text"])
        if emb:
            embeddings.append(emb)
        else:
            embeddings.append(None)
        if (i + 1) % 50 == 0:
            logger.info(f"  {i + 1}/{len(KB_ARTICLES)} done")
        time.sleep(0.05)  # 避免触发限流

    json.dump({"count": len(KB_ARTICLES), "embeddings": embeddings}, open(CACHE_FILE, "w"))
    return embeddings


def rerank(query: str, candidates: list[dict], top_k: int = 3) -> list[dict]:
    """Rerank 精排"""
    if not candidates or not RERANK_KEY:
        return candidates[:top_k]
    try:
        docs = [a["search_text"] for a in candidates]
        data = json.dumps({"model": RERANK_MODEL, "query": query, "documents": docs}).encode()
        req = urllib.request.Request(RERANK_API, data=data, headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {RERANK_KEY}",
        })
        resp = urllib.request.urlopen(req, timeout=15)
        result = json.loads(resp.read())
        ranked = result.get("results", [])
        reranked = [candidates[r["index"]] for r in sorted(ranked, key=lambda x: x["relevance_score"], reverse=True)]
        logger.info(f"Rerank: {len(candidates)} → {len(reranked[:top_k])}")
        return reranked[:top_k]
    except Exception as e:
        logger.warning(f"Rerank failed, using embedding scores: {e}")
        return candidates[:top_k]


def search_embedding(query: str, top_k: int = 5) -> list[dict]:
    """语义检索 + Rerank 精排"""
    q_emb = get_embedding(query)
    if not q_emb:
        return search_keyword(query, top_k)

    scores = []
    for i, a in enumerate(KB_ARTICLES):
        emb = EMBEDDINGS[i] if i < len(EMBEDDINGS) else None
        if emb:
            scores.append((cosine(q_emb, emb), a))
    scores.sort(key=lambda x: -x[0])
    candidates = [a for s, a in scores[:20] if s > 0.3]
    return rerank(query, candidates, top_k) if candidates else []


def search_keyword(query: str, top_k: int = 5) -> list[dict]:
    """关键词检索（无 Embedding API 时的 fallback）"""
    keywords = set()
    for wlen in (2, 3, 4):
        for i in range(len(query) - wlen + 1):
            sub = query[i : i + wlen]
            if all("一" <= c <= "鿿" for c in sub):
                keywords.add(sub)
    scored = []
    for a in KB_ARTICLES:
        search_text = a["title"] + " " + a["text"]
        score = sum(10 for kw in keywords if kw in a["title"]) + sum(
            1 for kw in keywords if kw in search_text
        )
        if score > 0:
            scored.append((score, a))
    scored.sort(key=lambda x: -x[0])
    return [a for _, a in scored[:top_k]]


KB_ARTICLES = load_kb()
EMBEDDINGS = build_index() if EMBEDDING_KEY else []
search = search_embedding if EMBEDDINGS else search_keyword


@app.route("/api/kb/search", methods=["GET", "POST"])
def kb_ping():
    return jsonify({"result": "pong"})


@app.route("/api/kb/search/retrieval", methods=["POST"])
def kb_retrieval():
    """Dify 外部知识库 API"""
    data = request.get_json(silent=True) or {}
    query = data.get("query", "")
    top_k = data.get("retrieval_setting", {}).get("top_k", 5)

    if not query:
        return jsonify({"records": []})

    results = search(query, top_k=min(top_k, 10))
    records = [
        {"content": r["text"][:1500], "score": 0.9, "title": r["title"] or "校园信息", "metadata": {}}
        for r in results
    ]
    logger.info(f"Retrieval: {query!r} → {len(records)} records")
    resp = jsonify({"records": records})
    resp.headers["Content-Type"] = "application/json"
    return resp


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5002)
