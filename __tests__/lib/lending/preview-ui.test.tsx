import {afterEach,describe,it,expect} from 'vitest'
import {cleanup,render,screen} from '@testing-library/react'
import {LendingDashboard} from '@/app/admin/(protected)/lending/LendingDashboard'
import type {AdminLendingDashboard} from '@/lib/lending/admin-types'
afterEach(cleanup)
const data:AdminLendingDashboard={page:1,pageSize:25,total:26,evaluatedAt:'2026-10-29T00:00:00Z',summary:{outstandingJpy:1250000,activeCount:4,reviewCount:2,preparingCount:3,repaymentPendingCount:1,dueSoonCount:1,overdueCount:1,returnPendingCount:0},rows:[{kind:'loan',id:'20000000-0000-4000-8000-000000000001',reference:'TR-ABC',user_id:'user',customer_name:'山田 太郎',card_name:'ピカチュウ',card_number:'025',status:'active',requested_jpy:300000,principal_jpy:250000,offer_jpy:300000,due_at:'2026-10-28T00:00:00Z',created_at:'2026-10-01T00:00:00Z',updated_at:'2026-10-28T00:00:00Z',bucket:'active',has_pending_request:true}]}
describe('administrator lending overview',()=>{
 it('shows whole-portfolio totals, urgency and detail links without price-linking controls',()=>{
  render(<LendingDashboard data={data} search="ピカチュウ" filter="all"/>);
  expect(screen.getByRole('heading',{name:'融資管理'})).toBeInTheDocument();expect(screen.getByText('¥1,250,000')).toBeInTheDocument();expect(screen.getByText('期限超過・要確認')).toBeInTheDocument();expect(screen.getByText('延長・追加相談あり')).toBeInTheDocument();expect(screen.getByText('山田 太郎')).toBeInTheDocument();
  expect(screen.getByRole('link',{name:'TR-ABCの詳細'})).toHaveAttribute('href','/admin/lending/loan/20000000-0000-4000-8000-000000000001');expect(screen.getByRole('link',{name:'次のページ'}).getAttribute('href')).toContain('page=2');expect(screen.queryByText(/スニダン/)).not.toBeInTheDocument();
 });
 it('keeps the global summary and an explicit empty result after filtering',()=>{
  render(<LendingDashboard data={{...data,rows:[],total:0}} search="なし" filter="overdue"/>);expect(screen.getByText('該当する案件はありません。')).toBeInTheDocument();expect(screen.getByText('¥1,250,000')).toBeInTheDocument();expect(screen.queryByRole('link',{name:'次のページ'})).not.toBeInTheDocument();
 });
})