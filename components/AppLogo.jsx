// Icon của app (tai nghe trong ô xanh): dùng ở header trang chủ và làm nút "về trang chủ" ở các trang học.
export default function AppLogo({ className = 'h-8 w-8' }) {
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-lg bg-emerald-400 text-slate-950 ${className}`}>
      <svg viewBox="0 0 24 24" className="h-1/2 w-1/2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
        <rect x="3" y="14" width="4" height="6" rx="1.5" />
        <rect x="17" y="14" width="4" height="6" rx="1.5" />
      </svg>
    </span>
  );
}
