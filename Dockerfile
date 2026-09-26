FROM node:20-slim
WORKDIR /app

COPY package.json ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build

ENV NODE_ENV=production
# Cloud Run / Render / Railway / Fly all inject PORT automatically at runtime
ENV PORT=8080
EXPOSE 8080

CMD ["npx", "tsx", "server.ts"]
