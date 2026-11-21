import Link from 'next/link'
import { LendingStatusFlow } from './LendingStatusFlow'
import type {Metadata} from 'next'
export const metadata:Metadata={title:'融資ステータス仕様 | 管理者マニュアル'}
const intake=[
 ['申請受付','申請確認・取消','内容確認・担当者設定・事前査定開始','相談登録 registered'],
 ['事前査定中','状況確認・問い合わせ・取消','追加情報依頼・概算提示・見送り','査定中 reviewing'],
 ['追加情報待ち','写真・情報の提出・取消','提出確認・査定再開','information_required'],
 ['概算見積もり・発送同意待ち','評価額と融資可能額を確認・同意・辞退','概算修正・再提示・有効期限管理','見積もり提示 offered（相談）'],
 ['カード発送待ち','送付先確認・発送情報登録・発送前取消','発送案内・未発送への連絡','追加予定：現行 submitted に含まれる'],
 ['カード到着待ち','配送確認・問い合わせ','受領登録・配送事故記録','到着待ち submitted'],
 ['受領済み・現物査定中','質問への回答・キャンセルと返却依頼','枚数・状態・鑑定情報・保管場所の確認、正式査定','received（受領と検品完了を別記録）'],
 ['正式条件の同意待ち','融資額・質料・期限・規約の確認と同意、辞退','正式条件の提示・修正・再同意依頼','条件の確認待ち offered（契約）'],
 ['融資振込待ち','振込予定確認・問い合わせ','本人確認・口座・同意の確認、振込実行と結果登録','出金待ち accepted'],
 ['契約中','残高・期限確認、全額返済、延長手続き','保管管理・入金確認・返済と延長の対応','active'],
]
const payments=[
 ['返済入金確認待ち','振込後の申告・情報補足','名義・金額・着金日・照合番号を確認し返済確定','repayment_pending'],
 ['返済の要対応','不足分の振込・申告補足','不足・未着金・照合不能の案内と再確認','表示整理予定：現行は差戻しで active'],
 ['延長入金確認待ち','必要質料の振込・申告・状況確認','期限内の申告と着金を確認し延長確定','active ＋ extension pending'],
 ['延長の要対応','不足分の振込・情報補足','再確認・延長不成立の判断','表示整理予定：延長申請の差戻し'],
 ['期限超過・確認待ち','状況確認・問い合わせ・振込情報提示','未確認入金と申告を照合し、返済・延長・質流れを判断','追加予定：現行は期限日時から超過表示'],
 ['カード返却待ち','返却先確認・問い合わせ','全カード照合・梱包・返送手配','return_pending'],
 ['カード返送中','追跡・受取・未着や破損の連絡','配送追跡・事故対応・配達完了確認','追加予定'],
 ['返却完了・取引終了','明細・履歴確認・問い合わせ','履歴確認・問い合わせ対応','returned'],
 ['質流れ確定','結果・履歴確認・問い合わせ','確定理由記録・担保の処分管理','forfeited'],
 ['見送り／キャンセル','結果確認・問い合わせ','理由や経緯の記録、預かりカードの返却','declined / rejected / cancelled'],
]
function Actions({rows}:{rows:string[][]}){return <div className="overflow-x-auto rounded-xl border border-slate-300"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-100"><tr>{['状態','ユーザーの操作','管理者の操作','現行実装との対応'].map(v=><th key={v} scope="col" className="p-3">{v}</th>)}</tr></thead><tbody>{rows.map(([state,...cells])=><tr key={state} className="border-t border-slate-300 align-top"><th scope="row" className="w-1/5 p-3 font-semibold">{state}</th>{cells.map((v,i)=><td key={i} className="p-3 leading-6">{v}</td>)}</tr>)}</tbody></table></div>}
export default function LendingManual(){return <article className="mx-auto max-w-6xl space-y-7 rounded-2xl bg-[#ffffff] p-5 text-slate-800 sm:p-8">
 <header><Link href="/admin/lending" className="text-sm text-emerald-800 underline">融資管理へ戻る</Link><h1 className="mt-3 text-2xl font-bold">融資ステータス仕様</h1><p className="mt-2 text-sm text-slate-600">管理者用マニュアル · 2026年11月21日更新</p><p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">合意した運用の整理案です。「追加予定」「分離予定」は未実装です。このページの追加でステータスや金銭処理は変更されません。</p></header>
 <nav aria-label="マニュアルの目次" className="flex flex-wrap gap-4 text-sm text-emerald-800">{[['flow','全体フロー'],['actions','ステータス別の操作'],['rules','返済・延長ルール'],['operation','運用上の注意']].map(([id,label])=><a key={id} href={'#'+id} className="underline">{label}</a>)}</nav>
 <section id="flow" className="scroll-mt-6 space-y-4"><h2 className="text-xl font-bold">全体フロー</h2><p className="text-sm">案件全体と、返済・延長などの手続き状況を分けます。延長中も同じ案件を維持し、「契約中・延長入金確認待ち」と表示します。</p>
 <LendingStatusFlow/>
 <p className="rounded-lg bg-slate-100 p-3 text-sm">取消・見送り：カードを受領していなければ終了。預かっている場合は、現物査定済みかどうかにかかわらず返却工程へ進めます。受領を記録した時点から、検品前でも返却対象です。</p></section>
 <section id="actions" className="scroll-mt-6 space-y-4"><h2 className="text-xl font-bold">ステータス別の操作</h2><Actions rows={intake}/><Actions rows={payments}/></section>
 <section id="rules" className="scroll-mt-6 space-y-3"><h2 className="text-xl font-bold">返済・延長ルール</h2><ul className="list-disc space-y-2 pl-5 text-sm leading-7"><li>当初の期限は融資実行日から3か月。日本時間の満期日23:59を基準に扱います。</li><li>期限前の全額返済は可能。月単位で計算し最低1か月分。期限前は「期限前返済手数料」、満期日の返済・延長分は「質料」と表示します。</li><li>延長は未払いの経過期間分の質料を支払い、1か月ずつ。元金返済は不要、原則回数無制限、自動延長なし。</li><li>延長には満期日23:59までの申告と着金が必要です。振込予約だけでは成立しません。期限内の申告・着金が確認できれば、管理者の確認が翌日以降でも処理できます。</li><li>支払済み期間の質料は二重請求しません。金額はサーバーの計算結果で確認します。</li><li>満期3日前・前日にプッシュ通知とメールで案内します。延長後は新しい期限を基準にします。</li></ul></section>
 <section id="operation" className="scroll-mt-6 space-y-3"><h2 className="text-xl font-bold">運用上の注意</h2><ul className="list-disc space-y-2 pl-5 text-sm leading-7"><li>「振り込みました」という申告だけで返済完了・延長成立にしません。管理者が銀行の着金日・実入金額・照合番号を確認します。</li><li>期限超過だけで自動的に質流れにしません。未確認入金や処理中の申告を解決してから判断します。</li><li>正式条件を修正した場合は、利用者の再同意が必要です。振込失敗時は契約中に進めません。</li><li>会員紐付け・本人確認・振込先確認・配送・通知・カード別査定は、案件ステータスと別に管理します。</li><li>アプリの新規申請はログイン本人に紐付きます。LINE・店頭の未紐付け案件は、本人と照合して会員を設定してください。会員未紐付けの案件はステータス通知を生成しません。</li><li>「利用者に表示する案内・見積もり根拠」は任意（500文字以内）です。追加情報を依頼する際は、必要な内容を記載する運用を推奨します。</li><li>金額・本人確認・同意などの必須条件は省略できません。振込・返済確定・延長・質流れは専用の操作を使用し、単なるステータス変更で代用しません。</li><li>複数カードはカードごとに査定・保管・返却を記録し、契約と返済期限は案件単位でまとめます。</li></ul></section>
 </article>}
