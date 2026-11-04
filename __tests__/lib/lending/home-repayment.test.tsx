import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import type {WorkflowLoan,WorkflowState} from '@/lib/lending/workflow-types';
import {buildTransactions} from '@/lib/lending/transactions';
vi.mock('../../../mobile/node_modules/react/index.js',()=>vi.importActual('react'));
vi.mock('../../../mobile/node_modules/react-native/index.js',()=>({
 View:({children,accessibilityLabel}:{children:React.ReactNode;accessibilityLabel?:string})=><div aria-label={accessibilityLabel}>{children}</div>,
 Text:({children}:{children:React.ReactNode})=><span>{children}</span>,StyleSheet:{create:(value:unknown)=>value},
 Pressable:({children,onPress,accessibilityLabel}:{children:React.ReactNode;onPress:()=>void;accessibilityLabel:string})=><button aria-label={accessibilityLabel} onClick={onPress}>{children}</button>,
}));
vi.mock('../../../mobile/src/ui.tsx',()=>({ui:{},yen:(n:number)=>'¥'+n.toLocaleString('ja-JP'),Button:({title,onPress}:{title:string;onPress:()=>void})=><button onClick={onPress}>{title}</button>}));
import {HomeRepayment,repaymentDeadline,repaymentLoans} from '../../../mobile/src/screens/HomeRepayment';
import {HomeScreen} from '../../../mobile/src/screens/HomeScreen';
const now=Date.parse('2026-11-04T23:30:00+09:00');
const loan:WorkflowLoan={id:'one',version:1,status:'active',cert_number:null,card_name:'ピカチュウ',card_number:null,requested_jpy:100000,offered_jpy:100000,principal_jpy:100000,monthly_rate_bps:300,due_at:'2026-11-05T00:10:00+09:00',funded_at:'2026-11-01T00:00:00Z',created_at:'2026-11-01T00:00:00Z',evaluated_at:'2026-11-04T14:00:00Z',storage_location:null,payoff_jpy:103000,terms:null,terms_accepted_at:null,events:[],ledger:[],requests:[]};
const state:WorkflowState={outstandingJpy:100000,loanCount:1,role:'customer',demo:true,marketFixture:false,identityVerified:true,cards:[],loans:[loan]};
afterEach(cleanup);
describe('home repayment priority',()=>{
 it('uses the server payoff, separates principal and interest, and opens the same contract',()=>{
  const open=vi.fn();render(<HomeScreen state={state} items={buildTransactions([loan],[],now)} draftCount={0} onApply={()=>{}} onTransactions={()=>{}} onOpen={open} onIdentity={()=>{}} now={now} banner={<span>BANNER</span>}/>);
  expect(screen.getByText('¥103,000')).toBeTruthy();expect(screen.getByText('元金 ¥100,000 · 利息 ¥3,000')).toBeTruthy();expect(screen.getByText('あと1日')).toBeTruthy();expect(screen.getByText(/11\/4.*23:00.*時点/)).toBeTruthy();
  expect(screen.getByText('¥103,000').compareDocumentPosition(screen.getByText('BANNER'))&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.queryByText('進行中の取引')).toBeNull();fireEvent.click(screen.getByText('返済・契約を確認'));expect(open).toHaveBeenCalledWith('loan:one');
 });
 it('prioritizes the nearest and overdue contracts without changing the source array',()=>{
  const loans=[{...loan,id:'missing',due_at:null},{...loan,id:'later',due_at:'2026-12-01T00:00:00Z'},{...loan,id:'ended',status:'returned' as const,due_at:'2026-10-01T00:00:00Z'},{...loan,id:'overdue',due_at:'2026-11-01T00:00:00Z'}];
  expect(repaymentLoans(loans).map(row=>row.id)).toEqual(['overdue','later','missing']);expect(loans[0].id).toBe('missing');
 });
 it('counts Japanese calendar days and handles today, overdue and missing dates',()=>{
  expect(repaymentDeadline(loan.due_at,now).remaining).toBe('あと1日');expect(repaymentDeadline('2026-11-04T23:59:00+09:00',now).remaining).toBe('本日期限');expect(repaymentDeadline('2026-11-04T22:00:00+09:00',now).remaining).toBe('期限超過');expect(repaymentDeadline(null,now).date).toBe('未設定');
 });
 it('does not fabricate a zero payoff and marks pending repayment without claiming it is completed',()=>{
  render(<HomeRepayment loan={{...loan,status:'repayment_pending',payoff_jpy:0}} now={now} onOpen={()=>{}}/>);expect(screen.getByText('入金確認中')).toBeTruthy();expect(screen.getByText('確認が必要です')).toBeTruthy();expect(screen.queryByText('¥0')).toBeNull();expect(screen.getByText('入金状況を確認')).toBeTruthy();
 });
 it('puts the banner first without an active contract and omits empty sections',()=>{
  render(<HomeScreen state={{...state,loans:[],outstandingJpy:0}} items={[]} draftCount={0} onApply={()=>{}} onTransactions={()=>{}} onOpen={()=>{}} onIdentity={()=>{}} now={now} banner={<span>BANNER</span>}/>);expect(screen.queryByText('返済必要額')).toBeNull();expect(screen.queryByText('進行中の取引')).toBeNull();expect(screen.getByText('BANNER').compareDocumentPosition(screen.getByText('カードを申し込む'))&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
 });
});
