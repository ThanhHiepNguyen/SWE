# Live Code Execution Backend (Edtronaut take-home)

Backend demo cho feature **Live Code Execution**: tạo session, autosave code, submit chạy async qua queue, và poll kết quả chạy.

- **Backend**: Node.js (Express)
- **Queue**: Redis + BullMQ
- **DB**: PostgreSQL + Prisma
- **Runner (isolation demo)**: chạy code trong Docker container (network disabled + memory/pids limit + timeout)
- **Ngôn ngữ hỗ trợ**: **JavaScript**, **Python**

---

## 1) Quickstart (1 command)

### 1.1) Tạo `.env`

Tạo file `.env` ở root:

```env
POSTGRES_DB=livecode
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres

REDIS_PASSWORD=123456
REDIS_PORT=6379

APP_PORT=3000

# giới hạn runtime
EXECUTION_TIMEOUT_MS=5000
EXECUTION_MEMORY_MB=128

# (optional) giữ trạng thái RUNNING tối thiểu X ms để dễ demo
MIN_RUNNING_MS=800
```

### 1.2) Chạy 1 lệnh

```bash
docker-compose up --build --remove-orphans
```

Mở API: `http://localhost:3000`

### 1.3) DB migrate

DB sẽ được migrate **tự động** khi container `app` start (Prisma `migrate deploy`).

---

## 2) Architecture overview

### 2.1) Request flow (end-to-end)

`Client → API → Redis Queue → Worker → Run code → Update DB → Client poll`

### 2.2) Execution lifecycle

`QUEUED → RUNNING → COMPLETED / FAILED / TIMEOUT`

- **QUEUED**: tạo khi gọi `POST /code-sessions/:id/run` (API enqueue job)
- **RUNNING**: worker nhận job và update DB ngay khi bắt đầu
- **COMPLETED/FAILED/TIMEOUT**: worker chạy xong thì update DB + lưu `stdout/stderr/execution_time_ms`

---

## 3) Code repository structure (separation of concerns)

- **API layer**: `src/routes/*` + `src/controllers/*`
- **Queue management**:
  - Producer: `src/queues/executionQueue.js` (API enqueue job)
  - Consumer: `src/worker.js` (BullMQ Worker)
- **Execution logic**: `src/services/dockerRunner.js` (sandbox chạy code bằng Docker)
- **Data models**: `prisma/schema.prisma` (Prisma + PostgreSQL)

---

## 4) Data model & reliability notes

### 4.1) Data model (Prisma)

- `CodeSession`: `id`, `language`, `sourceCode`, `status`, timestamps
- `Execution`: `id`, `sessionId`, `status`, `stdout`, `stderr`, `startedAt`, `finishedAt`, `executionTimeMs`

### 4.2) Reliability

- **Async execution**: API không chạy code trực tiếp, chỉ enqueue.
- **Retries**: BullMQ job có `attempts=3` + exponential backoff.
- **Resource limits** (runner): timeout + memory + `--network none` + `--pids-limit`.

> Note: version hiện tại là “intern-level”: chưa có watchdog/timeout reconciliation khi worker crash giữa chừng.

---

## 5) API documentation

Base URL: `http://localhost:3000`

### 1) POST `/code-sessions`

JavaScript:

```json
{
  "language": "javascript",
  "source_code": "console.log('Hello JS')"
}
```

Python:

```json
{
  "language": "python",
  "source_code": "print('Hello Python')"
}
```

Response:

```json
{ "session_id": "uuid", "status": "ACTIVE" }
```

### 2) PATCH `/code-sessions/:id`

```json
{
  "source_code": "console.log('autosave')",
  "language": "javascript"
}
```

Response:

```json
{ "session_id": "uuid", "status": "ACTIVE" }
```

> Lưu ý: field đúng là `source_code` (không phải `code`).

### 3) POST `/code-sessions/:id/run`

Body:

```json
{}
```

Response:

```json
{ "execution_id": "uuid", "status": "QUEUED" }
```

### 4) GET `/executions/:id`

Response luôn cùng format:

```json
{
  "execution_id": "uuid",
  "status": "QUEUED",
  "stdout": "",
  "stderr": "",
  "execution_time_ms": 0
}
```

Khi xong thì `status` sẽ là `COMPLETED/FAILED/TIMEOUT` và có `stdout/stderr/execution_time_ms`.

---

## 6) Demo: nhìn thấy RUNNING

Nếu code chạy quá nhanh, bạn poll không kịp thấy RUNNING. Dùng Python sleep + tăng timeout:

1) Set trong `.env`:

```env
EXECUTION_TIMEOUT_MS=7000
```

2) Tạo session:

```json
{
  "language": "python",
  "source_code": "import time\nprint('start')\ntime.sleep(3)\nprint('end')"
}
```

3) `/run` rồi bấm `GET /executions/:id` liên tục → sẽ thấy `QUEUED → RUNNING → COMPLETED`.

---

## 7) Design decisions & trade-offs

- **BullMQ + Redis**: đơn giản để demo async execution, dễ scale worker ngang.
- **PostgreSQL + Prisma**: lưu session/execution có schema rõ ràng, dễ query/poll.
- **Polling thay vì websocket**: đúng phạm vi take-home, dễ test nhanh bằng Postman/curl.
- **Docker runner (demo isolation)**: có `--network none`, giới hạn memory/pids/timeout. Trade-off: cần host có Docker socket → không hợp đa số PaaS.
- **Validation ngôn ngữ**: allowlist `python/javascript` + heuristic detect để bắt mismatch cơ bản (không phải parser thật).

---

## 8) Scalability considerations

- Scale worker ngang: tăng số replicas worker để xử lý backlog.
- Queue backlog: monitor queue length + job latency, tăng concurrency theo tài nguyên.
- Bottlenecks: DB writes khi poll nhiều → thêm cache/ETag hoặc backoff polling.

---

## 9) What I would improve with more time

- **An toàn sandbox**: chạy bằng gVisor/Firecracker, read-only FS, seccomp/apparmor, drop capabilities, no-new-privileges.
- **Rate limit / abuse control**: limit theo session/IP, quota theo phút, cooldown, chống spam `/run`.
- **Idempotency**: key cho `/run` để tránh tạo nhiều executions trùng khi client retry.
- **Observability**: structured logs, trace id, metrics (queue length, job latency), dashboard.
- **Multi-language**: add runner image + compile steps (Java/Go) kèm caching.
- **DX/CI**: CI chạy test + lint, pre-commit hooks.

---

## 10) Tests (bonus)

Repo có sẵn **unit test** (Vitest). Chạy:

```bash
npm test
```

Nếu mở rộng thêm, mình sẽ làm theo 3 lớp:

- **Unit tests**:
  - `src/utils/languageDetect.js`: normalize + detect + validate mismatch
- **Integration tests (API)** (Supertest):
  - `POST /code-sessions`
  - `PATCH /code-sessions/:id`
  - `POST /code-sessions/:id/run` (assert `QUEUED` + record created)
  - `GET /executions/:id` (assert response shape)
- **Failure scenarios**:
  - Redis down → `/run` trả lỗi 500, không crash app
  - Worker crash giữa chừng → execution giữ `RUNNING` quá lâu → có watchdog chuyển `FAILED`/`TIMEOUT`

---

## 11) Key files

- `src/controllers/codeSessionController.js`: POST/PATCH/Run
- `src/controllers/executionController.js`: GET execution
- `src/worker.js`: update status + chạy code
- `src/services/dockerRunner.js`: chạy code trong docker
- `docker-compose.yml`: 1 lệnh chạy toàn bộ
- `Dockerfile` / `Dockerfile.worker`: app/worker images
