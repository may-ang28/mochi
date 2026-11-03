type DashboardIconName =
  | 'home'
  | 'charts'
  | 'wardrobe'
  | 'budgets'
  | 'goals'
  | 'tasks'
  | 'transactions'
  | 'sources'
  | 'settings'
  | 'assistant'

function DashboardIcon({ name }: { name: DashboardIconName }) {
  return (
    <svg className={`dashboard-icon dashboard-icon-${name}`} viewBox="0 0 28 28" fill="none" aria-hidden="true" focusable="false">
      <circle className="dashboard-icon-backdrop" cx="14" cy="14" r="13" />
      <g className="dashboard-icon-stroke" strokeLinecap="round" strokeLinejoin="round">
        {name === 'home' && <><path d="m6.5 13 7.5-6 7.5 6v8a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1z" /><path d="M11 22v-6h6v6" /></>}
        {name === 'charts' && <><path d="M7 21V14h4v7M12 21V8h4v13M17 21v-9h4v9" /><path d="M6 22h16" /></>}
        {name === 'wardrobe' && <><path d="M14 8a2.5 2.5 0 1 0-2.5-2.5" /><path d="m11.5 6-4.5 4 7 3 7-3-4.5-4" /><path d="m7 10 2 11h10l2-11" /></>}
        {name === 'budgets' && <><path d="M9 6h10l-.7 3H9.7zM9.7 9h8.6l1.3 11a2 2 0 0 1-2 2h-7.2a2 2 0 0 1-2-2z" /><path d="M11 15h6" /></>}
        {name === 'goals' && <><circle cx="14" cy="14" r="8" /><circle cx="14" cy="14" r="4" /><path d="m14 14 7-7M17 7h4v4" /></>}
        {name === 'tasks' && <><rect x="7" y="6" width="14" height="17" rx="2" /><path d="m10 11 1.5 1.5L14 10M16 12h2M10 17l1.5 1.5L14 16M16 18h2" /></>}
        {name === 'transactions' && <><rect x="6" y="7" width="16" height="14" rx="2.5" /><path d="M6 11h16M10 16h3M17 16h1" /><path d="M10 4v3M18 4v3" /></>}
        {name === 'sources' && <><path d="M7 10.5h13a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H8a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3h11" /><path d="M17 14h5v4h-5a2 2 0 0 1 0-4z" /><circle cx="17.5" cy="16" r=".5" /></>}
        {name === 'settings' && <><circle cx="14" cy="14" r="3.2" /><path d="m11.5 5.7.5-1h4l.5 1 .2 1.4 1.4.8 1.3-.5 2 3.4-1 1-.8 1.4.2 1.5 1 1-2 3.4-1.4-.4-1.6.4-.8 1.2h-4l-.5-1.2-1.4-.8-1.4.4-2-3.4 1-1 .2-1.5-.8-1.4-1-1 2-3.4 1.4.5 1.4-.8z" /></>}
        {name === 'assistant' && <><path d="M14 5.5 16 11l5.5 2-5.5 2-2 5.5-2-5.5-5.5-2 5.5-2z" /><path d="m20 4 .7 2.1L23 7l-2.3.8L20 10l-.8-2.2L17 7l2.2-.9z" /></>}
      </g>
    </svg>
  )
}

export default DashboardIcon
