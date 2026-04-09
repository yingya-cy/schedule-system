FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --production

COPY server.ts ./
COPY src/ ./src/
COPY dist/ ./dist/
COPY tsconfig.json ./

EXPOSE 3000

CMD ["npx", "tsx", "server.ts"]
