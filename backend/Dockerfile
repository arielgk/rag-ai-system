FROM node:20-alpine

# 1) System deps for node-gyp native modules (hnswlib-node, mysql2 fallbacks, etc.)
RUN apk add --no-cache python3 make g++ cmake

WORKDIR /app

# 2) Install JS deps first (better cache use)
COPY package.json package-lock.json* ./
# Set python for node-gyp (some envs need it)
ENV npm_config_python=python3
RUN npm ci --no-audit --no-fund

# 3) Build TS and run
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

EXPOSE 8080
CMD ["node", "dist/index.js"]
