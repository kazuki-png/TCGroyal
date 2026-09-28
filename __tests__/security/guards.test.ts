// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { safeLocalPath } from '@/lib/security/redirect'
import { escapeCsvCell } from '@/lib/security/csv'
describe('redirects', () => {
 it.each(['//evil.invalid','/\\evil.invalid','/\nevil.invalid','https://evil.invalid','/login','/register'])('rejects %j', value => expect(safeLocalPath(value)).toBe('/mypage'))
 it('preserves local paths and query parameters', () => expect(safeLocalPath('/cart?coupon=TEST')).toBe('/cart?coupon=TEST'))
})
describe('CSV formula escaping', () => {
 it.each(['=1+1','+SUM(A1)','-1+1','@SUM(A1)',' =1+1','\t=1'])('neutralizes %j', value => expect(escapeCsvCell(value)).toBe(`"'${value}"`))
 it('escapes delimiters', () => expect(escapeCsvCell('a,"b')).toBe('"a,""b"'))
})
