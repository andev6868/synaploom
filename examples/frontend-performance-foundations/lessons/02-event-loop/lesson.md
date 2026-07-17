---
id: event-loop
title: Event Loop
position: 2
type: mixed
estimatedMinutes: 20
exercise: exercise.json
---

# Event Loop

Event Loop phối hợp call stack, task queue, microtask queue và các cơ hội rendering. Trong bài này, bạn sẽ dự đoán rồi kiểm chứng thứ tự thực thi thay vì chỉ ghi nhớ một sơ đồ.

## Mục tiêu học tập

- Phân biệt task và microtask.
- Dự đoán thứ tự log của `setTimeout` và `Promise`.
- Chạy một chương trình Node.js thật trong local workspace.
- Sửa mã nguồn và dùng evaluator để kiểm chứng.

## Bài tập

1. Chạy action **Chạy chương trình** và quan sát output hiện tại.
2. Chạy action **Kiểm tra kết quả**. Lần đầu evaluator sẽ thất bại.
3. Thêm microtask sau lệnh `setTimeout`:

```js
Promise.resolve().then(() => console.log('promise'));
```

4. Chạy lại evaluator. Output đúng phải là:

```text
start
end
promise
timeout
```

> [!HINT]
> Microtask được drain sau khi call stack rỗng, trước khi Event Loop chọn task timer tiếp theo.
