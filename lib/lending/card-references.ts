import 'server-only'
import {createWorkflowClient} from './workflow-client'
import type {SnkrdunkCard} from './snkrdunk-card-types'

// Search success must survive a transient reference-store failure. Never accept
// caller-submitted metadata here: only parsed provider product responses.
export async function saveCardReferences(cards:SnkrdunkCard[]):Promise<void>{
 if(!cards.length)return
 try{
  const lastSeen=new Date().toISOString()
  const unique=[...new Map(cards.map(card=>[card.productId,card])).values()]
  const {error}=await createWorkflowClient().from('lending_card_references').upsert(unique.map(card=>({
   provider:'snkrdunk',product_id:card.productId,name:card.name,card_number:card.cardNumber,
   category:card.category,image_url:card.imageUrl,source_url:card.sourceUrl,last_seen_at:lastSeen,
  })),{onConflict:'provider,product_id'}).abortSignal(AbortSignal.timeout(1500))
  if(error)console.warn('lending_card_reference_save_failed')
 }catch{console.warn('lending_card_reference_save_failed')}
}
