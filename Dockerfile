FROM node:20-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --production

COPY . .

RUN npx prisma generate

ENV NODE_ENV=production

CMD ["sh", "-lc", "npx prisma migrate deploy && node src/index.js"]

