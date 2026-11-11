# Kịch bản video demo FarmGuard (khoảng 4 phút)

Video theo đúng luồng giám khảo chấm: **phát hiện → điều tra → xử lý → chứng minh**, dùng dữ liệu thật của hệ thống.

## Chuẩn bị (trước khi bấm quay)

```powershell
# Thư mục gốc repo
docker compose --env-file backend/.env --profile observability up -d mongodb datadog-agent
cd backend; npm run start:apm          # terminal 1
cd ..; npm run dev                     # terminal 2 → http://localhost:5173
```

- Để backend chạy **ít nhất 30 phút** trước khi quay, cho đồ thị Datadog có lịch sử và monitor anomaly học được dải bình thường.
- Đảm bảo **không có incident đang mở** ở `/incidents`. Nếu có, xử lý nó trước: Failure Demo Lab → bước 2 Restore → bước 3 Retry.
- Mở sẵn các tab trình duyệt:
  1. `http://localhost:5173/simulation`
  2. `http://localhost:5173/incidents`
  3. Datadog dashboard *FarmGuard | Irrigation Outcome Assurance*
  4. Datadog **Monitors** → lọc `tag:project:farmguard`
- Công cụ quay: **Xbox Game Bar** (`Win + Alt + R`, có sẵn trên Windows), hoặc OBS Studio. Quay 1920×1080 và thu âm micro.
- Phóng to trình duyệt khoảng 110% để chữ rõ khi xem trên màn hình nhỏ.

## Danh sách cảnh

| # | Thời lượng | Màn hình | Thao tác | Lời thoại |
|---|---|---|---|---|
| 1 | 0:00–0:20 | Slide 1 (cover) | Không | “Xin chào, em là Nguyễn Thành Kiệt, đội TENET. FarmGuard đảm bảo một điều: lệnh tưới chỉ thành công khi dữ liệu chứng minh nước đã tới đất, không phải khi thiết bị trả ACK.” |
| 2 | 0:20–0:45 | Slide 2–3 | Chuyển slide | “Hệ thống tưới thường tin vào ACK. Nhưng mô-tơ có thể mất pha hay cháy cuộn dây, dashboard vẫn xanh còn ruộng thì khô. FarmGuard yêu cầu đủ ba bằng chứng: ACK, dòng điện mô-tơ, và độ ẩm tăng.” |
| 3 | 0:45–1:00 | Datadog dashboard | Cuộn qua dashboard | “Đây là trạng thái bình thường trên Datadog: độ ẩm, dòng điện bơm, ba farm đều khỏe, mọi monitor đều OK.” |
| 4 | 1:00–1:20 | `/simulation` | Chọn **FARM-002**, bấm **Inject silent pump failure** | “Bây giờ em mô phỏng sự cố: mô-tơ farm 2 mất nguồn, nhưng bộ điều khiển vẫn trả ACK như không có gì.” |
| 5 | 1:20–1:45 | `/simulation` | Chờ thẻ *Measured pump current* về khoảng 0.03 A | “Lệnh có ACK, nhưng dòng điện chỉ 0.03 ampe và độ ẩm tiếp tục giảm. Chỉ sau khoảng 6 giây, FarmGuard đã mở incident.” |
| 6 | 1:45–2:15 | Datadog Monitors | Mở monitor **ACK received but irrigation outcome missing** đang **Alert**; mở thông báo | “Monitor trên Datadog chuyển sang Alert. Tin nhắn cảnh báo có sẵn link tới dashboard đã lọc theo farm và tới log.” |
| 7 | 2:15–2:45 | Datadog Logs → Trace | Bấm link log, mở log `irrigation.outcome_missing`, chỉ vào `correlationId`, bấm sang tab **Trace** | “Log có correlationId và trace_id. Bấm một lần là sang trace của đúng lần xử lý đó, thấy cả các truy vấn MongoDB bên trong.” |
| 8 | 2:45–3:05 | `/incidents` | Cuộn tới incident đang mở | “Trong ứng dụng, Incident Center hiển thị bằng chứng tính bằng aggregation trên MongoDB: ACK đã nhận, 0.04 ampe, độ ẩm giảm.” |
| 9 | 3:05–3:30 | `/simulation` | Bấm **2. Restore controller and pump power** rồi **3. Retry and verify physical outcome** | “Operator khôi phục nguồn và gửi lệnh sửa mới, vẫn cùng correlationId. Incident chưa đóng ngay; hệ thống chờ bằng chứng.” |
| 10 | 3:30–3:50 | `/incidents` rồi Datadog | Chờ **RECOVERY PROVEN**; chuyển sang Datadog thấy monitor về **OK** | “Dòng điện khoảng 1.8 ampe, độ ẩm tăng lại: incident được đóng, monitor trở về OK, và MTTD, MTTR được cập nhật.” |
| 11 | 3:50–4:10 | Slide 11 (impact) rồi slide 13 | Chuyển slide | “Phát hiện trong 6 giây thay vì khoảng 12 giờ chờ ra đồng. Đừng tin ACK, hãy tin dữ liệu. Cảm ơn ban giám khảo.” |

## Mẹo

- **Cảnh 6 có độ trễ:** monitor đánh giá theo cửa sổ 1 phút, nên Alert có thể xuất hiện sau 1–2 phút. Hãy quay liền rồi cắt bớt đoạn chờ, hoặc chèn chữ “~1 phút sau”.
- **Cảnh 10:** monitor về OK chậm hơn app khoảng 1–2 phút; cắt ghép tương tự.
- Nếu Datadog không hiện trace, kiểm tra backend đang chạy bằng `npm run start:apm`, không phải `npm run dev`.
- Lời thoại cũng có sẵn trong speaker notes của từng slide.
- Dựng video bằng **Clipchamp** (có sẵn trên Windows 11): cắt đoạn chờ, thêm phụ đề tự động.
