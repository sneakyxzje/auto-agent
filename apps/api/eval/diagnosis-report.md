# Báo cáo chẩn đoán RAG

- Ngày chạy: 2026-08-07T03:03:00.934Z
- Tenant: ba8df478-6e73-4cbe-a574-955d55bba17b
- Bộ câu hỏi: C:\Users\Admin\Desktop\auto-agent\apps\api\eval\eval-set.json (39 câu, sinh lúc 2026-08-07T02:07:10.921Z)
- Config: retrievalTopK=20, gateTopK=12, gateChunkChars=2400, modelSmall=gpt-4.1-mini
- Token đã dùng cho chẩn đoán: input=588469, output=1888

## Tổng quan theo loại câu hỏi

| Loại | Tổng | Đạt | Trượt |
|---|---|---|---|
| direct | 10 | 9 | 1 |
| paraphrase | 10 | 9 | 1 |
| deep | 5 | 5 | 0 |
| synthesis | 4 | 2 | 2 |
| trap | 10 | 6 | 4 |

Câu kỳ vọng trả lời được: **25/29 PASS ở cấu hình hiện tại (V0)**.

## Câu trượt chết ở cửa nào

| Cửa | Số câu | % số câu trượt | Thuốc đề xuất |
|---|---|---|---|
| Cửa [3] — vào top-20 nhưng rớt khỏi top-12 đưa vào gate | 2 | 50% | Tăng gateTopK hoặc thêm rerank |
| Không biến thể nào cứu được — cần xem tay | 1 | 25% | Soi diagnosis-raw.json từng ca |
| Cửa [2] — đoạn cần thiết không vào top-20 | 1 | 25% | Multi-query / contextual chunk (xem tỷ lệ V3 cứu được) |

## Hiệu quả từng biến thể

- **V1 — gate nhìn nguyên văn chunk (bỏ cắt 1200 ký tự):** cứu 0/1 ca V0 từ chối ở bước gate.
- **V2 — gate prompt nới (cho phép ghép dữ kiện đã nêu, vẫn cấm ngoại suy):** cứu 0/1 ca V0 từ chối ở bước gate.
- **V1+V2 kết hợp:** cứu 0/1.
- **V3 — multi-query (tìm thêm bằng câu diễn đạt khác, hợp nhất RRF):** đưa đủ đoạn cần thiết vào top-12 ở 1/3 ca trượt retrieval/xếp hạng.

## An toàn câu bẫy (10 câu — bắt buộc 0 lọt)

| Biến thể | Số bẫy lọt | Kết luận |
|---|---|---|
| V0 | 3/10 | KHÔNG AN TOÀN |
| V1 | 3/10 | KHÔNG AN TOÀN |
| V2 | 4/10 | KHÔNG AN TOÀN |
| V1V2 | 4/10 | KHÔNG AN TOÀN |

Các bẫy bị lọt:
- `q030-trap` lọt ở V0, V1, V2, V1V2: BYSCOM có áp dụng chế độ làm việc ca đêm hay không?
- `q034-trap` lọt ở V2, V1V2: Quy trình chạy tool local được triển khai lần đầu tiên vào năm nào?
- `q035-trap` lọt ở V0, V1, V2, V1V2: Có trường hợp nào tool local không hoạt động sau khi setup không?
- `q039-trap` lọt ở V0, V1, V2, V1V2: Có các bước cụ thể nào để đào tạo nhân viên mới vị trí booking dịch vụ trong năm 2026?

## Chi tiết các câu trượt

- `q008-direct` [direct] → **ranking** (rank đoạn cần: c_85de2f7a=13) — multi-query CỨU ĐƯỢC (câu thay thế: "Trong trường hợp minh họa, mức phần trăm của khoản thù lao tính theo tỷ lệ là bao nhiêu?")
  "Trong ví dụ giả định, tỷ lệ hoa hồng là bao nhiêu phần trăm?"
- `q012-synthesis` [synthesis] → **unrescued** (rank đoạn cần: c_6cc034ee=1, c_9b1b0507=8)
  "Trong quy trình chạy quảng cáo trên mạng xã hội cho chương trình Affiliate tại Shopee, để tối ưu hiệu quả quảng cáo và đảm bảo giới hạn đối tượng mục tiêu, cần chú ý những yêu cầu và lưu ý quan trọng nào đối với việc tạo và quản lý Fanpage cũng như lịch chạy chiến dịch Ads?"
- `q016-paraphrase` [paraphrase] → **retrieval** (rank đoạn cần: c_415daa9e=ngoài top-20) — multi-query không cứu được
  "Dữ liệu trong ví dụ được lưu trữ trên máy tính tại thư mục nào?"
- `q029-synthesis` [synthesis] → **ranking** (rank đoạn cần: c_ea726949=1, c_2ade44ec=14) — multi-query không cứu được
  "Theo quy trình làm việc vị trí Booking dịch vụ 2026, nhân sự Booking cần thực hiện các bước gì để phân loại khách hàng và hoàn thành báo cáo tuần hàng tuần?"

## Giới hạn của phép đo

- Cửa [1] (viết lại truy vấn) chưa được đo: bộ câu hỏi là đơn lượt nên bước rewrite không chạy. Cần golden set hội thoại nhiều lượt (FR-7) để đo cửa này.
- PASS nghĩa là gate xác nhận đủ căn cứ (`enough_to_answer = true`); bước sinh câu trả lời và trích dẫn chưa chạy trong harness này.
- Do chunk chồng lấn 15%, dữ kiện có thể xuất hiện ở chunk hàng xóm ngoài nhãn `requiredChunkIds` — vài ca "retrieval" có thể thực tế vẫn trả lời được nhờ chunk khác; soi `diagnosis-raw.json` khi nghi ngờ.
