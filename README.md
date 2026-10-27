# mochi

## Hướng dẫn lần đầu

Sau khi tạo tài khoản mới và Mochi tải xong dữ liệu, người dùng sẽ xem giới thiệu chung về ứng dụng và đơn vị MO trước khi bắt đầu tour Home. Mọi số dư và giao dịch đều hiển thị bằng MO; ô nhập tự định dạng số và có thể đưa ra gợi ý nhanh.

Tour sẽ chỉ vào từng thành phần Home, gồm điểm danh, tổng quan, các hũ và thao tác kéo hũ ngân sách thả vào hũ Mochi. Home chỉ hiển thị tổng thu, tổng chi và tổng cộng số dư của tất cả nguồn MO; số dư âm và khoản nợ được tính âm. Nút “Xem thêm số liệu” mở phần tổng nợ và MO đang cho mượn. Sau khi hoàn tất Home, tour dừng. Mỗi giao diện dashboard khác sẽ được hướng dẫn riêng khi người dùng mở giao diện đó lần đầu. Các trường ngày/tháng và tùy chỉnh cách tính, danh sách loại nguồn nằm trong “Tùy chọn nâng cao”. Danh sách loại nguồn được lưu theo tài khoản và có thể thêm, sửa hoặc xóa; tên nguồn MO không bắt buộc. Gợi ý danh mục có thể thêm, sửa hoặc xóa trong tùy chọn nâng cao ở biểu mẫu giao dịch, đồng thời vẫn cho phép nhập danh mục tự do. Tiến độ tour được lưu riêng theo tài khoản trên thiết bị.

Các viên Mochi ngân sách trên Home có thể được kéo bằng chuột hoặc chạm giữ rồi kéo trên điện thoại vào hũ để ghi nhanh khoản chi. Sau khi nhập số MO, Mochi sẽ rơi và nảy nhẹ bên trong hũ. Nhiệm vụ thưởng sao Mochi; dùng sao ở mục “Cửa hàng & tủ đồ Mochi” để mua phụ kiện và tùy chỉnh diện mạo. Số dư của nguồn MO có thể âm; phần âm được tính thành nợ và cộng theo dấu vào tổng số dư tất cả nguồn. Tên nguồn không bắt buộc; nếu bỏ trống, giao diện hiển thị tên loại nguồn.

Trong Cài đặt, người dùng có thể đặt lại dữ liệu ứng dụng bằng mật khẩu tài khoản hiện tại và xác nhận lần nữa. Thao tác xóa giao dịch, ngân sách, mục tiêu, nhiệm vụ, nguồn MO, tiến trình và tùy chỉnh Mochi; tài khoản đăng nhập vẫn được giữ lại.

## Chạy ứng dụng và chatbot

Chatbot Mochi đã được tích hợp vào giao diện. Để nhận câu trả lời từ AI, cần chạy cả frontend và backend, đồng thời cấu hình API key ở backend.

1. Tạo file `backend/.env` từ `backend/.env.example` và điền API key của dịch vụ AI. Không đưa API key lên Git.
2. Mở terminal thứ nhất:

   ```sh
   cd backend
   npm install
   npm run dev
   ```

3. Mở terminal thứ hai:

   ```sh
   cd frontend
   npm install
   npm run dev
   ```

Mở địa chỉ Vite hiển thị trong terminal. Backend mặc định chạy tại `http://localhost:3000`; có thể cấu hình `AI_API_URL`, `AI_MODEL` và `PORT` trong `backend/.env`. Nếu dùng backend ở địa chỉ khác, đặt `VITE_API_URL` cho frontend.