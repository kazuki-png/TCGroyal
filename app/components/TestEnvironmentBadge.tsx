export function TestEnvironmentBadge({ label }: { label: string }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex h-8 items-center justify-center border-b border-amber-300/40 bg-amber-500 text-center text-xs font-black text-black shadow-[0_10px_30px_rgba(0,0,0,0.35)] sm:h-9 sm:text-sm">
      <span className="tracking-[0.18em]">【{label}】</span>
      <span className="ml-2">テスト環境</span>
      <span className="ml-3 hidden text-[11px] font-bold tracking-normal sm:inline">
        本番データではありません
      </span>
    </div>
  )
}
