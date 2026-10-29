import 'server-only'
import {createWorkflowClient} from './workflow-client'
import {visiblePriceUpdatedAfter} from '@/lib/cards/visibility'
import {catalogTokens} from './catalog'
import type {CatalogSearch} from './catalog-types'
export const catalogColumns='public_uid,name,card_number,category,grade,image_url,buy_price,buy_price_updated_at'
export async function searchCatalog(query:string,category='all',page=1):Promise<CatalogSearch>{
 let request=createWorkflowClient().from('cards').select(catalogColumns,{count:'exact'}).gte('buy_price_updated_at',visiblePriceUpdatedAfter())
 if(category!=='all')request=request.eq('category',category)
 for(const word of catalogTokens(query))request=request.or(`name.ilike.%${word}%,card_number.ilike.%${word}%`)
 const {data,error,count}=await request.order('buy_price',{ascending:false}).order('public_uid').range((page-1)*12,page*12-1)
 if(error)throw Error('カード一覧を取得できません。時間をおいて再度お試しください。')
 return {cards:data??[],total:count??0,page}
}
