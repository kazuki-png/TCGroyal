import {it,expect} from 'vitest';
import {requestedAmountError} from '@/lib/lending/requested-amount';
import type {BundleEstimate} from '@/lib/lending/bundle-estimate-types';
const quote:BundleEstimate={ruleVersion:'three-month-average-preview-v3',status:'reference',amountJpy:10000,lines:[],reason:'',calculatedAt:'2026-11-14T00:00:00Z',expiresAt:'2099-01-01T00:00:00Z'};
it('caps fully valued requests and allows mixed/manual consultation amounts',()=>{
 expect(requestedAmountError('10000',quote)).toBe('');
 expect(requestedAmountError('10001',quote)).toContain('以内');
 expect(requestedAmountError('20000000',{...quote,status:'manual',amountJpy:null})).toBe('');
 expect(requestedAmountError('',quote)).toBe('');
});
it('refuses stale estimates and invalid amounts',()=>{
 expect(requestedAmountError('1',null)).toContain('最新');
 expect(requestedAmountError('1',{...quote,expiresAt:'2020-01-01'})).toContain('最新');
 for(const amount of ['-1','0','1.5','9007199254740992'])expect(requestedAmountError(amount,quote)).toContain('整数');
});
