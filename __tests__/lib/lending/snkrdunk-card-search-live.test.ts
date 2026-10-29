// @vitest-environment node
import {expect,it,vi} from 'vitest';
vi.mock('server-only',()=>({}));
import {searchSnkrdunkCards} from '@/lib/lending/snkrdunk-card-search';
it.skipIf(process.env.LENDING_SNKRDUNK_SEARCH_LIVE!=='true')('reads Japanese single-card candidates from the real Web APIs',async()=>{
 const result=await searchSnkrdunkCards('ピカチュウ','all',1);
 expect(result.cards.length).toBeGreaterThan(0);
 expect(result.cards.every(card=>card.category==='pokemon'&&card.name.includes('ピカチュウ'))).toBe(true);
 console.log({provider:'snkrdunk-web-json',count:result.cards.length,first:result.cards[0].name,page:result.page,hasMore:result.hasMore});
},45000);
