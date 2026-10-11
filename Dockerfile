FROM node:22-bookworm-slim

# Outils de compilation, au cas où better-sqlite3 n'a pas de binaire précompilé
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .

ENV NODE_ENV=production \
    PORT=3000 \
    DB_PATH=/data/mariage.db \
    TZ=Europe/Paris

EXPOSE 3000
CMD ["node", "server.js"]
