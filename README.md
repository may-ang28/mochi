# mochi

## Hướng dẫn lần đầu

Sau khi tạo tài khoản mới và Mochi tải xong dữ liệu, người dùng chọn hoặc thêm các danh mục chi tiêu thường xuyên trước phần giới thiệu chung và tour sử dụng. Các lựa chọn này được gợi ý khi tạo hũ ngân sách; người dùng vẫn có thể nhập danh mục khác. Mọi số dư và giao dịch đều hiển thị bằng MO; ô nhập tự định dạng số và có thể đưa ra gợi ý nhanh.

Tour sẽ chỉ vào từng thành phần Home, gồm điểm danh, tổng quan, nguồn MO và hũ danh mục. Home chỉ hiển thị tổng thu, tổng chi và tổng cộng số dư của tất cả nguồn MO; số dư âm và khoản nợ được tính âm. Nút “Xem thêm số liệu” mở phần tổng nợ và MO đang cho mượn. Sau khi hoàn tất Home, tour dừng. Mỗi giao diện dashboard khác sẽ được hướng dẫn riêng khi người dùng mở giao diện đó lần đầu. Ngày ghi nhận và danh sách loại nguồn nằm trong “Tùy chọn nâng cao”. Danh sách gợi ý mặc định gồm tiền mặt, tài khoản và thẻ ghi nợ; có thể thêm, sửa hoặc xóa loại nguồn. Tên nguồn MO không bắt buộc. Gợi ý danh mục có thể thêm, sửa hoặc xóa trong tùy chọn nâng cao ở biểu mẫu giao dịch, đồng thời vẫn cho phép nhập danh mục tự do. Tiến độ tour được lưu riêng theo tài khoản trên thiết bị.

Trên Home, kéo nguồn MO bằng chuột hoặc chạm giữ rồi kéo trên điện thoại vào hũ danh mục đang chọn để mở phần nhập khoản chi. Khoản chi được ghi vào Giao dịch và cập nhật số dư nguồn ngay sau khi xác nhận. Nhấn vào hũ để mở danh mục nhỏ; khi chọn danh mục nhỏ, giao dịch được ghi theo mục đó nhưng vẫn cộng vào tổng đã chi của hũ cha. Dấu “+” thêm danh mục nhỏ mới. Các hũ tháng hiện tại chuyển qua lại bằng hai mũi tên. Các giao dịch gần đây được trình bày thành bong bóng chat, có ngày phía trên và chỉ để xem nhanh. Nhiệm vụ thưởng sao Mochi; dùng sao ở mục “Cửa hàng & tủ đồ Mochi” để mua phụ kiện và tùy chỉnh diện mạo. Số dư của nguồn MO có thể âm; phần âm được tính thành nợ và cộng theo dấu vào tổng số dư tất cả nguồn. Tên nguồn không bắt buộc; nếu bỏ trống, giao diện hiển thị tên loại nguồn.

Trong Cài đặt, người dùng có thể xuất toàn bộ dữ liệu ứng dụng và các tùy chỉnh thành tệp JSON để sao lưu, rồi nhập tệp đó để khôi phục. Nhập dữ liệu sẽ thay thế dữ liệu của tài khoản hiện tại; tài khoản và mật khẩu không nằm trong tệp sao lưu. Người dùng cũng có thể đặt lại dữ liệu ứng dụng bằng mật khẩu tài khoản hiện tại và xác nhận lần nữa. Thao tác này xóa giao dịch, ngân sách, mục tiêu, nhiệm vụ, nguồn MO, tiến trình và tùy chỉnh Mochi; tài khoản đăng nhập vẫn được giữ lại.

## Chạy ứng dụng và ChiChat

ChiChat trên giao diện hiện tổng kết dữ liệu ngay trong trình duyệt và không tự gửi dữ liệu tài chính ra ngoài. Frontend hiện không gọi `POST /api/chat`. Endpoint này đang bị vô hiệu hóa: route trả HTTP 503 thay vì xử lý tin nhắn hoặc gọi dịch vụ AI. Vì rate limit chung được áp dụng trước route, request vượt giới hạn `/api` có thể nhận HTTP 429 trước khi tới route.

Chạy frontend:

   ```sh
   cd frontend
   npm install
   npm run dev
   ```

Mở địa chỉ Vite hiển thị trong terminal.

Backend có `GET /`, trả thông báo backend đang chạy, và `GET /api/health`, trả trạng thái API. `express-rate-limit` giới hạn chung 100 yêu cầu mỗi 15 phút cho các đường dẫn `/api`; do đó, khi vượt giới hạn middleware có thể trả HTTP 429. Nếu request tới được route, `POST /api/chat` luôn trả HTTP 503 vì endpoint đang bị vô hiệu hóa. CORS cho phép các origin được liệt kê trong `CORS_ORIGINS` (mặc định `http://localhost:5173`); request không có header `Origin` vẫn được chấp nhận. Frontend hiện không gọi endpoint chat, nên không cần cấu hình `AI_API_KEY` để chạy giao diện.