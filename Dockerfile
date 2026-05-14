FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist        ./dist
COPY --from=builder /app/generated   ./generated
COPY --from=builder /app/prisma      ./prisma
EXPOSE 3000
# migrate + start — migrations idempotent nên an toàn khi restart
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main"]
