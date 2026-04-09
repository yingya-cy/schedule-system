FROM python:3.10-slim

WORKDIR /app

# 安装系统依赖，支持编译一些 Python 库
RUN apt-get update && apt-get install -y \
    build-essential \
    libssl-dev \
    libffi-dev \
    libxml2-dev \
    libxslt1-dev \
    zlib1g-dev \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# 升级 pip，避免依赖找不到
RUN python -m pip install --upgrade pip

# 复制依赖文件并安装
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# 复制服务代码
COPY service.py ./
COPY prompts/ ./prompts/
COPY utils/ ./utils/

EXPOSE 5002

CMD ["python", "service.py"]