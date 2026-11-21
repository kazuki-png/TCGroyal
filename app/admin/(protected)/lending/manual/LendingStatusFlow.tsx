'use client'

import { useRef, useState } from 'react'
import { lendingStatusDiagram } from './lendingStatusDiagram'
import { lendingStatusTransitions } from './lendingStatusTransitions'

export function LendingStatusFlow() {
  const [zoom, setZoom] = useState(100)
  const viewport = useRef<HTMLDivElement>(null)
  const changeZoom = (value: number) => {
    setZoom(value)
    viewport.current?.scrollTo({ top: 0, left: 0 })
  }
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <label htmlFor="lending-flow-zoom" className="font-semibold">表示倍率</label>
      <select id="lending-flow-zoom" value={zoom} onChange={event => changeZoom(Number(event.target.value))} className="rounded-lg border border-slate-400 bg-[#ffffff] px-3 py-2 text-slate-900">
        <option value={100}>全体（100%）</option>
        <option value={150}>150%</option>
        <option value={200}>200%</option>
        <option value={300}>300%</option>
        <option value={400}>400%</option>
      </select>
      <span className="text-blue-700">青：利用者</span>
      <span className="text-emerald-800">緑：管理者</span>
      <span className="text-slate-600">灰：システム</span>
    </div>
    <p id="lending-flow-help" className="text-sm text-slate-600">中央が申請から返却までの流れです。矢印に操作する人と操作内容を記載しています。拡大後は図の中を縦横にスクロールできます。</p>
    <div ref={viewport} role="region" aria-label="融資ステータス全体図" aria-describedby="lending-flow-help" tabIndex={0} className="max-h-[80vh] overflow-auto rounded-xl border border-slate-300 bg-[#ffffff] focus-visible:outline-2 focus-visible:outline-emerald-700">
      {/* Trusted, static SVG authored with this manual; never populated from user input. */}
      <div role="img" aria-label="申請受付から返却・質流れまで、21ステータスを37本の操作付き矢印で結んだ全体図。テキスト版は直後にあります。" style={{ width: `${zoom}%`, aspectRatio: '2574 / 2657' }} dangerouslySetInnerHTML={{ __html: lendingStatusDiagram }}/>
    </div>
    <details className="rounded-lg border border-slate-300 p-3 text-sm">
      <summary className="cursor-pointer font-semibold">図の内容をテキストで確認</summary>
      <ul className="mt-3 list-disc space-y-2 pl-5">{lendingStatusTransitions.map(line => <li key={line}>{line}</li>)}</ul>
    </details>
    <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">発送後の辞退は管理者が配送・預かり状況を確認して返却手続きを行います。期限超過から質流れへの確定は自動では行いません。</p>
  </div>
}
