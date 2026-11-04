import {describe,expect,it} from 'vitest'
import {isMobilePreviewPath} from '@/lib/lending/mobile-preview-host'
import {isLendingApiPath} from '../../../mobile/src/api-path'
describe('mobile API path validation',()=>{
 it('allows the bank and repayment preview paths actually used by the mobile screens',()=>{for(const view of ['payment','repayment'])expect(isLendingApiPath(`/workflow?view=${view}&loanId=10000000-0000-4000-8000-000000000001&date=2026-11-04`)).toBe(true)})
 it('allows the authenticated reminder worker on the mobile host without exposing administrator pages',()=>{expect(isMobilePreviewPath('/api/lending/reminders')).toBe(true);expect(isMobilePreviewPath('/admin')).toBe(false);expect(isMobilePreviewPath('/api/admin/lending')).toBe(false)})
 it('preserves existing card and account paths',()=>{for(const path of ['/catalog','/account','/support-cases?id=10000000-0000-4000-8000-000000000001'])expect(isLendingApiPath(path)).toBe(true)})
 it('rejects arbitrary endpoints, origins and injected query parameters',()=>{for(const path of ['/workflow','/workflow?view=admin','https://example.com/account','/../admin','/workflow?view=payment&loanId=10000000-0000-4000-8000-000000000001&date=2026-11-04&role=admin'])expect(isLendingApiPath(path)).toBe(false)})
})
