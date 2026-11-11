# Chạy FarmGuard bằng Docker

Một lệnh chạy toàn bộ hệ thống: MongoDB, MQTT broker, backend (có APM), frontend, và Datadog Agent nếu cần.

| Container | Vai trò | Địa chỉ trên máy |
|---|---|---|
| `frontend` | React build, phục vụ bằng nginx, proxy `/api` sang backend | http://localhost:8080 |
| `backend` | Express API, simulator, hardware bridge | http://localhost:5000/api, Swagger: http://localhost:5000/api/docs |
| `mongodb` | MongoDB 7, dữ liệu giữ trong volume `smart-farm-mongodb-data` | `localhost:27017` |
| `mqtt` | Mosquitto cho ESP32 | `localhost:1883` |
| `datadog-agent` | Metrics (DogStatsD), logs, APM. Chỉ chạy khi bật profile `observability` | |

## 1. Chuẩn bị

- Cài **Docker Desktop** và mở nó lên (đợi biểu tượng báo *Engine running*).
- Tạo file cấu hình (một lần):
  ```powershell
  copy backend\.env.example backend\.env
  ```
  Mở `backend/.env` và điền nếu dùng Datadog: `DD_API_KEY`, `DD_APP_KEY`, `DD_SITE`, `DD_ALERT_NOTIFY`, `DD_APM_ENABLED=true`.

Các địa chỉ `localhost` trong `backend/.env` (MongoDB, MQTT, Datadog Agent) **không cần sửa**: `compose.yaml` tự thay bằng tên container khi chạy trong Docker.

## 2. Chạy

Tất cả lệnh chạy ở **thư mục gốc repo**.

```powershell
# Có Datadog (khuyên dùng cho demo)
docker compose --env-file backend/.env --profile observability up -d --build

# Không có Datadog
docker compose --env-file backend/.env up -d --build
```

**Chỉ lần đầu tiên** (database trống), nạp dữ liệu mẫu (3 farm, cảm biến, người dùng):

```powershell
docker compose run --rm backend node src/seeders/seedDatabase.js
docker compose restart backend
```

> ⚠️ Lệnh seed **xóa sạch** farm, lệnh bơm, incident và telemetry hiện có rồi mới nạp lại. Đừng chạy lại trước buổi demo nếu muốn giữ lịch sử incident và KPI MTTD/MTTR.

Mở http://localhost:8080. Simulator chạy ngay; vào **Failure Demo Lab** để tạo sự cố silent failure.

**Tạo dashboard, monitor và SLO trên Datadog** (một lần, chạy lại vẫn an toàn):

```powershell
docker compose run --rm backend node src/scripts/provisionDatadog.js
```

## 3. Kiểm tra

```powershell
docker compose ps                                  # tất cả "Up", mongodb "healthy"
docker compose logs -f backend                     # log JSON của backend
docker compose exec datadog-agent agent status     # API key valid, Metric Packets, Traces received, LogsSent
```

Kiểm tra nhanh API: http://localhost:8080/api/iot/incidents/kpis

## 4. Kết nối ESP32 thật

1. Broker đã mở sẵn cổng 1883 ra mạng LAN:
   ```powershell
   docker compose --env-file backend/.env --profile observability up -d
   ```
   Broker cho phép kết nối không mật khẩu, chỉ dùng trong mạng LAN tin cậy. Windows Firewall có thể hỏi quyền cho cổng 1883.
2. Trong firmware `AppConfig.h`, đặt `MQTT_BROKER` = IP LAN của máy này (xem `ipconfig`), nạp lại board.
3. Trong `backend/.env` thêm `HARDWARE_DEVICES=garden01=FARM-001`, rồi `docker compose restart backend`.
4. Kiểm tra: http://localhost:8080/api/iot/hardware phải hiện `"online": true`.

Nếu broker nằm ở máy khác (ví dụ Tinker Board `192.168.0.132`), đặt `DOCKER_HARDWARE_MQTT_URL=mqtt://192.168.0.132:1883` trong `backend/.env` và chạy lại lệnh `up` với `--env-file backend/.env`.

**Chưa có board?** Chạy trình giả lập ESP32 bên trong container (gõ `w` + Enter để cho nước chảy lại):

```powershell
docker compose exec -it backend node src/scripts/emulateEsp32.js --url mqtt://mqtt:1883 --no-water
```

Muốn thấy dữ liệu giả lập trên dashboard, `HARDWARE_DEVICES=garden01=FARM-001` cũng phải được bật như ở bước 3.

Chi tiết về cách phát hiện sự cố trên phần cứng: [HARDWARE.md](HARDWARE.md).

## 5. Dừng, cập nhật, xóa dữ liệu

```powershell
docker compose --profile observability down        # dừng, giữ dữ liệu MongoDB
docker compose --env-file backend/.env --profile observability up -d --build   # sau khi sửa code
docker compose --profile observability down -v     # dừng và XÓA toàn bộ dữ liệu MongoDB
```

## 6. Kiểm thử

Image backend không chứa thư viện test. Chạy test trên máy bằng npm (không cần Docker):

```powershell
cd backend
npm install
npm run test:mvp; npm run test:pipeline; npm run test:retention; npm run test:hardware
```

## Xử lý sự cố

| Triệu chứng | Cách xử lý |
|---|---|
| `failed to connect to the docker API` | Docker Desktop chưa mở. |
| `port is already allocated` (5000, 8080, 27017, 1883) | Tắt backend/frontend/MongoDB đang chạy bằng npm hoặc dịch vụ khác dùng cổng đó. |
| Dashboard trống, không có farm | Chưa seed: chạy lệnh seed ở mục 2. |
| Datadog không có trace | `DD_APM_ENABLED=true` trong `backend/.env` và chạy `up` với `--env-file backend/.env`. |
| Datadog không có metric/log | Thiếu `--profile observability`, hoặc `DD_API_KEY` sai (`agent status` báo invalid). |
| ESP32 không kết nối | Sai IP trong `MQTT_BROKER`, hoặc firewall chặn cổng 1883. |
