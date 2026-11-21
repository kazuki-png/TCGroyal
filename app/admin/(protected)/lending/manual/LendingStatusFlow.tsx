type Transition = {
  to: string
  actor: '利用者' | '管理者' | 'システム'
  action: string[]
}
type Branch = { from: string; transitions: Transition[] }
const user = (to: string, ...action: string[]): Transition => ({ to, actor: '利用者', action })
const admin = (to: string, ...action: string[]): Transition => ({ to, actor: '管理者', action })

const phases: { title: string; branches: Branch[] }[] = [
  { title: '1. 申請受付・事前査定', branches: [
    { from: '申請受付', transitions: [user('ユーザーキャンセル済み', '申請をキャンセル'), admin('事前査定中', '査定を開始'), admin('見送り', '受付内容を確認し見送り')] },
    { from: '事前査定中', transitions: [admin('追加情報待ち', '写真・情報を依頼'), admin('概算見積もり・発送同意待ち', '概算見積もりを提示'), admin('見送り', '査定結果から見送り'), user('ユーザーキャンセル済み', '申請をキャンセル')] },
    { from: '追加情報待ち', transitions: [admin('事前査定中', '利用者が提出した情報を確認', '査定を再開'), user('ユーザーキャンセル済み', '申請をキャンセル')] },
    { from: '概算見積もり・発送同意待ち', transitions: [user('カード発送待ち', '概算と発送に同意'), user('ユーザーキャンセル済み', '見積もりを辞退')] },
  ] },
  { title: '2. 発送・現物査定・融資実行', branches: [
    { from: 'カード発送待ち', transitions: [user('カード到着待ち', 'カードを発送し追跡番号を登録'), user('ユーザーキャンセル済み', '発送前にキャンセル')] },
    { from: 'カード到着待ち', transitions: [admin('受領済み・現物査定中', 'カードの到着を確認・受領登録')] },
    { from: '受領済み・現物査定中', transitions: [admin('正式条件の同意待ち', '検品・査定を完了', '正式な融資条件を提示'), admin('カード返却待ち', '見送り／利用者の辞退を確認', '預かりカードの返却を手配')] },
    { from: '正式条件の同意待ち', transitions: [user('融資振込待ち', '正式条件と規約に同意'), user('カード返却待ち', '正式条件を辞退・返却を依頼'), admin('正式条件の同意待ち', '条件を修正・再提示', '利用者の再同意を待つ')] },
    { from: '融資振込待ち', transitions: [admin('契約中', '銀行振込の成功を確認', '融資実行を登録'), admin('融資振込待ち', '振込失敗・口座不備を確認', '修正後に再振込')] },
  ] },
  { title: '3. 全額返済・延長・期限超過', branches: [
    { from: '契約中', transitions: [user('返済入金確認待ち', '全額返済の振込を行い申告'), user('延長入金確認待ち', '質料を振り込み延長を申告'), { to: '期限超過・確認待ち', actor: 'システム', action: ['満期を超過', '未完了の入金・申告も確認対象'] }] },
    { from: '返済入金確認待ち', transitions: [admin('カード返却待ち', '必要額の着金を照合', '返済を確定'), admin('返済の要対応', '不足・未着金・照合不能', '補足／追加入金を依頼')] },
    { from: '返済の要対応', transitions: [user('返済入金確認待ち', '追加入金・情報補足を行い申告')] },
    { from: '延長入金確認待ち', transitions: [admin('契約中（期限を1か月延長）', '期限内の申告・必要質料の着金確認', '延長を確定'), admin('延長の要対応', '不足・照合不能を確認', '補足／追加入金を依頼')] },
    { from: '延長の要対応', transitions: [user('延長入金確認待ち', '追加入金・情報補足を行い申告', '成立には期限内の条件充足が必要'), admin('期限超過・確認待ち', '期限内の延長不成立を確認')] },
    { from: '期限超過・確認待ち', transitions: [admin('契約中（期限を1か月延長）', '期限内の延長条件充足を確認', '延長を確定'), admin('カード返却待ち', '未確認の返済入金を照合', '返済成立を確認'), admin('質流れ確定', '未確認入金・申告を解決', '質流れの条件を確認して確定')] },
  ] },
  { title: '4. 返却・取引終了', branches: [
    { from: 'カード返却待ち', transitions: [admin('カード返送中', '返却先・全カードを照合', '発送し追跡番号を登録')] },
    { from: 'カード返送中', transitions: [admin('返却完了・取引終了', '利用者の受取／配達完了を確認')] },
  ] },
]

const actorColors = { 利用者: '#1d4ed8', 管理者: '#047857', システム: '#475569' }

function BranchDiagram({ branch, id }: { branch: Branch; id: string }) {
  const count = branch.transitions.length
  const width = count === 4 ? 1330 : 1000
  const center = width / 2
  const positions = count === 1 ? [500] : count === 2 ? [255, 745] : count === 3 ? [170, 500, 830] : [170, 500, 830, 1160]
  return (
    <figure className="overflow-x-auto rounded-xl border border-slate-300 bg-[#ffffff] p-2">
      <svg viewBox={`0 0 ${width} 300`} role="img" aria-labelledby={`${id}-title ${id}-description`} className="w-full" style={{ minWidth: width * 0.9 }}>
        <title id={`${id}-title`}>{branch.from}からのステータス遷移</title>
        <desc id={`${id}-description`}>{branch.transitions.map(t => `${t.actor}が${t.action.join('、')}：${branch.from}から${t.to}へ。`).join(' ')}</desc>
        <defs>{Object.entries(actorColors).map(([actor, color]) => (
          <marker key={actor} id={`${id}-${actor}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill={color}/>
          </marker>
        ))}</defs>
        <rect x={center - 160} y="10" width="320" height="50" rx="10" fill="#ecfdf5" stroke="#047857" strokeWidth="2"/>
        <text x={center} y="41" textAnchor="middle" fill="#0f172a" fontSize="18" fontWeight="700">{branch.from}</text>
        {branch.transitions.map((t, i) => {
          const x = positions[i]
          const color = actorColors[t.actor]
          return <g key={`${t.to}-${i}`}>
            <path d={`M ${center} 60 V 90 H ${x} V 230`} fill="none" stroke={color} strokeWidth="2" markerEnd={`url(#${id}-${t.actor})`}/>
            <rect x={x - 153} y="108" width="306" height="96" rx="6" fill="#ffffff"/>
            <text x={x} y="132" textAnchor="middle" fill={color} fontSize="16" fontWeight="700">{t.actor}</text>
            {t.action.map((line, n) => <text key={line} x={x} y={156 + n * 22} textAnchor="middle" fill="#334155" fontSize="15">{line}</text>)}
            <rect x={x - 157} y="234" width="314" height="50" rx="10" fill="#f8fafc" stroke="#94a3b8"/>
            <text x={x} y="265" textAnchor="middle" fill="#0f172a" fontSize="17" fontWeight="700">{t.to}</text>
          </g>
        })}
      </svg>
    </figure>
  )
}

export function LendingStatusFlow() {
  return <div className="space-y-4">
    <p className="text-sm text-slate-600">箱はステータス、矢印のラベルは操作する人と操作内容です。同じ名前の箱は同じ状態です。狭い画面では図を横にスクロールできます。</p>
    {phases.map((phase, p) => <details key={phase.title} open className="rounded-xl border border-slate-300 bg-[#f8fafc] p-4">
      <summary className="cursor-pointer font-bold text-slate-900">{phase.title}</summary>
      <div className="mt-4 space-y-4">{phase.branches.map((branch, b) => <BranchDiagram key={branch.from} branch={branch} id={`flow-${p}-${b}`}/>)}</div>
    </details>)}
    <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">事前査定中も利用者はキャンセル可能です。発送後は即時終了させず、管理者が配送・預かり状況を確認して返却手続きを行います。期限超過から質流れへの確定は自動では行いません。</p>
  </div>
}
