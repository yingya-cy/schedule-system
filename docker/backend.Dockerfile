FROM node:18-alpine

WORKDIR /app

# 设置时区为上海
ENV TZ=Asia/Shanghai
RUN apk add --no-cache tzdata && \
    cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && \
    echo "Asia/Shanghai" > /etc/timezone

# 设置环境变量，确保中文显示正常
ENV LANG C.UTF-8
ENV LC_ALL C.UTF-8
ENV NODE_OPTIONS="--max-old-space-size=512"

COPY package*.json ./

RUN npm install --production

# antiword: lightweight .doc to text converter (~200KB)
RUN apk add --no-cache antiword

COPY server.ts ./
COPY src/ ./src/
COPY dist/ ./dist/
COPY tsconfig.json ./

EXPOSE 3001

CMD ["npx", "tsx", "server.ts"]
