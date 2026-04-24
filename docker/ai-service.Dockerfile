FROM python:3.10-slim

WORKDIR /app

# 设置时区为上海
ENV TZ=Asia/Shanghai
ENV DEBIAN_FRONTEND=noninteractive

# 设置环境变量，确保中文显示正常
ENV LANG C.UTF-8
ENV LC_ALL C.UTF-8

# ==================== 关键修改：换成国内阿里云源，解决安装卡死 ====================
RUN sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list \
    && sed -i 's/security.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list \
    && apt-get update \
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
COPY prompts/ ./prompts/
COPY utils/ ./utils/

EXPOSE 5002

CMD ["gunicorn", "-c", "gunicorn.conf.py", "service:app"]