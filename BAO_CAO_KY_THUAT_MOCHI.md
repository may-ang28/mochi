# Báo cáo khảo sát kỹ thuật dự án Mochi

**Ngày lập:** 05/11/2026  
**Phạm vi:** Kiến trúc, chức năng, dependency, dữ liệu, backend, bảo mật, kiểm thử và triển khai.  
**Mục đích:** Tài liệu tham khảo phục vụ tìm hiểu và viết báo cáo đồ án.  
**Cách đọc:** Các bảng dưới đây dùng cú pháp Markdown tiêu chuẩn. Tài liệu không nhúng hình ảnh bên ngoài; sơ đồ ERD được trình bày bằng danh sách quan hệ văn bản để tránh lỗi tải ảnh hoặc lỗi render sơ đồ khi xuất tài liệu.

> **Giới hạn của báo cáo:** Đây là nhận xét dựa trên mã nguồn và cấu hình đã khảo sát. Những thông tin không thể xác nhận chỉ từ source, chẳng hạn hoạt động thực tế trên hosting, lịch sử triển khai, nghiên cứu người dùng hoặc toàn bộ lịch sử Git, được ghi rõ là cần kiểm tra thêm.

## 1. Tóm tắt điều hành

Mochi hiện là ứng dụng web quản lý tài chính cá nhân, trong đó phần lớn chức năng và dữ liệu được xử lý ở frontend. Dữ liệu tài chính được lưu trong IndexedDB trên trình duyệt thông qua Dexie. Tài khoản hiện là tài khoản cục bộ trên thiết bị; source đã khảo sát không cho thấy backend authentication hoặc đồng bộ dữ liệu cloud.

Backend Express hiện có endpoint kiểm tra trạng thái và endpoint `/api/chat` đang bị vô hiệu hóa, trả HTTP 503. Frontend không gọi endpoint chat này. ChiChat trên giao diện hiện tổng hợp và phản hồi dựa trên dữ liệu cục bộ, không phải một dịch vụ AI hội thoại tự do.

Các điểm cần diễn đạt chính xác trong báo cáo đồ án:

- Đây là ứng dụng lưu dữ liệu cục bộ trên trình duyệt, không nên mô tả là đã có đồng bộ cloud hoặc xác thực tài khoản server.
- Cấu hình rate limit được dùng thực tế trong backend; API chat vẫn tắt.
- Build frontend từng được xác nhận thành công; điều đó không chứng minh toàn bộ chức năng đã được kiểm thử.
- Chưa xác minh cấu hình triển khai production hoặc toàn bộ lịch sử Git để kết luận về secret đã từng được commit.

## 2. Kiến trúc tổng quan

| Thành phần | Công nghệ hoặc trách nhiệm | Vị trí chính |
|---|---|---|
| Giao diện web | React, TypeScript, Vite; hiển thị các trang và điều phối tương tác | `frontend/src/App.tsx` |
| Lưu trữ dữ liệu | Dexie trên IndexedDB của trình duyệt | `frontend/src/db.ts` |
| Xác thực cục bộ | Hồ sơ và session lưu trên thiết bị; mật khẩu được băm ở phía trình duyệt | `frontend/src/auth.ts` |
| Nghiệp vụ tài chính | Tính số dư nguồn tiền, nợ và tổng tài chính | `frontend/src/utils/finance.ts` |
| Điểm sao | Cập nhật điểm và lịch sử thay đổi điểm | `frontend/src/utils/points.ts` |
| Sao lưu | Xuất/nhập dữ liệu JSON và kiểm tra một số liên kết dữ liệu | `frontend/src/backup.ts` |
| Backend | Express, CORS, rate limiting, health check; chat hiện tắt | `backend/src/server.ts` |
| ChiChat | Tổng hợp thu/chi và tạo phản hồi/cảnh báo dựa trên số liệu cục bộ | `frontend/src/AssistantWidget.tsx` |

Luồng xử lý dữ liệu chính:

1. Người dùng thao tác trên giao diện React.
2. Frontend đọc hoặc cập nhật database IndexedDB của tài khoản hiện tại qua Dexie.
3. Các phép tính tài chính và điểm sao chạy trong frontend.
4. Frontend hiện không gọi `POST /api/chat`; backend không phải nơi lưu dữ liệu tài chính trong luồng đã khảo sát.

## 3. Công nghệ và dependency

Các phiên bản dưới đây được ghi nhận từ manifest và lockfile đã khảo sát. Lockfile là nguồn đối chiếu phiên bản cài đặt đã khóa.

| Khu vực | Dependency/công nghệ | Phiên bản đã thấy | Vai trò |
|---|---|---:|---|
| Frontend | React | 19.3.0 | Xây dựng giao diện |
| Frontend | Dexie | 4.4.6 | Làm việc với IndexedDB |
| Frontend | Vite | 8.3.5 | Dev server và build |
| Frontend | TypeScript | 6.0.3 | Kiểu tĩnh cho frontend |
| Frontend | Tailwind CSS | 4.3.3 | CSS utility |
| Frontend | `vite-plugin-pwa` | 1.1.0 | Tích hợp khả năng PWA |
| Backend | Express | 5.2.1 | HTTP server và route |
| Backend | CORS | 2.8.6 | Cấu hình cross-origin |
| Backend | dotenv | 18.0.7 | Đọc biến môi trường |
| Backend | express-rate-limit | 8.7.1 | Giới hạn tần suất request |
| Backend | TypeScript | 7.0.2 | Kiểu tĩnh cho backend |

File cần đối chiếu trực tiếp:

- `frontend/package.json`
- `frontend/package-lock.json`
- `backend/package.json`
- `backend/package-lock.json`

Chưa thấy bằng chứng trong các source đã khảo sát về ORM hoặc cơ sở dữ liệu server như PostgreSQL/MySQL. Dữ liệu cốt lõi hiện nằm trong IndexedDB trên thiết bị.

## 4. Chức năng chính

| Chức năng | Mô tả theo source đã khảo sát | File liên quan |
|---|---|---|
| Đăng ký/đăng nhập | Xác thực cục bộ trên trình duyệt; không phải tài khoản xác thực bởi backend | `frontend/src/auth.ts`, `frontend/src/App.tsx` |
| Giao dịch | Ghi nhận thu/chi và liên kết nguồn tiền | `frontend/src/App.tsx`, `frontend/src/db.ts` |
| Nguồn tiền | Theo dõi số dư từng nguồn; khoản âm có thể được tính là nợ theo logic nghiệp vụ | `frontend/src/utils/finance.ts` |
| Ngân sách | Lưu hạn mức chi tiêu theo danh mục/tháng | `frontend/src/db.ts`, `frontend/src/App.tsx` |
| Mục tiêu tiết kiệm | Lưu mục tiêu và các lần đóng góp; đóng góp có thể đi kèm giao dịch | `frontend/src/db.ts`, `frontend/src/backup.ts` |
| Điểm sao | Tự động cộng/trừ điểm theo một số sự kiện ứng dụng | `frontend/src/utils/points.ts`, `frontend/src/App.tsx` |
| Biểu đồ và tổng hợp | Hiển thị các số liệu tài chính được tính từ dữ liệu local | `frontend/src/App.tsx` và các component liên quan |
| ChiChat | Tổng hợp số liệu và cảnh báo theo quy tắc cục bộ; không thấy gọi mô hình AI | `frontend/src/AssistantWidget.tsx` |
| Sao lưu/khôi phục | Xuất và nhập JSON; một số quan hệ ID được kiểm tra khi nhập | `frontend/src/backup.ts` |
| Hướng dẫn sử dụng | Tour onboarding trong giao diện | `frontend/src/OnboardingGuide.tsx` |

## 5. Mô hình dữ liệu

### 5.1 Các bảng IndexedDB

Schema Dexie đã khảo sát gồm các nhóm dữ liệu sau:

| Bảng | Dữ liệu lưu | Khóa/ghi chú |
|---|---|---|
| `transactions` | Giao dịch thu/chi, số tiền, danh mục, ngày, nguồn tiền | Có ID; có thể tham chiếu nguồn chính và nguồn liên quan |
| `moneySources` | Nguồn tiền và số dư | Có thể liên kết giao dịch số dư ban đầu |
| `budgets` | Hạn mức ngân sách | Gắn với danh mục và kỳ áp dụng |
| `goals` | Mục tiêu tiết kiệm, số tiền mục tiêu và tiến độ | Có cờ tránh nhận thưởng mục tiêu trùng |
| `goalContributions` | Các lần đóng góp vào mục tiêu | Liên kết goal, source và transaction |
| `tasks` | Các nhiệm vụ/ghi nhận nhiệm vụ được lưu | Có thể liên kết mục tiêu |
| `points` | Lịch sử cộng/trừ điểm | Ghi số điểm, lý do và thời gian |

Các ID liên kết chủ yếu do ứng dụng kiểm tra và duy trì. Không nên diễn đạt đây là các khóa ngoại được database cưỡng chế như trong hệ quản trị SQL.

### 5.2 Quan hệ logic

Danh sách dưới đây là biểu diễn văn bản của ERD, không phụ thuộc ảnh nhúng:

| Thực thể nguồn | Quan hệ | Thực thể đích | Ý nghĩa |
|---|---|---|---|
| Tài khoản cục bộ | Có một | Database IndexedDB riêng theo khóa tài khoản | Phân vùng dữ liệu trên thiết bị |
| Database tài khoản | Chứa nhiều | `transactions` | Giao dịch của tài khoản |
| Database tài khoản | Chứa nhiều | `moneySources` | Nguồn tiền của tài khoản |
| Database tài khoản | Chứa nhiều | `budgets` | Ngân sách của tài khoản |
| Database tài khoản | Chứa nhiều | `goals` | Mục tiêu của tài khoản |
| Database tài khoản | Chứa nhiều | `goalContributions` | Lịch sử đóng góp |
| Database tài khoản | Chứa nhiều | `tasks` | Nhiệm vụ được lưu |
| Database tài khoản | Chứa nhiều | `points` | Lịch sử thay đổi sao |
| `moneySources` | Được tham chiếu bởi | `transactions` | Nguồn giao dịch và nguồn liên quan |
| `moneySources` | Được tham chiếu bởi | `goalContributions` | Nguồn tiền dùng để đóng góp |
| `goals` | Có nhiều | `goalContributions` | Các lần đóng góp cho mục tiêu |
| `transactions` | Có thể liên kết một-một | `goalContributions` | Giao dịch tạo ra từ một lần đóng góp |
| `goals` | Có thể được tham chiếu bởi | `tasks` | Nhiệm vụ gắn với mục tiêu |

### 5.3 Sơ đồ văn bản tùy chọn

Sơ đồ sau là văn bản thuần để có thể đọc được ngay cả khi nơi xem không hỗ trợ Mermaid:

```text
Tài khoản cục bộ
└── Database IndexedDB riêng trên thiết bị
    ├── transactions ── tham chiếu moneySources
    ├── budgets
    ├── goals ── goalContributions ── tham chiếu transactions
    │                   └──────────── tham chiếu moneySources
    ├── tasks ── có thể tham chiếu goals
    ├── moneySources
    └── points
```

## 6. Xác thực, dữ liệu cá nhân và sao lưu

### 6.1 Xác thực cục bộ

- Username được kiểm tra độ dài 2–30 ký tự.
- Mật khẩu khi đăng ký được kiểm tra độ dài 8–128 ký tự.
- Mật khẩu được băm bằng PBKDF2-SHA-256 với salt ngẫu nhiên 16 byte và 210.000 vòng lặp theo source đã khảo sát.
- Session lưu username trong `localStorage`.
- Đây là xác thực phía trình duyệt; không có bằng chứng về xác thực tài khoản qua server trong luồng hiện tại.

**Ý nghĩa:** Cách băm mật khẩu tốt hơn lưu mật khẩu dạng văn bản thuần, nhưng không đồng nghĩa toàn bộ dữ liệu tài chính trong IndexedDB đã được mã hóa. Người dùng cũng không tự động có dữ liệu đồng bộ khi đổi thiết bị.

### 6.2 Sao lưu

File `frontend/src/backup.ts` kiểm tra cấu trúc backup và một số ràng buộc giữa giao dịch, nguồn tiền, mục tiêu và đóng góp. Backup là JSON; không nên coi file này là đã được mã hóa. Người dùng nên lưu file tại nơi an toàn và tránh gửi công khai.

### 6.3 Secret và cấu hình môi trường

- `backend/.env.example` là file ví dụ; các giá trị mẫu không phải bằng chứng về secret thật.
- Có các biến mẫu như `AI_API_KEY`, `AI_API_URL` và `AI_MODEL`.
- Backend đã khảo sát chưa dùng các biến AI này để gọi dịch vụ AI.
- Chưa có kết quả audit đầy đủ lịch sử Git trong phạm vi báo cáo này; vì vậy **không thể khẳng định** rằng chưa từng có secret thật bị commit.

Nếu phát hiện secret thật trong lịch sử Git, cần thu hồi/rotate key trước, kiểm tra log và dịch vụ liên quan, sau đó xử lý lịch sử repository theo quy trình của nhóm. Chỉ xóa secret khỏi commit mới không làm secret cũ mất hiệu lực.

## 7. Backend và API

| Hạng mục | Trạng thái đã thấy | Tác động/ghi chú |
|---|---|---|
| `GET /` | Trả thông báo backend đang chạy | Endpoint cơ bản để xác nhận server |
| `GET /api/health` | Có endpoint kiểm tra trạng thái API | Hữu ích cho health check |
| `POST /api/chat` | Route hiện trả HTTP 503 | Chat backend đang vô hiệu hóa |
| CORS | Allowlist qua `CORS_ORIGINS`; mặc định localhost `http://localhost:5173` | Không phải cấu hình cho phép mọi origin theo mặc định |
| Request không có `Origin` | Được chấp nhận theo cấu hình đã khảo sát | CORS không phải cơ chế xác thực API |
| Rate limiting | Middleware express-rate-limit áp dụng cho `/api`, 100 request/15 phút | Đã được dùng trong server, không chỉ có trong package |
| Frontend gọi backend | Không thấy frontend gọi `/api/chat` | ChiChat đang chạy cục bộ |
| API key AI | Có tên biến trong `.env.example`, chưa thấy được dùng bởi route chat hiện tại | Không cần key AI để chạy luồng frontend đã khảo sát |

Khi triển khai sau này, cần kiểm tra cấu hình proxy/IP để rate limit nhận diện client đúng, cấu hình origin production cụ thể, dùng HTTPS và bổ sung xác thực server nếu API xử lý dữ liệu riêng tư.

## 8. ChiChat và xử lý dữ liệu người dùng

ChiChat trong `frontend/src/AssistantWidget.tsx` hiện cung cấp câu trả lời/tóm tắt dựa trên dữ liệu tài chính và các quy tắc tính toán trong trình duyệt. Không có bằng chứng trong source đã khảo sát về:

- Gọi API AI từ frontend hoặc backend.
- Đưa nội dung người dùng vào system prompt.
- Lưu lịch sử hội thoại lâu dài; lịch sử đang ở state giao diện theo khảo sát.

Do đó, không nên mô tả chức năng hiện tại là chatbot AI tự do. Nếu phát triển AI trong tương lai, cần xác định rõ dữ liệu nào được gửi ra ngoài, xin sự đồng ý phù hợp, không đưa API key vào frontend và kiểm tra đầu vào ở backend.

## 9. Logic nghiệp vụ và điểm cần xác nhận

### 9.1 Điểm sao

Các quy tắc đã thấy trong source:

| Sự kiện | Thay đổi điểm theo logic hiện tại |
|---|---:|
| Điểm danh mỗi ngày | +1 sao |
| Đạt mục tiêu tiết kiệm | +1 sao một lần cho mục tiêu theo cờ chống thưởng trùng |
| Chi vượt ngân sách từ 10% | −1 sao cho mỗi danh mục mỗi tháng |
| Đổi phụ kiện | Trừ sao theo giá món đồ |

Hàm cập nhật điểm không cho tổng điểm thấp hơn 0 và ghi lịch sử thay đổi theo source đã khảo sát.

### 9.2 Các điểm cần đối chiếu với chủ dự án

| Điểm cần xác nhận | Lý do |
|---|---|
| Chuỗi ngày nhiệm vụ/điểm danh | `taskStreak` trong `App.tsx` được ghi nhận là dựa trên ngày hoàn thành task đã lưu, không phải trực tiếp danh sách `checkInDates`; cần xác nhận đây là chủ đích hay sai lệch hiển thị |
| Cách tính tổng tài chính | Cần xác nhận cách trình bày khoản vay, nợ và tiền cho mượn trong tổng tài sản/số dư |
| Tài khoản trên nhiều thiết bị | Cơ chế hiện tại là local; cần xác nhận người dùng có yêu cầu đồng bộ hay không |
| Các bước hướng dẫn | Một số nội dung README/onboarding có thể còn mô tả tính năng cũ |
| Backend production | Chưa xác định server đã được deploy ở đâu hoặc có được frontend khác sử dụng hay không |

## 10. Giao diện và tài liệu hiện có

README hiện mô tả các luồng sử dụng như Home, hũ danh mục, kéo nguồn tiền vào hũ và sao lưu dữ liệu. Tuy nhiên, qua đối chiếu đã ghi nhận một số mô tả có thể không còn khớp với giao diện hiện tại, ví dụ danh mục nhỏ, giao dịch gần đây ở Home hoặc nhiệm vụ do người dùng tự tạo. Cần rà soát trước khi dùng README hoặc tour onboarding làm đặc tả chính thức.

Các file liên quan:

- `README.md`
- `frontend/src/OnboardingGuide.tsx`
- `frontend/src/App.tsx`

## 11. Kiểm thử, build và triển khai

### 11.1 Trạng thái kiểm tra đã ghi nhận

| Kiểm tra | Kết quả đã biết | Giới hạn |
|---|---|---|
| Frontend build | Đã thành công trong lần kiểm tra được ghi nhận trước đó | Chỉ chứng minh build hiện trạng lúc chạy, không chứng minh mọi luồng đúng |
| Frontend lint | Từng thất bại với `scopeManager.addGlobals is not a function` | Lỗi tương thích tooling/config đã thấy; chưa xác nhận đã xử lý |
| Backend build | Chưa xác nhận trong khảo sát này | Không nên ghi là đã build thành công |
| Runtime backend | Chưa xác nhận trong khảo sát này | Chưa có kết quả chạy server và kiểm tra endpoint ở lần này |
| Test tự động | Chưa tìm thấy test files trong vị trí đã khảo sát | Cần kiểm tra thêm nếu test được đặt nơi khác |
| Triển khai production | Chưa xác minh | Chưa có căn cứ xác nhận hosting, domain, HTTPS hoặc CI/CD |

### 11.2 Thông tin triển khai cần bổ sung nếu viết báo cáo

- Nhà cung cấp hosting và môi trường triển khai.
- Cách cấu hình biến môi trường trên production.
- Domain, HTTPS và chính sách CORS production.
- Quy trình build/deploy và CI/CD nếu có.
- Quy trình sao lưu dữ liệu và hướng dẫn khôi phục.
- Kết quả kiểm thử thủ công hoặc tự động có thể tái lập.

## 12. Bảng vấn đề, mức độ và hướng xử lý

Mức độ dưới đây là đánh giá ưu tiên cải thiện, không phải kết quả kiểm thử xâm nhập.

| Vấn đề | Mức độ | Tình trạng thực tế | Hướng xử lý |
|---|---|---|---|
| Dữ liệu chỉ lưu cục bộ | Trung bình | Đã thấy IndexedDB theo tài khoản trên trình duyệt; chưa thấy đồng bộ cloud | Giải thích rõ cho người dùng; duy trì backup; chỉ xây đồng bộ server khi có yêu cầu và thiết kế bảo mật |
| IndexedDB không được mã hóa theo source đã khảo sát | Trung bình | Chưa thấy lớp mã hóa toàn bộ dữ liệu tài chính | Đánh giá mô hình đe dọa; cân nhắc mã hóa nếu phù hợp, đồng thời quản lý khóa an toàn |
| Chưa xác minh secret trong toàn bộ Git history | Cao nếu từng có secret thật; chưa xác định | Chưa có kết quả đầy đủ về lịch sử commit trong báo cáo này | Quét lịch sử trong môi trường được phép; nếu phát hiện secret thật thì thu hồi/rotate trước |
| API chat trả 503 | Thấp trong trạng thái hiện tại | Endpoint bị tắt; frontend không gọi | Giữ tắt cho đến khi có yêu cầu, xác thực, validation và quản lý secret đầy đủ |
| Backend chưa có xác thực người dùng theo luồng đã khảo sát | Cao nếu mở API chứa dữ liệu người dùng | Chưa có backend auth được xác minh | Bổ sung auth/authorization server-side trước khi cho API thao tác dữ liệu riêng tư |
| Test tự động chưa được xác minh | Trung bình | Chưa tìm thấy test suite trong các thư mục đã khảo sát | Bổ sung test cho tính toán tài chính, backup và các luồng quan trọng |
| Lint đang lỗi tooling | Thấp đến trung bình | Đã gặp lỗi `scopeManager.addGlobals is not a function` | Kiểm tra tương thích phiên bản ESLint/config trước khi xem là lỗi source |
| Tài liệu có thể lỗi thời | Thấp | README/onboarding có nội dung chưa khớp UI theo khảo sát | Đối chiếu và cập nhật tài liệu sau khi xác nhận UI mong muốn |
| Triển khai production chưa được xác minh | Chưa xác định | Chưa thấy bằng chứng đủ về hosting/domain/HTTPS | Bổ sung tài liệu triển khai và kiểm tra cấu hình môi trường thực tế |

## 13. Đề cương báo cáo đồ án 5 chương

### Chương 1 — Giới thiệu đề tài

- Bối cảnh quản lý thu chi cá nhân.
- Vấn đề và nhu cầu hướng tới.
- Mục tiêu, phạm vi, đối tượng sử dụng.
- Giới hạn hiện tại: lưu dữ liệu cục bộ, chưa xác minh đồng bộ cloud.
- Không tự khẳng định đã khảo sát người dùng nếu chưa có minh chứng.

### Chương 2 — Cơ sở lý thuyết

- Ứng dụng SPA và React.
- TypeScript và lợi ích của kiểu tĩnh.
- IndexedDB, Dexie và lưu trữ phía trình duyệt.
- Nguyên tắc quản lý thu chi, ngân sách, mục tiêu tiết kiệm.
- Băm mật khẩu và các nguyên tắc bảo mật web cơ bản.

### Chương 3 — Phân tích và thiết kế hệ thống

- Yêu cầu chức năng và phi chức năng.
- Tác nhân, luồng sử dụng và kiến trúc frontend/backend.
- Mô hình dữ liệu cùng các quan hệ logic.
- Quy tắc tính số dư, ngân sách, mục tiêu và điểm sao.
- Phân tích giới hạn của xác thực cục bộ và dữ liệu trên thiết bị.

### Chương 4 — Cài đặt và kiểm thử

- Công nghệ và cấu trúc source.
- Màn hình và luồng chức năng đã triển khai.
- Cơ chế backup/restore.
- Kết quả build, lint và test: chỉ ghi những gì thực sự đã chạy.
- Nếu chưa có test tự động, nêu rõ đây là hạn chế và đề xuất bổ sung.

### Chương 5 — Kết quả, đánh giá và hướng phát triển

- Kết quả đạt được theo chức năng.
- Hạn chế về đồng bộ nhiều thiết bị, xác thực server và bảo vệ dữ liệu local.
- Hạn chế về test, logging và triển khai production.
- Hướng phát triển: backend auth, đồng bộ an toàn, kiểm thử tự động và tài liệu triển khai.

## 14. Điều đã xác minh và điều cần kiểm tra thêm

### Đã xác minh trong source hoặc các lần kiểm tra đã ghi nhận

- Frontend dùng React/TypeScript/Vite và Dexie/IndexedDB.
- Dữ liệu tài chính được phân vùng theo tài khoản cục bộ trên thiết bị.
- Backend có CORS allowlist và rate limiting cho `/api`.
- `POST /api/chat` đang trả HTTP 503.
- Không thấy frontend gọi `/api/chat`.
- ChiChat hiện tổng hợp/cảnh báo dựa trên dữ liệu cục bộ, không phải AI chat tự do.
- `.env.example` là mẫu biến môi trường; các biến AI được ghi trong mẫu chưa được dùng bởi server đã khảo sát.
- Backup JSON có kiểm tra cấu trúc và một số liên kết dữ liệu.
- Frontend build từng chạy thành công; lint từng gặp lỗi tương thích tooling.

### Cần kiểm tra thêm trước khi kết luận

- Toàn bộ lịch sử Git để xác định liệu secret thật có từng bị commit hay không.
- Cấu hình triển khai thực tế, hosting, domain, HTTPS và CI/CD.
- Backend build/runtime hiện tại và kết quả test endpoint thực tế.
- Quy tắc nghiệp vụ chính xác về nợ, khoản vay và tổng tài chính.
- Mục đích của cách tính chuỗi ngày nhiệm vụ/điểm danh.
- Việc có test ở ngoài các thư mục đã khảo sát hay không.
- Nội dung README và onboarding nào cần thay đổi theo giao diện hiện tại.

## 15. Kết luận

Theo source đã khảo sát, Mochi hiện phù hợp để mô tả là một ứng dụng quản lý tài chính cá nhân chạy chủ yếu trên trình duyệt, lưu dữ liệu bằng IndexedDB và có backend Express ở mức cơ bản. Backend có rate limiting và health endpoint, nhưng chat API đang tắt. Chưa có đủ bằng chứng để gọi hệ thống là có xác thực server, đồng bộ cloud, AI chat đang hoạt động hoặc đã triển khai production.

Khi viết báo cáo đồ án, nên phân biệt rõ chức năng đã hiện thực, giới hạn đã xác minh và các nội dung cần kiểm tra thêm. Không nên khẳng định đã kiểm thử đầy đủ, đã triển khai hoặc chưa từng lộ secret nếu chưa có bằng chứng tương ứng.
