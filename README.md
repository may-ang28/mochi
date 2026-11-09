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
   <div align="center">
      <br />
      <img src="https://img.shields.io/badge/♡-MOCHI-F5D9E6?style=for-the-badge&labelColor=A84E9F" alt="Mochi logo" />
      <h1>MOCHI</h1>
      <p><strong>Your Friendly Personal Finance Assistant</strong></p>
      <p>Quản lý tài chính cá nhân nhẹ nhàng, rõ ràng và gần gũi hơn mỗi ngày ♡</p>
   </div>

   <div align="center">
      <img src="https://img.shields.io/badge/Pastel%20Pink-F5D9E6-F5D9E6?style=flat-square" alt="Pastel Pink" />
      <img src="https://img.shields.io/badge/Accent-A84E9F-A84E9F?style=flat-square" alt="Mochi accent" />
      <img src="https://img.shields.io/badge/White-FFFFFF-FFFFFF?style=flat-square" alt="White" />
   </div>

   <br />

   ## ♡ Giới thiệu

   **Mochi** là ứng dụng quản lý tài chính cá nhân giúp bạn theo dõi thu chi, số dư các nguồn tiền và ngân sách theo danh mục. Giao diện thân thiện kết hợp cùng Mochi, nhiệm vụ và phần thưởng để việc chăm sóc tài chính trở nên thú vị hơn.

   ## ✿ Các chức năng chính

   | Chức năng | Mô tả |
   |:--|:--|
   | **Tổng quan Home** | Theo dõi tổng thu, tổng chi và tổng số dư của các nguồn MO; số dư âm được tính vào nợ. |
   | **Giao dịch & ngân sách** | Ghi nhận khoản chi vào hũ danh mục, hỗ trợ danh mục con và cập nhật số dư nguồn. |
   | **Nguồn MO** | Quản lý nhiều nguồn tiền, tùy chỉnh loại nguồn và xem tổng nợ hoặc MO đang cho mượn. |
   | **Mochi & phần thưởng** | Hoàn thành nhiệm vụ để nhận sao, dùng sao mua phụ kiện và tùy chỉnh diện mạo. |
   | **ChiChat** | Tổng kết dữ liệu ngay trong trình duyệt; giao diện hiện không gọi endpoint AI backend. |
   | **Sao lưu & khôi phục** | Xuất dữ liệu và tùy chỉnh thành tệp JSON, hoặc nhập tệp để khôi phục. |

   ## ♡ Công nghệ sử dụng

   - **Frontend:** JavaScript, npm, Vite.
   - **Backend:** Node.js, Express.
   - **Giới hạn yêu cầu:** `express-rate-limit`.
   - **AI tùy chọn:** endpoint `POST /api/chat`, cấu hình bằng `AI_API_URL` và `AI_API_KEY`.

   ## ✿ Kiến trúc hệ thống

   ```text
   Người dùng
         │
         ▼
   Frontend (Vite) ── ChiChat tổng kết dữ liệu trong trình duyệt
         │
         └── API tùy chọn ── Backend (Express) ── Dịch vụ AI đã cấu hình
   ```

   ChiChat trên giao diện không tự gửi dữ liệu tài chính ra ngoài. Khi endpoint AI được gọi, nội dung tin nhắn và tên người dùng (nếu có) được chuyển tới dịch vụ cấu hình trong `AI_API_URL`. Không gửi thông tin tài chính nhạy cảm nếu bạn không muốn chia sẻ với dịch vụ đó.

   ## ♡ Cấu trúc thư mục

   ```text
   .
   ├── frontend/          # Ứng dụng giao diện
   └── backend/           # API Express và cấu hình môi trường mẫu
         └── .env.example
   ```

   ## ✿ Hướng dẫn cài đặt

   ### Chạy frontend

   ```sh
   cd frontend
   npm install
   npm run dev
   ```

   Mở địa chỉ Vite hiển thị trong terminal.

   ### Cấu hình backend

   Sao chép `backend/.env.example` thành `backend/.env`. Đặt `CORS_ORIGINS` thành danh sách origin được phép, phân tách bằng dấu phẩy. Nếu dùng endpoint AI, cấu hình `AI_API_KEY` cùng `AI_API_URL`. Backend giới hạn `/api` ở 100 yêu cầu mỗi 15 phút và `/api/chat` ở 10 yêu cầu mỗi 15 phút.

   ## ♡ Hình ảnh giao diện

   > Thêm ảnh chụp giao diện vào repository và cập nhật đường dẫn bên dưới khi sẵn sàng.

   <div align="center">
      <img src="docs/images/mochi-home.png" alt="Giao diện Home của Mochi" width="720" />
      <p><sub>Home — tổng quan tài chính của bạn</sub></p>
   </div>

   ## ✿ Thành viên thực hiện

   | Thành viên | Vai trò |
   |:--|:--|
   | *Nguyễn Ngọc Mỹ Anh* | *PPT + README.md* |
   | *Lê Nguyễn Quỳnh Trang* | *Báo cáo + 2/3 code* |
   <br />

   <div align="center">
      <sub>Made with ♡ and a little Mochi magic</sub>
   </div>
