FROM node:20-alpine

RUN apk add --no-cache python3 make g++ cmake poppler-utils

WORKDIR /app

COPY package.json package-lock.json* ./
ENV npm_config_python=python3
RUN npm ci --no-audit --no-fund

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

EXPOSE 8080
CMD ["node", "dist/index.js"]
