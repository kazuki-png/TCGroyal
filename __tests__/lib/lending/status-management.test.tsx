import {afterEach,describe,it,expect,vi} from 'vitest'
import {cleanup,render,screen,fireEvent,waitFor} from '@testing-library/react'
import {StatusProgress} from '@/app/admin/(protected)/lending/StatusProgress'
import {CaseAction} from '@/app/lending/SupportCaseManager'
import type {SupportCase} from '@/lib/lending/support-case-types'
import {RevertCaseStatus} from '@/app/admin/(protected)/lending/RevertCaseStatus'
afterEach(cleanup)
describe('lending status management',()=>{
 it('allows status updates with an empty optional message',async()=>{
  const send=vi.fn().mockResolvedValue(true);
  render(<CaseAction item={{id:'case',version:3,status:'registered',user_id:'owner'} as SupportCase} busy={false} send={send}/>);
  expect(screen.getByRole('textbox')).not.toBeRequired();
  fireEvent.click(screen.getByRole('button',{name:'ステータス・手続きを更新'}));
  await waitFor(()=>expect(send).toHaveBeenCalledWith({action:'review',caseId:'case',version:3,payload:{message:''}}));
 })
 it('defaults to the saved application estimate and requires a reason only when valuation changes',async()=>{
  const send=vi.fn().mockResolvedValue(true);
  render(<CaseAction item={{id:'case',version:3,status:'reviewing',user_id:'owner',application_estimate:{valuationJpy:1051740,amountJpy:315522}} as SupportCase} busy={false} send={send}/>);
  fireEvent.change(screen.getByRole('combobox'),{target:{value:'offer'}});
  const valuation=screen.getByLabelText('確認したカード評価額（円）');
  expect(valuation).toHaveValue(1051740);
  expect(screen.getByLabelText('融資参考額（円）')).toHaveValue(315522);
  expect(screen.getByRole('textbox')).not.toBeRequired();
  fireEvent.click(screen.getByRole('button',{name:'ステータス・手続きを更新'}));
  await waitFor(()=>expect(send).toHaveBeenCalledWith(expect.objectContaining({payload:{message:'',amountJpy:315522,valuationJpy:1051740}})));
  send.mockClear();
  fireEvent.change(valuation,{target:{value:'1000000'}});
  expect(screen.getByRole('textbox')).toBeRequired();
  fireEvent.change(screen.getByRole('textbox'),{target:{value:'   '}});
  fireEvent.click(screen.getByRole('button',{name:'ステータス・手続きを更新'}));
  expect(send).not.toHaveBeenCalled();
  fireEvent.change(valuation,{target:{value:'1051740'}});
  expect(screen.getByRole('textbox')).not.toBeRequired();
 });
 it('leaves missing historical estimates blank',()=>{
  render(<CaseAction item={{id:'case',version:1,status:'reviewing',user_id:'owner'} as SupportCase} busy={false} send={vi.fn()}/>);
  fireEvent.change(screen.getByRole('combobox'),{target:{value:'offer'}});
  expect(screen.getByLabelText('確認したカード評価額（円）')).toHaveValue(null);
  expect(screen.getByLabelText('融資参考額（円）')).toHaveValue(null);
  expect(screen.getByRole('textbox')).not.toBeRequired();
 });
 it('requires a reason for a supported rollback and never exposes rollback for a linked loan',()=>{
  const {rerender}=render(<RevertCaseStatus item={{id:'case',status:'offered',version:2,loan_id:null} as SupportCase} busy={false} send={vi.fn()}/>);
  expect(screen.getByRole('button',{name:'理由を記録してステータスを戻す',hidden:true})).toBeDisabled();
  rerender(<RevertCaseStatus item={{id:'case',status:'applied',version:3,loan_id:'loan'} as SupportCase} busy={false} send={vi.fn()}/>);expect(screen.queryByText('ステータスを戻す')).not.toBeInTheDocument();
 })
 it('marks the current loan stage and explains that financial stages require actual records',()=>{render(<StatusProgress kind="loan" status="active"/>);expect(screen.getByRole('region',{name:'現在のステータス'})).toBeInTheDocument();expect(screen.getByText('5. 契約中')).toHaveAttribute('aria-current','step');expect(screen.getByText(/残高を変える単純な巻き戻し/)).toBeInTheDocument()})
 it('offers only valid next case states and sends the current version with the operator reason',async()=>{
  const send=vi.fn().mockResolvedValue(true),item={id:'case',version:3,status:'registered',user_id:'owner'} as SupportCase;
  render(<CaseAction item={item} busy={false} send={send}/>);expect(screen.queryByRole('option',{name:/見積もり提示/})).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('利用者に表示する案内・見積もり根拠（任意）'),{target:{value:'カードの確認を開始しました'}});fireEvent.click(screen.getByRole('button',{name:'ステータス・手続きを更新'}));
  await waitFor(()=>expect(send).toHaveBeenCalledWith({action:'review',caseId:'case',version:3,payload:{message:'カードの確認を開始しました'}}));
 })
})
