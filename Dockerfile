FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# prisma generate chỉ cần schema, không cần DB thật
ENV DATABASE_URL="postgresql://dummy:dummy@localhost/dummy"
ENV DIRECT_URL="postgresql://dummy:dummy@localhost/dummy"
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
# prisma CLI cần thiết cho migrate deploy lúc startup nhưng là devDep — cài riêng
RUN npm ci --omit=dev && npm install prisma --no-save
COPY --from=builder /app/dist             ./dist
COPY --from=builder /app/generated        ./generated
COPY --from=builder /app/prisma           ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
EXPOSE 3000
# migrate + start — migrations idempotent nên an toàn khi restart
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main"]
