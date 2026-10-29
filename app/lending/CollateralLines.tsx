import type {CollateralItem,CollateralInspection} from '@/lib/lending/collateral-types'
import {collateralQuantity} from '@/lib/lending/collateral-types'
export function CollateralLines({items=[],inspection=[]}:{items?:CollateralItem[];inspection?:CollateralInspection[]}){
 if(!items.length)return null
 return <section className="my-4 space-y-3 rounded-xl border border-white/10 p-4"><h3 className="font-bold">担保カード明細 / {items.length}種類・{collateralQuantity(items)}枚</h3>{items.map((item,index)=><div key={item.id} className="border-t border-white/10 pt-3 text-sm"><p className="font-semibold">{index+1}. {item.name} × {item.quantity}枚</p><p className="mt-1 text-zinc-400">{item.cardNumber} / {item.grade||'鑑定・グレード未申告'} / {item.condition||'状態確認待ち'}</p>{item.productId&&<p className="mt-1 text-xs text-zinc-400">スニダン商品ID {item.productId}</p>}{inspection.find(row=>row.id===item.id)&&<p className="mt-1 text-xs">保管場所：{inspection.find(row=>row.id===item.id)?.location}</p>}</div>)}</section>
}
