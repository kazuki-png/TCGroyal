import {timingSafeEqual} from 'node:crypto'
import {isPreviewLendingEnabled} from '@/lib/lending/local-config'
import {dispatchDueReminders,reminderWorkerToken} from '@/lib/lending/due-reminders'
export const runtime='nodejs'
export const maxDuration=60
export async function POST(request:Request){
 if(!isPreviewLendingEnabled())return Response.json({error:'Not available'},{status:404})
 const expected=Buffer.from(`Bearer ${reminderWorkerToken(process.env.LENDING_PREVIEW_SESSION_SECRET!)}`),actual=Buffer.from(request.headers.get('authorization')??'')
 if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return Response.json({error:'Unauthorized'},{status:401})
 try{return Response.json(await dispatchDueReminders(),{headers:{'Cache-Control':'no-store'}})}catch{return Response.json({error:'Reminder worker unavailable'},{status:503})}
}
