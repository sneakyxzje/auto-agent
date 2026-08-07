# Báo cáo chẩn đoán RAG

- Ngày chạy: 2026-08-07T03:03:30.949Z
- Tenant: ba8df478-6e73-4cbe-a574-955d55bba17b
- Bộ câu hỏi: eval/real-cases.json (9 câu, sinh lúc 2026-08-06T08:45:00.000Z)
- Config: retrievalTopK=20, gateTopK=12, gateChunkChars=2400, modelSmall=gpt-4.1-mini
- Token đã dùng cho chẩn đoán: input=91708, output=349

## Tổng quan theo loại câu hỏi

| Loại | Tổng | Đạt | Trượt |
|---|---|---|---|
| direct | 2 | 2 | 0 |
| paraphrase | 1 | 0 | 1 |
| deep | 4 | 3 | 1 |
| synthesis | 1 | 1 | 0 |
| trap | 1 | 1 | 0 |

Câu kỳ vọng trả lời được: **6/8 PASS ở cấu hình hiện tại (V0)**.

## Câu trượt chết ở cửa nào

| Cửa | Số câu | % số câu trượt | Thuốc đề xuất |
|---|---|---|---|
| Cửa [2] — đoạn cần thiết không vào top-20 | 2 | 100% | Multi-query / contextual chunk (xem tỷ lệ V3 cứu được) |

## Hiệu quả từng biến thể

- **V1 — gate nhìn nguyên văn chunk (bỏ cắt 1200 ký tự):** cứu 0/0 ca V0 từ chối ở bước gate.
- **V2 — gate prompt nới (cho phép ghép dữ kiện đã nêu, vẫn cấm ngoại suy):** cứu 0/0 ca V0 từ chối ở bước gate.
- **V1+V2 kết hợp:** cứu 0/0.
- **V3 — multi-query (tìm thêm bằng câu diễn đạt khác, hợp nhất RRF):** đưa đủ đoạn cần thiết vào top-12 ở 0/2 ca trượt retrieval/xếp hạng.

## An toàn câu bẫy (1 câu — bắt buộc 0 lọt)

| Biến thể | Số bẫy lọt | Kết luận |
|---|---|---|
| V0 | 0/1 | AN TOÀN |
| V1 | 0/1 | AN TOÀN |
| V2 | 0/1 | AN TOÀN |
| V1V2 | 0/1 | AN TOÀN |

Không câu bẫy nào bị trả lời ở bất kỳ biến thể nào.

## Chi tiết các câu trượt

- `real-03-phan-loai-khach-hang` [deep] → **retrieval** (rank đoạn cần: "phân loại khách hàng theo mục tiêu chuyể"=ngoài top-20) — multi-query không cứu được
  "QUY TRÌNH PHÂN LOẠI KHÁCH HÀNG THEO MỤC TIÊU CHUYỂN ĐỔI"
- `real-04-meeting-khach-hang` [paraphrase] → **retrieval** (rank đoạn cần: "bắt buộc meeting"=ngoài top-20) — multi-query không cứu được
  "meeting với khách hàng"

## Giới hạn của phép đo

- Cửa [1] (viết lại truy vấn) chưa được đo: bộ câu hỏi là đơn lượt nên bước rewrite không chạy. Cần golden set hội thoại nhiều lượt (FR-7) để đo cửa này.
- PASS nghĩa là gate xác nhận đủ căn cứ (`enough_to_answer = true`); bước sinh câu trả lời và trích dẫn chưa chạy trong harness này.
- Do chunk chồng lấn 15%, dữ kiện có thể xuất hiện ở chunk hàng xóm ngoài nhãn `requiredChunkIds` — vài ca "retrieval" có thể thực tế vẫn trả lời được nhờ chunk khác; soi `diagnosis-raw.json` khi nghi ngờ.
