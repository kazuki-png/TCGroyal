import {afterEach,describe,it,expect,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {LoanCard} from '@/app/lending/LendingWorkspace';
import type {WorkflowLoan} from '@/lib/lending/workflow-types';
afterEach(cleanup);
const item={id:'30000000-0000-4000-8000-000000000001',name:'架空カードA',cardNumber:'001',quantity:2,grade:'未鑑定',condition:'白欠け',source:'manual' as const,productId:null,cardUid:null};
const loan:WorkflowLoan={id:'40000000-0000-4000-8000-000000000001',version:1,status:'submitted',cert_number:null,card_name:'まとめて申込',card_number:null,requested_jpy:300000,offered_jpy:null,principal_jpy:0,monthly_rate_bps:null,due_at:null,funded_at:null,created_at:'2026-10-29',evaluated_at:'2026-10-29',storage_location:null,payoff_jpy:0,terms:null,terms_accepted_at:null,events:[],ledger:[],requests:[],collateral_items:[item]};
describe('bundle inspection and return controls',()=>{
 it('sends the exact line quantity, location and confirmation with inspection',async()=>{
  const send=vi.fn().mockResolvedValue(undefined);render(<LoanCard loan={loan} admin busy={false} send={send}/>);
  fireEvent.change(screen.getByLabelText('保管場所'),{target:{value:'Common'}});
  fireEvent.click(screen.getByLabelText(/現物のカード・状態と申込内容を照合/));
  fireEvent.click(screen.getByLabelText('この明細の現物・枚数・状態を照合しました'));
  fireEvent.change(screen.getByLabelText('架空カードA の現物枚数'),{target:{value:'1'}});
  fireEvent.click(screen.getByRole('button',{name:'ステータス・手続きを更新'}));expect(send).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('架空カードA の現物枚数'),{target:{value:'2'}});
  fireEvent.click(screen.getByRole('button',{name:'ステータス・手続きを更新'}));
  await waitFor(()=>expect(send).toHaveBeenCalledWith(expect.objectContaining({action:'receive',payload:{location:'Common',inspected:true,collateralInspection:[{id:item.id,quantity:2,location:'Common',checked:true}]}})));
 });
 it('requires an explicit whole-bundle return confirmation',async()=>{
  const send=vi.fn().mockResolvedValue(undefined);render(<LoanCard loan={{...loan,status:'return_pending'}} admin busy={false} send={send}/>);
  const check=screen.getByLabelText('明細の全カード・全枚数をまとめて返却したことを確認しました');expect(check).toBeRequired();fireEvent.click(check);
  fireEvent.change(screen.getByLabelText('返却追跡番号・店頭受領番号'),{target:{value:'TEST-RETURN'}});fireEvent.click(screen.getByRole('button',{name:'ステータス・手続きを更新'}));
  await waitFor(()=>expect(send).toHaveBeenCalledWith(expect.objectContaining({action:'return',payload:{reference:'TEST-RETURN',allItemsReturned:true}})));
 });
});
