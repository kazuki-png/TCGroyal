import {notFound} from 'next/navigation'
import {z} from 'zod'
import {LendingDetail} from '../../LendingDetail'
export default async function Page({params}:{params:Promise<{kind:string;id:string}>}){
 const {kind,id}=await params
 if(!['case','loan'].includes(kind)||!z.uuid().safeParse(id).success)notFound()
 return <LendingDetail key={`${kind}-${id}`} kind={kind as 'case'|'loan'} id={id}/>
}
