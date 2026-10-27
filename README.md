# mochi

## Hướng dẫn lần đầu

Sau khi tạo tài khoản mới và Mochi tải xong dữ liệu, người dùng chọn hoặc thêm các danh mục chi tiêu thường xuyên trước phần giới thiệu chung và tour sử dụng. Các lựa chọn này được gợi ý khi tạo hũ ngân sách; người dùng vẫn có thể nhập danh mục khác. Mọi số dư và giao dịch đều hiển thị bằng MO; ô nhập tự định dạng số và có thể đưa ra gợi ý nhanh.

Tour sẽ chỉ vào từng thành phần Home, gồm điểm danh, tổng quan, nguồn MO và hũ danh mục. Home chỉ hiển thị tổng thu, tổng chi và tổng cộng số dư của tất cả nguồn MO; số dư âm và khoản nợ được tính âm. Nút “Xem thêm số liệu” mở phần tổng nợ và MO đang cho mượn. Sau khi hoàn tất Home, tour dừng. Mỗi giao diện dashboard khác sẽ được hướng dẫn riêng khi người dùng mở giao diện đó lần đầu. Ngày ghi nhận và danh sách loại nguồn nằm trong “Tùy chọn nâng cao”. Danh sách gợi ý mặc định gồm tiền mặt, tài khoản và thẻ ghi nợ; có thể thêm, sửa hoặc xóa loại nguồn. Tên nguồn MO không bắt buộc. Gợi ý danh mục có thể thêm, sửa hoặc xóa trong tùy chọn nâng cao ở biểu mẫu giao dịch, đồng thời vẫn cho phép nhập danh mục tự do. Tiến độ tour được lưu riêng theo tài khoản trên thiết bị.

Trên Home, kéo nguồn MO bằng chuột hoặc chạm giữ rồi kéo trên điện thoại vào hũ danh mục đang chọn để mở phần nhập khoản chi. Khoản chi được ghi vào Giao dịch và cập nhật số dư nguồn ngay sau khi xác nhận. Nhấn vào hũ để mở danh mục nhỏ; khi chọn danh mục nhỏ, giao dịch được ghi theo mục đó nhưng vẫn cộng vào tổng đã chi của hũ cha. Dấu “+” thêm danh mục nhỏ mới. Các hũ tháng hiện tại chuyển qua lại bằng hai mũi tên. Các giao dịch gần đây được trình bày thành bong bóng chat, có ngày phía trên và chỉ để xem nhanh. Nhiệm vụ thưởng sao Mochi; dùng sao ở mục “Cửa hàng & tủ đồ Mochi” để mua phụ kiện và tùy chỉnh diện mạo. Số dư của nguồn MO có thể âm; phần âm được tính thành nợ và cộng theo dấu vào tổng số dư tất cả nguồn. Tên nguồn không bắt buộc; nếu bỏ trống, giao diện hiển thị tên loại nguồn.

Trong Cài đặt, người dùng có thể xuất toàn bộ dữ liệu ứng dụng và các tùy chỉnh thành tệp JSON để sao lưu, rồi nhập tệp đó để khôi phục. Nhập dữ liệu sẽ thay thế dữ liệu của tài khoản hiện tại; tài khoản và mật khẩu không nằm trong tệp sao lưu. Người dùng cũng có thể đặt lại dữ liệu ứng dụng bằng mật khẩu tài khoản hiện tại và xác nhận lần nữa. Thao tác này xóa giao dịch, ngân sách, mục tiêu, nhiệm vụ, nguồn MO, tiến trình và tùy chỉnh Mochi; tài khoản đăng nhập vẫn được giữ lại.

## Chạy ứng dụng và ChiChat

ChiChat trên giao diện hiện tổng kết dữ liệu ngay trong trình duyệt và không tự gửi dữ liệu tài chính ra ngoài. Backend có endpoint AI tùy chọn `POST /api/chat`; khi được gọi, endpoint chuyển nội dung tin nhắn và tên người dùng (nếu có) tới dịch vụ được cấu hình trong `AI_API_URL`. Không gửi thông tin tài chính nhạy cảm trong nội dung chat nếu chưa muốn chia sẻ với dịch vụ đó.

Chạy frontend:

   ```sh
   cd frontend
   npm install
   npm run dev
   ```

Mở địa chỉ Vite hiển thị trong terminal. ChiChat hiện không gọi endpoint AI của backend.

Backend dùng `express-rate-limit` để giới hạn 100 yêu cầu mỗi 15 phút cho `/api` và 10 yêu cầu mỗi 15 phút cho `/api/chat`. CORS chỉ cấp quyền truy cập trình duyệt cho các origin trong `CORS_ORIGINS`, là danh sách origin cách nhau bằng dấu phẩy. Sao chép `backend/.env.example` thành `backend/.env`, đặt `CORS_ORIGINS` thành domain frontend triển khai và cấu hình `AI_API_KEY` trước khi sử dụng endpoint AI. Tên người dùng gửi đến endpoint được kiểm tra định dạng 2–30 ký tự.