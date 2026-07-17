---
id: main-thread
title: Main Thread
position: 1
type: theory
estimatedMinutes: 12
---

# Main Thread

Trình duyệt phải phối hợp JavaScript, style, layout và paint trên một luồng thực thi chính. Khi JavaScript giữ main thread quá lâu, trình duyệt không thể phản hồi tương tác hoặc trình bày khung hình mới đúng lúc.

## Mục tiêu học tập

- Nhận biết những công việc cạnh tranh trên main thread.
- Hiểu vì sao một tác vụ dài làm giao diện mất phản hồi.
- Phân biệt công việc JavaScript với cơ hội rendering của trình duyệt.

## Mental model

Main thread không phải một hàng đợi dành riêng cho JavaScript. Nó là tài nguyên dùng chung cho nhiều giai đoạn của trải nghiệm giao diện.

> [!NOTE]
> Tối ưu không chỉ là làm cho một hàm chạy nhanh hơn. Mục tiêu là trả quyền điều khiển cho trình duyệt đủ sớm để xử lý input và render.

## Trước khi tiếp tục

Hãy bảo đảm bạn có thể giải thích điều gì xảy ra khi một callback JavaScript chạy liên tục trong 500 ms.
