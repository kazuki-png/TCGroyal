import {describe,expect,it} from 'vitest'
import {buildTransactions} from '@/lib/lending/transactions'
import type {WorkflowLoan} from '@/lib/lending/workflow-types'
import type {SupportCase} from '@/lib/lending/support-case-types'
const loan={id:'loan1',status:'active',card_name:'カード',collateral_items:[{quantity:2}],principal_jpy:100000,requested_jpy:200000,offered_jpy:150000,due_at:'2026-11-02',created_at:'2026-10-01',events:[{created_at:'2026-10-30'}],storage_location:'INTERNAL'} as unknown as WorkflowLoan
const item={id:'case1',reference:'TR-123',loan_id:'loan1',status:'applied',card_name:'カード',updated_at:'2026-10-30',offer_jpy:150000,requested_jpy:200000,contact_label:'PRIVATE'} as SupportCase
describe('unified lending transactions',()=>{
 it('shows a linked case and contract once with the original reference',()=>{const result=buildTransactions([loan],[item],Date.parse('2026-11-01'));expect(result).toHaveLength(1);expect(result[0]).toMatchObject({id:'loan:loan1',reference:'TR-123',quantity:2,caseId:'case1',group:'attention',amountLabel:'借入元本',amountJpy:100000});expect(JSON.stringify(result)).not.toMatch(/INTERNAL|PRIVATE|storage_location|contact_label/)})
 it('does not count unissued offers as outstanding principal',()=>{const result=buildTransactions([{...loan,status:'offered'}],[item]);expect(result[0]).toMatchObject({amountJpy:150000,amountLabel:'正式な融資提示額',nextAction:'融資条件を確認'})})
 it('keeps cases whose contracts are outside the loaded window visible',()=>{expect(buildTransactions([],[item])[0]).toMatchObject({caseId:'case1',loanId:'loan1'})})
 it.each(['returned','forfeited'] as const)('keeps %s records in completed history',status=>{const result=buildTransactions([{...loan,status,id:'old'}],[{...item,loan_id:null,status:'information_required'}]);expect(result.find(row=>row.loanId==='old')).toMatchObject({group:'completed',amountJpy:null});expect(result.find(row=>row.caseId==='case1')).toMatchObject({group:'attention',nextAction:'必要な情報を確認'})})
})
