# Chatbot Hỏi – Đáp Nội Bộ Theo Phòng Ban (RAG)

Đặc tả đầy đủ: [`BRIEF_CHATBOT_NOI_BO_DEV.md`](./BRIEF_CHATBOT_NOI_BO_DEV.md).
Repo hiện ở mức **khung dự án** — hạ tầng và schema đã dựng, nghiệp vụ chưa viết.

## Stack

| Tầng | Công nghệ |
|---|---|
| Backend | NestJS 11 (Fastify) + Drizzle ORM |
| CSDL | PostgreSQL 17 + pgvector (HNSW) + `pg_trgm` + `unaccent` |
| Hàng đợi / cache | Redis 7 (BullMQ, channel layer WS, bộ đếm rate limit) |
| Lưu file | MinIO (dev) → S3 (prod), chỉ đổi `S3_ENDPOINT` |
| Embedding | text-embeddings-inference + BAAI/bge-m3 (self-host) |
| Console | Next.js 15 (App Router) |
| Widget nhúng | Vite library mode → 1 file JS |
| Monorepo | pnpm workspaces + Turborepo |

## Cấu trúc

```
apps/
  api        NestJS — nghiệp vụ + REST + WS + worker nền
  console    Next.js — màn hình Editor / Owner / Admin
  widget     Vite lib — bundle chat nhúng vào hệ thống chủ
packages/
  contracts  zod schema dùng chung FE ↔ BE
  chat-core  SSE client dùng chung console ↔ widget
  tsconfig   cấu hình TypeScript nền
golden/      golden set (YAML) — nguồn sự thật của test hồi quy, FR-7
docker/      init.sql của Postgres, cấu hình nginx
```

## Chạy lần đầu

Yêu cầu: Node >= 22, pnpm, Docker.

```bash
cp .env.example .env          # Windows: copy .env.example .env
#   Sửa JWT_SECRET (>= 32 ký tự) và POSTGRES_PASSWORD trước khi chạy.

pnpm install
docker compose up --build
```

`pnpm-lock.yaml` và migration đầu tiên (`apps/api/drizzle/`) đã có sẵn trong repo —
Dockerfile dùng `--frozen-lockfile` và container `api` chạy `node dist/db/migrate.js`
trước khi start, nên hai thứ đó phải luôn được commit.

Kiểm tra sau khi lên:

```bash
curl http://localhost/health
# {"status":"ok","uptimeSeconds":3,"checks":{"database":"ok"}}
```

| Cổng | Dịch vụ |
|---|---|
| 80 | nginx (console + API + WS) |
| 3000 | Next.js console |
| 3001 | NestJS API |
| 5432 | PostgreSQL |
| 6379 | Redis |
| 9000 / 9001 | MinIO API / web console |
| 8080 | Embedding (text-embeddings-inference) |

Lần chạy đầu service `embed` tải model bge-m3 (~2GB) rồi cache vào volume.

## Phát triển ngoài Docker

Khi chạy local, `apps/console` chuyển tiếp `/api/*` sang `http://localhost:3001`
(cấu hình ở `next.config.ts`) — thay vai trò nginx, nên trình duyệt gọi cùng origin
và không cần bật CORS. Đổi đích bằng biến `API_ORIGIN`.

**Chỉ code giao diện** — không cần CSDL, không cần Docker:

```bash
pnpm --filter @chatbot/console dev     # http://localhost:3000
```

**Chạy đủ API + console** với hạ tầng trong Docker:

```bash
docker compose stop api worker console nginx   # nhường cổng 80/3000/3001
docker compose up -d postgres redis minio embed
cp .env.local.example .env.local               # chỉ làm một lần
pnpm dev
```

`.env.local` được nạp **trước** `.env` nên đè lên nó, còn biến môi trường thật đè
lên cả hai. Nhờ vậy `.env` giữ nguyên tên service cho Docker, `.env.local` trỏ
`localhost` cho máy thật — không phải sửa qua sửa lại mỗi lần đổi cách chạy.

> Nếu máy đã cài sẵn một PostgreSQL chiếm cổng 5432, đặt `POSTGRES_HOST_PORT=5433`
> trong `.env` và sửa cổng tương ứng trong `.env.local`. Windows cho phép hai tiến
> trình cùng bind một cổng, nên để trùng thì kết nối rơi vào bên nào là hên xui —
> triệu chứng là `password authentication failed` dù mật khẩu đúng.

Chưa cài Docker thì dùng tạm một Postgres cloud có sẵn pgvector (Neon, Supabase):
đổi `DATABASE_URL` sang connection string của họ, chạy ba lệnh `CREATE EXTENSION`
trong `docker/postgres/init.sql`, rồi `pnpm db:migrate`.

> Lưu ý: PostgreSQL bản Windows **không** có pgvector dựng sẵn, và biên dịch từ
> nguồn cần Visual Studio Build Tools (2–6 GB, lớn hơn cả Docker Desktop).

## Lệnh thường dùng

| Lệnh | Việc |
|---|---|
| `pnpm dev` | Chạy song song api + console + widget (watch) |
| `pnpm build` | Build toàn bộ workspace theo đúng thứ tự phụ thuộc |
| `pnpm typecheck` | Kiểm tra kiểu toàn repo |
| `pnpm lint` / `pnpm format` | Biome |
| `pnpm db:generate` | Sinh migration sau khi sửa schema |
| `pnpm db:migrate` | Áp migration (chạy từ máy thật) |
| `pnpm --filter @chatbot/api db:studio` | Drizzle Studio |

## Ba ràng buộc không được phá

Ba điều dưới đây là ranh giới kiến trúc ở BRIEF mục 6.2. Vi phạm chúng là nguyên
nhân của hai rủi ro mức "Cao" trong mục 9.2.

1. **Mọi truy vấn lấy `chunks` phải đi qua đúng một hàm dựng mệnh đề `WHERE`
   phân quyền** (`department` + `audience` + `doc_status` + hiệu lực). Viết `WHERE`
   phân quyền rải rác là cách tài liệu nội bộ lọt ra ngoài.
2. **`escalation` không được ghi thẳng vào `knowledge`** — phải qua API publish
   duy nhất, nơi đặt việc tăng phiên bản và ghi `source_type`.
3. **Hàm `search()` không được biết gì về conversation** — chỉ nhận
   `(query, userScope)` và trả về các đoạn.

Thêm một ràng buộc của riêng tầng dữ liệu: bốn cột `department_id`, `audience`,
`doc_status`, `effective_to` trên bảng `chunks` là **bản sao** từ `documents`.
Mọi thay đổi các trường đó ở `documents` phải kéo theo cập nhật toàn bộ chunk của nó.

## Đã làm / chưa làm

Đã nghiệm thu end-to-end: `docker compose up` dựng đủ 8 service, migration tự chạy,
`GET /health` qua nginx trả `{"status":"ok","checks":{"database":"ok"}}`, console render
ở `http://localhost`. `pnpm build` / `typecheck` / `lint` đều sạch.

Đã có:

- Monorepo, Docker Compose, nginx (đã tắt buffering cho SSE), init.sql
- Schema Drizzle 12 bảng phủ hết mục 7 của BRIEF, migration đầu tiên đã sinh,
  kèm index HNSW (`vector_cosine_ops`) và GIN trigram (`gin_trgm_ops`)
- Kiểm tra biến môi trường bằng zod, chặn khởi động nếu `EMBEDDING_DIMENSIONS` lệch schema
- `GET /health` kiểm tra kết nối CSDL và cảnh báo nếu pgvector < 0.8.0
- SSE client dùng `fetch` + `ReadableStream` (không dùng `EventSource`)

Chưa có: toàn bộ nghiệp vụ FR-1 → FR-9, xác thực JWT, BullMQ, giao diện.
Thứ tự triển khai tiếp theo: BRIEF mục 8, bắt đầu từ B0 (Department CRUD).
