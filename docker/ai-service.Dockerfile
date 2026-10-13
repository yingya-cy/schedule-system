FROM python:3.10-slim

WORKDIR /app

# 设置时区为上海
ENV TZ=Asia/Shanghai
ENV DEBIAN_FRONTEND=noninteractive

# 设置环境变量，确保中文显示正常
ENV LANG C.UTF-8
ENV LC_ALL C.UTF-8

# ==================== 换国内源（兼容 Debian 10/11 的 sources.list 与 Debian 12 的 debian.sources）====================
RUN set -eux; \
    if [ -f /etc/apt/sources.list ]; then \
        sed -i 's|deb.debian.org|mirrors.aliyun.com|g; s|security.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list; \
    fi; \
    if [ -f /etc/apt/sources.list.d/debian.sources ]; then \
        sed -i 's|deb.debian.org|mirrors.aliyun.com|g; s|security.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources; \
    fi; \
    apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        libssl-dev \
        libffi-dev \
        libxml2-dev \
        libxslt1-dev \
        zlib1g-dev \
        ca-certificates \
        tzdata \
    && ln -fs /usr/share/zoneinfo/Asia/Shanghai /etc/localtime \
    && dpkg-reconfigure --frontend noninteractive tzdata \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# ==================== 修改：pip 换成国内清华源，加速安装 ====================
RUN python -m pip install --upgrade pip -i https://pypi.tuna.tsinghua.edu.cn/simple

# 复制依赖并使用国内源安装
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple

# 复制代码
COPY service.py ./
COPY gunicorn.conf.py ./
COPY ai_endpoints.py ./
COPY ai_schedule.py ./
COPY ai_counsel.py ./
COPY prompts/ ./prompts/
COPY utils/ ./utils/

EXPOSE 5002

CMD ["gunicorn", "-c", "gunicorn.conf.py", "service:app"]