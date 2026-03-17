# Live Code Execution Backend (Edtronaut take-home)

> Tip: Nếu bạn poll mà không “nhìn thấy RUNNING”, thường là vì job chạy quá nhanh.
> Repo này có hỗ trợ `MIN_RUNNING_MS` để giữ trạng thái RUNNING tối thiểu X ms (mặc định 800ms trong docker-compose).

Hỗ trợ **2 ngôn ngữ**: **JavaScript** và **Python**.

---


### 1) Chuẩn bị `.env`

Tạo `.env` ở root:

```env
POSTGRES_DB=livecode
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres

REDIS_PASSWORD=123456
REDIS_PORT=6379

APP_PORT=3000

# để demo dễ thấy RUNNING (tăng lên 7000 hoặc 10000 nếu muốn)
EXECUTION_TIMEOUT_MS=5000
EXECUTION_MEMORY_MB=128
```

### 2) Chạy 1 lệnh

```bash
docker-compose up --build --remove-orphans
```

Mở API ở: `http://localhost:3000`

### 3) Init DB (làm 1 lần)

```bash
docker exec app npx prisma migrate dev --name init
```

---

## Luồng xử lý (để bạn giải thích trong slide)

`Client → API → Redis Queue → Worker → Run code → Update DB → Client poll`

Lifecycle:

`QUEUED → RUNNING → COMPLETED / FAILED / TIMEOUT`

- **QUEUED**: tạo khi bạn gọi `POST /code-sessions/:id/run`
- **RUNNING**: worker nhận job và update DB ngay khi bắt đầu
- **COMPLETED/FAILED/TIMEOUT**: worker chạy xong thì update DB + lưu `stdout/stderr/execution_time_ms`

---

## 4 API (copy vào Postman là chạy)

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

## Cách demo “nhìn thấy RUNNING”

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

## Vài ghi chú “intern-level” (để ghi trade-off)

- Chạy code bằng Docker runner (network disabled, memory/pids limit).
- Retry BullMQ: `attempts=3` + backoff.
- Chỉ hỗ trợ JS/Python (ngôn ngữ khác sẽ bị chặn).

---

## File chính (để bạn tìm nhanh)

- `src/controllers/codeSessionController.js`: POST/PATCH/Run
- `src/controllers/executionController.js`: GET execution
- `src/worker.js`: update status + chạy code
- `src/services/dockerRunner.js`: chạy code trong docker
- `docker-compose.yml`: 1 lệnh chạy toàn bộ
- `Dockerfile` / `Dockerfile.worker`: app/worker images

