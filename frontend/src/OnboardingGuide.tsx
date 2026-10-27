import { useEffect, useState } from 'react'
import './OnboardingGuide.css'

type GuidePage =
  | 'welcome'
  | 'home'
  | 'charts'
  | 'wardrobe'
  | 'budgets'
  | 'goals'
  | 'tasks'
  | 'transactions'
  | 'sources'
  | 'settings'

type GuideStep = {
  target?: string
  title: string
  description: string
}

const pageTitles: Record<GuidePage, string> = {
  welcome: 'Giới thiệu Mochi',
  home: 'Home',
  charts: 'Biểu đồ',
  wardrobe: 'Tủ đồ',
  budgets: 'Ngân sách',
  goals: 'Mục tiêu',
  tasks: 'Nhiệm vụ',
  transactions: 'Giao dịch',
  sources: 'Nguồn MO',
  settings: 'Cài đặt',
}

const guideSteps: Record<GuidePage, GuideStep[]> = {
  welcome: [
    {
      title: 'Chào mừng bạn đến với Mochi',
      description: 'Mochi giúp bạn theo dõi thu, chi, ngân sách, mục tiêu tiết kiệm, khoản vay và MO cho mượn; bạn cũng có thể chăm sóc linh vật Mochi qua nhiệm vụ hằng ngày.',
    },
    {
      title: 'Đơn vị trong Mochi là MO',
      description: 'Mọi số dư và giao dịch đều dùng MO; ô nhập sẽ tự định dạng và gợi ý nhanh khi cần. Dữ liệu được lưu trên trình duyệt của thiết bị này.',
    },
  ],
  home: [
    { target: 'home-sidebar', title: 'Menu dashboard', description: 'Menu bên trái đưa bạn tới Home, Biểu đồ, Tủ đồ và các khu vực quản lý. Mỗi giao diện sẽ có hướng dẫn riêng khi bạn mở lần đầu.' },
    { target: 'home-checkin', title: 'Điểm danh mỗi ngày', description: 'Nhấn “Điểm danh” một lần mỗi ngày để duy trì streak. Chuỗi ngày sẽ được lưu trong tài khoản trên thiết bị này.' },
    { target: 'home-summary', title: 'Tổng quan tài chính', description: 'Home hiển thị tổng thu, tổng chi và tổng cộng số dư của tất cả nguồn MO. Nguồn âm hoặc nguồn nợ được tính âm. Nhấn “Xem thêm số liệu” để xem thêm tổng nợ và MO đang cho mượn.' },
    { target: 'home-budget-bubbles', title: 'Mochi ngân sách', description: 'Mỗi viên Mochi đại diện cho một danh mục ngân sách. Trên máy tính, nhấn giữ rồi kéo viên Mochi; trên điện thoại, chạm giữ và kéo bằng ngón tay.' },
    { target: 'home-mochi-jar', title: 'Thả Mochi vào hũ', description: 'Kéo Mochi vào hũ rồi thả chuột hoặc nhấc ngón tay. Mochi sẽ rơi vào trong hũ; nhập số MO đã dùng để ghi khoản chi cho danh mục đó.' },
    { target: 'home-source-summary', title: 'Nguồn MO của bạn', description: 'Xem từng loại nguồn, số lượng và số dư. Nguồn được đặt là “Khoản nợ” hoặc có số dư âm sẽ được tính vào tổng nợ.' },
    { target: 'home-recent', title: 'Giao dịch gần đây', description: 'Home chỉ hiển thị tối đa 5 giao dịch trong 1–3 ngày trước. Mục này để xem nhanh, không có nút sửa hay xóa.' },
  ],
  charts: [
    { target: 'charts-summary', title: 'Tổng quan', description: 'Các thẻ cho biết thu, chi, tài sản ròng, tổng nợ MO và MO đang cho mượn.' },
    { target: 'charts-flow', title: 'Biểu đồ thu và chi', description: 'So sánh thu nhập và chi tiêu của sáu tháng gần nhất; khoản vay và khoản cho mượn không bị tính thành thu nhập/chi tiêu.' },
    { target: 'charts-categories', title: 'Chi tiêu theo danh mục', description: 'Xem danh mục nào đang chiếm nhiều ngân sách nhất.' },
  ],
  wardrobe: [
    { target: 'wardrobe-stage', title: 'Phối diện mạo', description: 'Xem Mochi và thử màu sắc, biểu cảm hoặc phụ kiện.' },
    { target: 'wardrobe-options', title: 'Cửa hàng và tủ đồ', description: 'Dùng sao nhiệm vụ để mua phụ kiện, sau đó phối màu, biểu cảm và vật phẩm đã sở hữu rồi lưu diện mạo Mochi.' },
  ],
  budgets: [
    { target: 'budgets-form', title: 'Tạo ngân sách', description: 'Nhập danh mục và hạn mức. Mở “Tùy chọn nâng cao” nếu muốn đổi tháng áp dụng.' },
    { target: 'budgets-list', title: 'Theo dõi ngân sách', description: 'Xem khoản đã chi và số MO còn lại. Trên Home, kéo hoặc chạm giữ viên Mochi của danh mục rồi thả vào hũ để ghi khoản chi.' },
  ],
  goals: [
    { target: 'goals-form', title: 'Tạo mục tiêu', description: 'Đặt tên và số MO mong muốn. Hạn hoàn thành nằm trong “Tùy chọn nâng cao”.' },
    { target: 'goals-list', title: 'Góp MO cho mục tiêu', description: 'Thêm khoản tiết kiệm từ một nguồn MO có sẵn để cập nhật tiến độ.' },
  ],
  tasks: [
    { target: 'tasks-intro', title: 'Nhiệm vụ và sao', description: 'Hoàn thành nhiệm vụ để nhận sao Mochi; sao dùng để mở phụ kiện.' },
    { target: 'tasks-list', title: 'Danh sách nhiệm vụ', description: 'Tạo việc nhỏ của riêng bạn, nhấn hoàn thành khi xong hoặc xóa nhiệm vụ không cần nữa.' },
  ],
  transactions: [
    { target: 'transactions-form', title: 'Thêm giao dịch', description: 'Chọn thu, chi, vay, trả nợ cá nhân, cho mượn, thu hồi hoặc trả khoản nợ. Ngày và ghi chú nằm trong “Tùy chọn nâng cao”; với khoản vay/cho mượn, dùng cùng tên người để theo dõi số còn lại.' },
    { target: 'transactions-history', title: 'Lịch sử giao dịch', description: 'Tại đây bạn có thể xem, sửa hoặc xóa giao dịch. Các khoản ghi từ Home cũng chỉ được chỉnh sửa ở trang này.' },
  ],
  sources: [
    { target: 'sources-form', title: 'Thêm nguồn MO', description: 'Tên nguồn không bắt buộc; nếu để trống, giao diện sẽ dùng tên loại nguồn. Số dư âm tự tính vào nợ. Mở “Tùy chọn nâng cao” để chọn cách tính và ngày số dư ban đầu.' },
    { target: 'sources-list', title: 'Quản lý nguồn', description: 'Xem số dư MO, loại nguồn và lịch sử liên quan; chỉnh loại tính toán hoặc tên hiển thị tại đây.' },
  ],
  settings: [
    { target: 'settings-appearance', title: 'Giao diện', description: 'Chọn màu nền Mochi theo sở thích.' },
    { target: 'settings-account', title: 'Tài khoản', description: 'Kiểm tra tài khoản đang dùng và đăng xuất khỏi thiết bị.' },
    { target: 'settings-data', title: 'Dữ liệu', description: 'Có thể đặt lại dữ liệu và các tùy chỉnh sau khi nhập mật khẩu hiện tại và xác nhận. Tài khoản đăng nhập vẫn được giữ lại.' },
  ],
}

function OnboardingGuide({
  page,
  onClose,
  onFinish,
}: {
  page: GuidePage
  onClose: () => void
  onFinish: () => void
}) {
  const [stepIndex, setStepIndex] = useState(0)
  const [position, setPosition] = useState({ left: 16, top: 16 })
  const steps = guideSteps[page]
  const step = steps[stepIndex]
  const isLastStep = stepIndex === steps.length - 1

  useEffect(() => {
    const target = step.target
      ? document.querySelector<HTMLElement>(`[data-tour-target="${step.target}"]`)
      : null
    target?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
    target?.classList.add('onboarding-highlight')

    const placeTooltip = () => {
      const width = Math.min(360, window.innerWidth - 32)
      const height = 210
      if (!target) {
        setPosition({
          left: Math.max(16, (window.innerWidth - width) / 2),
          top: window.innerHeight / 2,
        })
        return
      }
      const rect = target.getBoundingClientRect()
      const left = Math.min(Math.max(16, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - 16)
      const below = rect.bottom + 14
      const top = below + height < window.innerHeight - 12
        ? below
        : Math.max(12, rect.top - height - 14)
      setPosition({ left, top })
    }

    const frame = window.requestAnimationFrame(placeTooltip)
    window.addEventListener('resize', placeTooltip)
    window.addEventListener('scroll', placeTooltip, true)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', placeTooltip)
      window.removeEventListener('scroll', placeTooltip, true)
      target?.classList.remove('onboarding-highlight')
    }
  }, [page, step.target])

  return (
    <div className={`onboarding-tour${page === 'welcome' ? ' onboarding-intro' : ''}`} aria-live="polite">
      <section
        className="onboarding-tooltip"
        role="region"
        aria-label={`Hướng dẫn ${pageTitles[page]}`}
        style={{ left: position.left, top: position.top }}
      >
        <button className="onboarding-close" type="button" onClick={onClose} aria-label="Đóng hướng dẫn">
          ×
        </button>
        <p className="onboarding-eyebrow">{pageTitles[page]} · {stepIndex + 1}/{steps.length}</p>
        <h2>{step.title}</h2>
        <p className="onboarding-description">{step.description}</p>
        <div className="onboarding-progress-track" aria-hidden="true">
          <span style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }} />
        </div>
        <div className="onboarding-actions">
          <button className="onboarding-skip" type="button" onClick={onClose}>Bỏ qua</button>
          <div>
            {stepIndex > 0 && (
              <button className="onboarding-skip" type="button" onClick={() => setStepIndex((current) => current - 1)}>
                Trước
              </button>
            )}
            <button
              className="onboarding-next"
              type="button"
              onClick={() => {
                if (isLastStep) {
                  onFinish()
                  return
                }
                setStepIndex((current) => current + 1)
              }}
            >
              {isLastStep ? 'Hoàn tất' : 'Tiếp'}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

export default OnboardingGuide
