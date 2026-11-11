# Kết nối phần cứng ESP32 thật

FarmGuard đọc realtime trực tiếp từ board ESP32 chạy firmware `IOT/SmartAgriculture`, qua MQTT, không cần sửa firmware.

```
ESP32 (DHT22 + cảm biến ẩm đất + relay bơm)
   │  MQTT  smartgarden/<device>/telemetry · pump/state · status
   ▼
Mosquitto broker ──► HardwareBridgeService (backend)
                        ├─ MongoDB telemetry_ts (source: hardware)
                        ├─ Outcome assurance: relay ON + độ ẩm đất phải tăng
                        ├─ Incident / KPI / SSE tới dashboard
                        └─ Datadog: metrics, logs, traces, events
   ◄── pump/command, mode/command (FarmGuard gửi lệnh ON/OFF/AUTO/MANUAL)
```

## Hợp đồng MQTT (lấy từ `AppConfig.h`)

| Topic | Hướng | Payload |
|---|---|---|
| `smartgarden/garden01/telemetry` | ESP32 → | `{"temperature":27.1,"humidity":61.0,"soil":42.5,"pump":true,"mode":"AUTO"}`, mỗi 2.5 s và ngay sau mỗi lệnh |
| `smartgarden/garden01/pump/state` | ESP32 → | `ON` / `OFF`, khi đổi trạng thái + heartbeat 5 s |
| `smartgarden/garden01/status` | ESP32 → | `online` (retained) |
| `smartgarden/garden01/pump/command` | → ESP32 | `ON` / `OFF` |
| `smartgarden/garden01/mode/command` | → ESP32 | `AUTO` / `MANUAL` |

Ánh xạ sang FarmGuard: `soil` → series `humidity` (độ ẩm đất), `humidity` → `air_humidity`, `pump` → `pump_relay` (0/1). Giá trị `nan` khi DHT22 đọc lỗi được chấp nhận; chỉ trường lỗi bị bỏ qua và metric `smartfarm.sensor.read_error` tăng.

## Phát hiện sự cố trên phần cứng thật

Board **không có cảm biến dòng điện**, nên FarmGuard dùng bằng chứng sau:

| Sự cố | Điều kiện |
|---|---|
| `pump_no_effect` (silent failure) | Relay ON suốt `HARDWARE_EFFECT_WINDOW_MS` (mặc định 60 s) mà độ ẩm đất tăng < `HARDWARE_MIN_MOISTURE_RISE` (3 điểm). Ví dụ: bơm nằm ngoài bể, hết nước, tuột ống. |
| Phục hồi | Relay ON và độ ẩm tăng ≥ 3 điểm (so trung bình 3 mẫu đầu với 3 mẫu cuối, tính bằng aggregation MongoDB). |
| `pump_ack_timeout` | FarmGuard gửi `ON` nhưng relay không chuyển trong `HARDWARE_ACK_TIMEOUT_MS` (8 s). |
| Thiết bị offline | Không có telemetry trong `HARDWARE_STALE_MS` (15 s). Monitor Datadog **ESP32 device offline** sẽ báo. |

Firmware tự tưới ở chế độ AUTO (bật khi đất < 35%, tắt khi ≥ 75%). Mỗi lần relay bật, FarmGuard ghi lại thành một lệnh để kiểm chứng kết quả, giống hệt lệnh do FarmGuard gửi.

**Demo silent failure thật:** để cảm biến trong đất khô (relay tự bật), nhấc bơm ra khỏi bể nước, đợi 60 s → incident + Datadog Alert. Thả bơm lại vào nước → độ ẩm tăng → incident tự đóng có bằng chứng.

## Cài đặt

1. **Broker:** chạy Mosquitto và mở ra mạng LAN để ESP32 kết nối được:
   ```powershell
   docker compose up -d mqtt
   ```
   Broker đang cho phép kết nối không mật khẩu (`allow_anonymous true`). Chỉ dùng trong mạng LAN tin cậy.
2. **Firmware:** sửa `MQTT_BROKER` trong `AppConfig.h` thành IP LAN của máy chạy broker (xem `ipconfig`), nạp lại firmware.
3. **Backend** (`backend/.env`):
   ```text
   HARDWARE_DEVICES=garden01=FARM-001
   HARDWARE_MQTT_URL=mqtt://127.0.0.1:1883
   ```
   Farm trong `HARDWARE_DEVICES` sẽ không còn chạy simulator; dữ liệu của nó là dữ liệu thật.
4. Khởi động lại backend (`npm run start:apm`) và chạy `npm run datadog:provision` để có nhóm widget **Live ESP32 hardware** và monitor **ESP32 device offline**.
5. Kiểm tra: `GET http://localhost:5000/api/iot/hardware` hiển thị `online: true`, relay và độ ẩm mới nhất.

Gửi lệnh tới board:
```powershell
curl -X POST http://localhost:5000/api/iot/hardware/FARM-001/command -H "Content-Type: application/json" -d '{"action":"ON"}'
```

**Chưa có board?** `npm run hardware:emulate -- --no-water` giả lập đúng giao thức firmware; gõ `w` + Enter để “thả bơm vào nước”.

## Kiểm thử

- `npm run test:hardware`: JSON firmware có `nan`, lọc tin `pump/state` dồn dập, silent failure, phục hồi, offline.
- Đã chạy thử đầu-cuối qua MQTT thật (broker trong bộ nhớ + trình giả lập): mở incident khi chặn nước, tự đóng khi nước chảy, lệnh OFF được ACK sau 62 ms.

## Khuyến nghị cho firmware

1. **Không commit `AppConfig.h`**: file chứa mật khẩu WiFi. Tách `WIFI_SSID`/`WIFI_PASSWORD` sang `secrets.h` và gitignore file đó.
2. `publishPumpState()` đang chạy mỗi vòng `loop()` (~100 tin/giây). Backend đã chịu được, nhưng nên chỉ publish khi trạng thái thay đổi để giảm tải WiFi và broker.
3. Thêm **Last Will**: `mqttClient.connect(MQTT_CLIENT_ID, MQTT_TOPIC_STATUS, 0, true, "offline")` để broker báo offline ngay khi board mất điện.
4. Gắn cảm biến dòng (ACS712 hoặc SCT-013) để phân biệt “mô-tơ không quay” với “mô-tơ quay nhưng không có nước”.
