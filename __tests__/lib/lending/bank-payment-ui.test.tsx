import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import type {WorkflowLoan} from '@/lib/lending/workflow-types';
vi.mock('../../../mobile/node_modules/react/index.js',()=>vi.importActual('react'));
vi.mock('../../../mobile/node_modules/react-native/index.js',()=>({View:({children}:{children:React.ReactNode})=><div>{children}</div>,Text:({children}:{children:React.ReactNode})=><span>{children}</span>}));
vi.mock('../../../mobile/src/ui.tsx',()=>({ui:{},yen:(n:number)=>'¥'+n.toLocaleString('ja-JP'),date:(s:string)=>s,Button:({title,onPress,disabled}:{title:string;onPress:()=>void;disabled?:boolean})=><button onClick={onPress} disabled={disabled}>{title}</button>,Field:({label,value,onChangeText}:{label:string;value:string;onChangeText:(v:string)=>void})=><input aria-label={label} value={value} onChange={e=>onChangeText(e.target.value)}/>,RoyalSwitch:({value,onValueChange}:{value:boolean;onValueChange:(v:boolean)=>void})=><input type="checkbox" aria-label="振込内容を確認しました" checked={value} onChange={e=>onValueChange(e.target.checked)}/>}));
const api=vi.hoisted(()=>vi.fn());vi.mock('../../../mobile/src/api.ts',()=>({lendingApi:api}));
import {BankPayment} from '../../../mobile/src/screens/BankPayment';
const loan={id:'loan',version:2,status:'active',requests:[]} as unknown as WorkflowLoan;
const preview={principalJpy:100000,interestJpy:1000,totalJpy:101000,chargeLabel:'期限前返済手数料',version:2,extensionAmountJpy:1000,extensionAvailable:true,unpaidMonths:1,newDueAt:'2027-01-01',dueAt:'2026-12-01'};
afterEach(()=>{cleanup();vi.resetAllMocks()});
describe('bank transfer screen',()=>{
 it('shows the dummy account and waits for name and consent before reporting, without trusting a device price',async()=>{
  api.mockResolvedValue({preview});const report=vi.fn();render(<BankPayment loan={loan} kind="repayment" busy={false} onReport={report}/>);
  expect(await screen.findByText('¥101,000')).toBeTruthy();expect(screen.getByText('元金 ¥100,000 / 期限前返済手数料 ¥1,000')).toBeTruthy();expect(screen.getByText('振込先（ダミー）')).toBeTruthy();const button=screen.getByText('返済分を振込済み') as HTMLButtonElement;expect(button.disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('振込名義'),{target:{value:'テスト'}});fireEvent.click(screen.getByLabelText('振込内容を確認しました'));fireEvent.click(button);
  expect(report).toHaveBeenCalledWith('report_repayment',expect.objectContaining({transferName:'テスト',transferDate:expect.any(String)}));expect(report.mock.calls[0][1].amountJpy).toBeUndefined();
 });
 it('shows unpaid extension fee and new date, then sends a consented transfer report',async()=>{
  api.mockResolvedValue({preview});const report=vi.fn();render(<BankPayment loan={loan} kind="extension" busy={false} onReport={report}/>);expect(await screen.findByText('¥1,000')).toBeTruthy();expect(screen.getByText('未払い質料 1か月分')).toBeTruthy();fireEvent.change(screen.getByLabelText('振込名義'),{target:{value:'テスト'}});fireEvent.click(screen.getByLabelText('振込内容を確認しました'));fireEvent.click(screen.getByText('延長分を振込済み'));expect(report).toHaveBeenCalledWith('request_extension',expect.objectContaining({termsAccepted:true}));
 });
 it('does not permit reporting when the amount is unavailable or the quote belongs to an old version',async()=>{
  api.mockResolvedValue({preview:{...preview,version:1}});render(<BankPayment loan={loan} kind="extension" busy={false} onReport={()=>{}}/>);expect(screen.getByText('延長分を振込済み').closest('button')?.disabled).toBe(true);expect(screen.queryByText('¥1,000')).toBeNull();
 });
 it('keeps a transfer report pending and does not treat it as a confirmed repayment',()=>{
  render(<BankPayment loan={{...loan,status:'repayment_pending'}} kind="repayment" busy={false} onReport={()=>{}}/>);expect(screen.getByText('入金確認中')).toBeTruthy();expect(api).not.toHaveBeenCalled();expect(screen.queryByText('返済分を振込済み')).toBeNull();
 });
});
