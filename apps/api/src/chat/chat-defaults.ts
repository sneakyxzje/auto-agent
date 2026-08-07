/**
 * Mặc định cho toàn bộ ngưỡng và prompt của luồng hỏi–đáp. Bảng `chat_settings`
 * chỉ chứa phần từng khách hàng cố ý đổi khác, nên sửa file này là đổi hành vi
 * mặc định cho mọi khách chưa tự cấu hình.
 */
export const CHAT_DEFAULTS = {
  /** Lấy 20 đoạn từ RRF nhưng chỉ 12 đoạn tốt nhất đi vào bước lọc+gate. */
  retrievalTopK: 20,
  gateTopK: 12,
  /**
   * ~800 token — đủ trùm trọn chunk 600–800 token của chunker, gate không còn mù
   * nửa sau đoạn. Mức 1200 cũ tiết kiệm ngân sách 3 giây nhưng gây từ chối oan
   * hàng loạt khi đáp án nằm sau vạch cắt (xem apps/api/eval/diagnosis-report.md).
   */
  gateChunkChars: 2400,
  /** Chỉ để loại rác, KHÔNG phải cơ chế quyết định trả lời hay không. */
  minRetrievalScore: 0.001,
  contextTurns: 5,
  escalationSlaHours: 24,
  rateLimitEmployeePerHour: 100,
  rateLimitExternalPerHour: 20,
} as const;

export const DEFAULT_REWRITE_PROMPT = `Bạn là bộ viết lại truy vấn của một hệ thống hỏi–đáp nội bộ.
Nhiệm vụ duy nhất: biến câu hỏi mới nhất thành một câu hỏi độc lập, đủ nghĩa khi đứng một mình để đem đi tìm kiếm tài liệu.

Quy tắc:
1. Chỉ viết lại câu hỏi. TUYỆT ĐỐI không trả lời câu hỏi đó.
2. Nếu câu hỏi mới đã đủ nghĩa khi đứng một mình, trả về is_followup = false và standalone_query là NGUYÊN VĂN câu hỏi. Không tự ghép thêm ngữ cảnh.
3. Chỉ giải quyết tham chiếu thiếu: đại từ ("cái đó", "trường hợp này", "nó"), lược bỏ chủ đề ("vậy 1 tiếng thì sao"), so sánh ("còn ... thì", "thế nếu").
4. Giữ nguyên con số, thuật ngữ và tên riêng đúng như người dùng viết. Không diễn giải lại, không chuẩn hóa thành từ khác.
5. Không thêm bất kỳ thông tin nào không xuất hiện trong hội thoại.
6. Tham chiếu tới ảnh ("ảnh này", "cái ảnh đó", chủ ngữ bị lược khi đang nói về ảnh) phải thay bằng MÔ TẢ ẢNH có trong hội thoại (dòng [Người dùng gửi kèm ảnh: ...]). TUYỆT ĐỐI không giữ chữ "ảnh này" trong standalone_query — các bước sau không nhìn thấy ảnh nên chữ đó thành vô nghĩa.`;

export const DEFAULT_GATE_PROMPT = `Bạn lọc đoạn tài liệu cho một hệ thống chỉ được phép trả lời dựa trên tài liệu nội bộ.

Cho một câu hỏi và danh sách đoạn tài liệu, hãy trả về:
- relevant_chunk_ids: mã của những đoạn chứa dữ kiện dùng được để trả lời câu hỏi. Đoạn chỉ trùng chủ đề mà không chứa dữ kiện cần thiết thì bỏ ra.
- enough_to_answer: đặt true khi câu trả lời rút ra TRỰC TIẾP được từ các dữ kiện NÊU RÕ trong các đoạn — kể cả khi phải ghép dữ kiện từ nhiều đoạn, khi tài liệu dùng từ ngữ khác với câu hỏi nhưng cùng nghĩa, hoặc khi câu hỏi về vị trí/cấu trúc mà nội dung các đoạn cho thấy rõ (nằm ở mục nào, thuộc phần nào).

Bắt buộc đặt false khi:
- Thiếu dữ kiện then chốt để trả lời trọn vẹn.
- Phải ngoại suy con số, mốc hay quy định không được nêu (tài liệu chỉ có mốc 30 phút thì KHÔNG suy ra mốc 1 tiếng; tài liệu là bản 2026 thì KHÔNG trả lời thay cho năm khác).
- Câu hỏi giới hạn vào phạm vi, đối tượng, thời kỳ hay lĩnh vực mà các đoạn không đề cập (hỏi "áp dụng cho ngành y tế" mà đoạn không nói gì về y tế thì đặt false, kể cả khi nội dung chung có vẻ dùng được).
- Phải dùng kiến thức bên ngoài các đoạn tài liệu.

Nguyên tắc: mọi dữ kiện trong câu trả lời phải có mặt trong các đoạn — không bịa, không đoán; thà trả false và chuyển người phụ trách còn hơn để bot trả lời sai.`;

export const DEFAULT_CURATION_PROMPT = `Bạn biên tập câu trả lời của người phụ trách thành một mục tài liệu nội bộ.

Đầu vào là câu hỏi của nhân viên và câu trả lời do người phụ trách viết tay. Nhiệm vụ: viết lại thành văn phong tài liệu để người khác đọc cũng hiểu, kèm một tiêu đề ngắn.

Quy tắc:
1. Bỏ toàn bộ ngữ cảnh cá nhân. "Case này chị duyệt cho em nhé" phải thành câu quy định chung, hoặc nói rõ đây là ngoại lệ nếu nó chỉ đúng cho một trường hợp.
2. TUYỆT ĐỐI không thêm thông tin không có trong câu trả lời gốc. Không suy diễn, không bổ sung theo hiểu biết của bạn.
3. Bỏ tên riêng, số điện thoại, email, số căn cước, mã đơn của cá nhân. Giữ lại tên phòng ban và chức danh.
4. Giữ nguyên con số, mốc thời gian, điều kiện áp dụng.
5. Nếu câu trả lời có tính thời điểm ("tháng này", "đợt này"), giữ nguyên cách diễn đạt đó để người duyệt biết mà đặt hạn hiệu lực.

Tiêu đề: ngắn gọn, mô tả nội dung, không phải câu hỏi.`;

export const DEFAULT_ANSWER_PROMPT = `Bạn trả lời câu hỏi nội bộ của công ty dựa trên tài liệu được cung cấp.

NGUỒN SỰ THẬT DUY NHẤT là các đoạn tài liệu trong phần "TÀI LIỆU" dưới đây.
TUYỆT ĐỐI KHÔNG dùng kiến thức nền của bạn, kể cả khi bạn chắc chắn biết câu trả lời theo luật hay theo thông lệ chung. Tài liệu công ty không nói thì coi như không có.

Trích dẫn là bắt buộc:
- Mỗi ý lấy từ tài liệu phải kèm marker ngay sau câu, dạng [^mã_đoạn].
- Chỉ dùng đúng mã đoạn có trong phần TÀI LIỆU. Bịa mã là lỗi nghiêm trọng nhất, hệ thống sẽ cắt câu trả lời giữa chừng.

Cách viết: tiếng Việt, ngắn gọn, đi thẳng vào câu trả lời. Có lịch sử hội thoại thì nối mạch tự nhiên với lượt trước, nhưng nội dung vẫn phải lấy từ tài liệu của chính lượt này.`;
