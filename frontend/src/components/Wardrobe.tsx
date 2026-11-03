import { mascotExpressions, type MascotExpression } from '../mascot'

export type AccessorySlot = 'clip' | 'hat'
export type MochiOutfit = Record<AccessorySlot, string> & { color: string; expression: MascotExpression }
export type AccessoryOption = { id: string; label: string; icon: string; cost?: number }

export const accessorySlots: { id: AccessorySlot; label: string; options: AccessoryOption[] }[] = [
  { id: 'clip', label: 'Kẹp tóc', options: [{ id: 'none', label: 'Không', icon: '−' }, { id: 'bow', label: 'Nơ', icon: '🎀', cost: 10 }, { id: 'flower', label: 'Hoa', icon: '🌼', cost: 15 }, { id: 'star', label: 'Sao', icon: '⭐', cost: 20 }] },
  { id: 'hat', label: 'Mũ', options: [{ id: 'none', label: 'Không', icon: '−' }, { id: 'cap', label: 'Mũ', icon: '🧢', cost: 15 }, { id: 'crown', label: 'Vương miện', icon: '👑', cost: 30 }, { id: 'berry', label: 'Mũ dâu', icon: '🍓', cost: 25 }] },
]

export const mochiColors = [
  { id: 'pink', label: 'Hồng mochi', color: '#ff91b8' },
  { id: 'mint', label: 'Bạc hà', color: '#74c8a1' },
  { id: 'sunshine', label: 'Nắng', color: '#f2c45e' },
  { id: 'sky', label: 'Xanh trời', color: '#7eb9e8' },
  { id: 'lilac', label: 'Tử đinh hương', color: '#ad91db' },
  { id: 'peach', label: 'Đào', color: '#f29a78' },
]

function Wardrobe({
  mochiPoints,
  unlockedAccessories,
  mochiOutfit,
  outfitHasChanges,
  onSaveMochiOutfit,
  onSelectAccessory,
  onUpdateMochiColor,
  onUpdateMochiExpression,
}: {
  mochiPoints: number
  unlockedAccessories: string[]
  mochiOutfit: MochiOutfit
  outfitHasChanges: boolean
  onSaveMochiOutfit: () => void
  onSelectAccessory: (slot: AccessorySlot, option: AccessoryOption) => void
  onUpdateMochiColor: (color: string) => void
  onUpdateMochiExpression: (expression: MascotExpression) => void
}) {
  return (
    <div className="page-content">
      <section className="mochi-dresser" aria-label="Thiết kế phụ kiện cho Mochi" data-tour-target="wardrobe-stage">
        <header className="mochi-dresser-heading">
          <div>
            <p className="dashboard-eyebrow">CỬA HÀNG & TỦ ĐỒ</p>
            <h2>Cửa hàng & tủ đồ Mochi</h2>
          </div>
          <div className="wardrobe-header-actions">
            <span className="dresser-level" aria-live="polite">⭐ {mochiPoints} sao Mochi</span>
            <button className="primary-button wardrobe-save-button" type="button" onClick={onSaveMochiOutfit} disabled={!outfitHasChanges}>
              {outfitHasChanges ? 'Lưu Mochi' : 'Đã lưu'}
            </button>
          </div>
        </header>
        <div className="mochi-dresser-layout">
          <div className="wardrobe-stage" aria-label="Mochi với màu sắc và phụ kiện đã chọn">
            {(['hat', 'clip'] as AccessorySlot[]).map((slot) => {
              const accessory = accessorySlots.find((item) => item.id === slot)?.options.find((item) => item.id === mochiOutfit[slot])
              return accessory && accessory.id !== 'none'
                ? <span className={`wardrobe-wearable wardrobe-${slot}`} key={slot}>{accessory.icon}</span>
                : null
            })}
            <div className={`wardrobe-mochi color-${mochiOutfit.color}`}>
              <span className={`assistant-slime assistant-slime-${mochiOutfit.expression}`} aria-hidden="true">
                <span className="assistant-slime-eye assistant-slime-eye-left" />
                <span className="assistant-slime-eye assistant-slime-eye-right" />
                <span className="assistant-slime-mouth" />
                <span className="assistant-slime-blush" />
              </span>
            </div>
            <span className="wardrobe-stage-caption">Mochi · cấp 1</span>
          </div>
          <div className="wardrobe-tray" data-tour-target="wardrobe-options">
            {accessorySlots.map((slot) => (
              <div className="wardrobe-slot" key={slot.id} role="group" aria-label={`Chọn ${slot.label}`}>
                <h3>{slot.label}</h3>
                <div className="wardrobe-options">
                  {slot.options.filter((option) => !option.cost || unlockedAccessories.includes(`${slot.id}:${option.id}`)).map((option) => (
                    (() => {
                      const accessoryKey = `${slot.id}:${option.id}`
                      const owned = !option.cost || unlockedAccessories.includes(accessoryKey)
                      const canAfford = mochiPoints >= (option.cost ?? 0)
                      return (
                        <button
                          className={`wardrobe-option${mochiOutfit[slot.id] === option.id ? ' active' : ''}${owned ? '' : ' locked'}`}
                          key={option.id}
                          type="button"
                          disabled={!owned && !canAfford}
                          aria-label={`${slot.label}: ${option.label}${owned ? ', đã sở hữu' : `, giá ${option.cost} sao`}`}
                          title={owned ? option.label : `Đổi ${option.label} với ${option.cost} sao`}
                          aria-pressed={mochiOutfit[slot.id] === option.id}
                          onClick={() => onSelectAccessory(slot.id, option)}
                        >
                          <span aria-hidden="true">{option.icon}</span>
                          <small>{owned ? option.label : `🔒 ${option.cost} sao`}</small>
                        </button>
                      )
                    })()
                  ))}
                </div>
              </div>
            ))}
            <div className="wardrobe-slot wardrobe-shop-slot" role="group" aria-label="Cửa hàng phụ kiện đổi bằng sao">
              <h3>Cửa hàng phụ kiện</h3>
              <p className="wardrobe-shop-note">Dùng sao từ nhiệm vụ để mua vật phẩm; vật phẩm đã mua có thể dùng lại bất cứ lúc nào.</p>
              {accessorySlots.map((slot) => (
                <div className="wardrobe-shop-category" key={slot.id}>
                  <strong>{slot.label}</strong>
                  <div className="wardrobe-options">
                    {slot.options.filter((option) => option.cost).map((option) => {
                      const accessoryKey = `${slot.id}:${option.id}`
                      const owned = unlockedAccessories.includes(accessoryKey)
                      const canAfford = mochiPoints >= (option.cost ?? 0)
                      return (
                        <button
                          className={`wardrobe-option wardrobe-shop-item${owned ? ' owned' : ''}`}
                          key={option.id}
                          type="button"
                          disabled={!owned && !canAfford}
                          aria-label={`${owned ? 'Đã mua' : 'Mua'} ${option.label}, giá ${option.cost} sao`}
                          onClick={() => onSelectAccessory(slot.id, option)}
                        >
                          <span aria-hidden="true">{option.icon}</span>
                          <small>{option.label}</small>
                          <small>{owned
                            ? mochiOutfit[slot.id] === option.id ? 'Đang dùng' : 'Đã mua · Trang bị'
                            : `Mua · ${option.cost} sao`}</small>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="wardrobe-slot" role="group" aria-label="Chọn màu Mochi">
              <h3>Màu Mochi</h3>
              <div className="wardrobe-options wardrobe-color-options">
                {mochiColors.map((option) => (
                  <button
                    className={`wardrobe-option wardrobe-color-option${mochiOutfit.color === option.id ? ' active' : ''}`}
                    key={option.id}
                    type="button"
                    aria-label={`Màu Mochi: ${option.label}`}
                    aria-pressed={mochiOutfit.color === option.id}
                    onClick={() => onUpdateMochiColor(option.id)}
                  >
                    <span style={{ backgroundColor: option.color }} aria-hidden="true" />
                    <small>{option.label}</small>
                  </button>
                ))}
              </div>
            </div>
            <div className="wardrobe-slot" role="group" aria-label="Chọn biểu cảm Mochi">
              <h3>Biểu cảm</h3>
              <div className="wardrobe-options wardrobe-expression-options">
                {mascotExpressions.map((option) => (
                  <button
                    className={`wardrobe-option wardrobe-expression-option${mochiOutfit.expression === option.id ? ' active' : ''}`}
                    key={option.id}
                    type="button"
                    aria-label={`Biểu cảm: ${option.label}`}
                    aria-pressed={mochiOutfit.expression === option.id}
                    onClick={() => onUpdateMochiExpression(option.id)}
                  >
                    <span aria-hidden="true">{option.icon}</span>
                    <small>{option.label}</small>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Wardrobe
