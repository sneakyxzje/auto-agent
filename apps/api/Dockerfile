# Build context là THƯ MỤC GỐC của monorepo (xem docker-compose.yml).
FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
# Corepack hỏi xác nhận trước khi tải phiên bản pnpm khai trong `packageManager`.
# Container không có TTY nên câu hỏi đó làm build treo rồi lỗi — tắt hẳn.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo

# --- Cài dependency: chỉ copy manifest để tận dụng cache layer ---------------
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/tsconfig/package.json  packages/tsconfig/
COPY packages/contracts/package.json packages/contracts/
COPY packages/chat-core/package.json packages/chat-core/
COPY apps/api/package.json           apps/api/
COPY apps/console/package.json       apps/console/
COPY apps/widget/package.json        apps/widget/
RUN pnpm install --frozen-lockfile

# --- Biên dịch @chatbot/api và các package nó phụ thuộc ----------------------
FROM deps AS build
COPY turbo.json ./
COPY packages/ packages/
COPY apps/api/ apps/api/
RUN pnpm turbo run build --filter=@chatbot/api...

# --- Runtime ----------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /repo /repo
WORKDIR /repo/apps/api
EXPOSE 3001
CMD ["node", "dist/main.js"]
