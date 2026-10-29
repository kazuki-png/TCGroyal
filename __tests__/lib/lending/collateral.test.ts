import {describe,it,expect} from 'vitest';
import {collateralItems} from '@/lib/lending/collateral';
import {supportCaseRequest} from '@/lib/lending/support-cases';
import {inspectionInputError} from '@/lib/lending/inspection-input';
import {buildSupportEstimateMessage} from '../../../mobile/src/support-estimate';
const item={id:'30000000-0000-4000-8000-000000000001',name:'架空カード',cardNumber:'001',quantity:2,grade:'未鑑定',condition:'白欠け',source:'manual' as const,productId:null,cardUid:null};
describe('bundled collateral',()=>{
 it('rejects duplicate line IDs, invalid quantities, oversized totals, and client price claims',()=>{
  for(const input of [[{...item,quantity:0}],[{...item,quantity:1.5}],[{...item,quantity:101}],[item,item],[{...item,price:999999}],[{...item,source:'snkrdunk'}]])expect(collateralItems.safeParse(input).success).toBe(false);
  expect(collateralItems.safeParse([item,{...item,id:'30000000-0000-4000-8000-000000000002',quantity:99}]).success).toBe(false);
  expect(collateralItems.safeParse([item]).success).toBe(true);
 });
 it('requires exact per-line received quantities, storage and confirmation',()=>{
  const base={location:'Common',inspected:true,collateralInspection:[{id:item.id,quantity:2,location:'A',checked:true}]};
  expect(inspectionInputError(null,base,[item])).toBeNull();
  for(const rows of [[],[{...base.collateralInspection[0],quantity:1}],[{...base.collateralInspection[0],checked:false}],[{...base.collateralInspection[0],location:''}]])expect(inspectionInputError(null,{...base,collateralInspection:rows},[item])).not.toBeNull();
 });
 it('keeps structured item data in the support request and includes it in the LINE draft',()=>{
  const draft={reason:'other' as const,cardName:'まとめて申込',cardNumber:'',condition:'',notes:'',requestedAmount:'300000',items:[item]};
  const parsed=supportCaseRequest.parse({action:'create',key:'40000000-0000-4000-8000-000000000001',consent:true,draft});
  expect(parsed.action==='create'&&parsed.draft.items).toEqual([item]);
  const message=buildSupportEstimateMessage(draft);expect(message).toContain('架空カード / 2枚');expect(message).toContain('白欠け');
 });
});
