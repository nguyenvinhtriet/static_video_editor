# Watermark Implementation Checklist

Để chèn watermark vào video một cách chuyên nghiệp và chính xác giữa Preview (Canvas) và Export (FFmpeg), cần thực hiện theo các bước sau:

## 1. Quản lý State & Upload
- [x] Tạo state lưu trữ file ảnh watermark (`watermarkFile`).
- [x] Tạo state lưu trữ URL của ảnh để hiển thị Preview (`watermarkUrl`).
- [x] Tạo các state điều khiển thuộc tính watermark:
  - `watermarkPos`: Vị trí (Top-Left, Top-Right, Bottom-Left, Bottom-Right).
  - `watermarkScale`: Kích thước tương đối so với video (ví dụ: 0.1 đến 0.5).
  - `watermarkOpacity`: Độ mờ (0.0 đến 1.0).

## 2. Xử lý Preview trên Canvas (Real-time)
- [x] Load ảnh watermark vào đối tượng `HTMLImageElement` ngay khi có URL.
- [x] Trong hàm `renderFrame` (vòng lặp requestAnimationFrame):
  - Vẽ video frame (đã áp dụng crop, zoom, color filter) lên canvas.
  - **Quan trọng:** Gọi `ctx.restore()` để reset các transform (zoom, mirror) của video, đảm bảo watermark không bị lật ngược hoặc phóng to theo video.
  - Tính toán kích thước watermark: `w = canvas.width * watermarkScale`, `h = (img.height / img.width) * w`.
  - Tính toán tọa độ `x`, `y` dựa trên `watermarkPos` (có padding 10px).
  - Đặt `ctx.globalAlpha = watermarkOpacity`.
  - Vẽ watermark: `ctx.drawImage(img, x, y, w, h)`.
  - Đặt lại `ctx.globalAlpha = 1.0`.

## 3. Xử lý Export với FFmpeg.wasm
- [x] Ghi file watermark vào hệ thống file ảo của FFmpeg: `ffmpeg.writeFile('watermark.png', file)`.
- [x] Thêm input thứ 2 vào lệnh FFmpeg: `-i watermark.png`.
- [x] Sử dụng `-filter_complex` thay vì `-vf` để xử lý đa luồng (video + ảnh):
  - **Bước 3.1:** Xử lý video gốc (crop, scale, flip, color, speed) và gán nhãn `[v_base]`.
  - **Bước 3.2:** Xử lý ảnh watermark (scale theo width video, chỉnh opacity bằng `colorchannelmixer`) và gán nhãn `[wm]`.
    - Ví dụ: `[1:v]scale=iw*0.2:-1,format=rgba,colorchannelmixer=aa=0.5[wm]`
  - **Bước 3.3:** Overlay watermark lên video gốc bằng filter `overlay`.
    - Ví dụ: `[v_base][wm]overlay=W-w-10:10[vout]`
- [x] Map luồng output cuối cùng (`-map [vout]`) và luồng audio (`-map [aout]`) để encode.

## 4. Đảm bảo tương thích (Fix lỗi "Kết quả không đạt")
- [x] Thêm cờ `-pix_fmt yuv420p` vào lệnh FFmpeg. Điều này cực kỳ quan trọng vì khi dùng filter phức tạp (như overlay RGBA), FFmpeg có thể xuất ra định dạng pixel mà trình duyệt không hỗ trợ phát (ví dụ yuv444p), dẫn đến video bị đen hoặc lỗi.
- [x] Sử dụng `-ss` và `-to` để hỗ trợ tính năng Trim (cắt video) chính xác.
