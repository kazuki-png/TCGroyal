import {useRef,useState} from 'react';
import {Text,View} from 'react-native';
import type {RepaymentPreview as Preview} from '../../../lib/lending/repayment-types';
import {lendingApi} from '../api';
import {Button,Field,ui,yen,date} from '../ui';
export function RepaymentPreview({loanId}:{loanId:string}){
 const [day,setDay]=useState(()=>new Date(Date.now()+9*3600000).toISOString().slice(0,10)),[result,setResult]=useState<Preview|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);const generation=useRef(0);
 async function calculate(){if(busy)return;const own=++generation.current;setBusy(true);setError('');try{const data=await lendingApi<{preview:Preview}>(`/workflow?view=repayment&loanId=${encodeURIComponent(loanId)}&date=${encodeURIComponent(day)}`);if(own===generation.current)setResult(data.preview)}catch(cause){if(own===generation.current)setError(cause instanceof Error?cause.message:'返済額を取得できません。')}finally{setBusy(false)}}
 return <View style={ui.card}><Text style={ui.title}>返済予定日の必要額</Text><Field label="返済予定日（YYYY-MM-DD）" value={day} onChangeText={value=>{generation.current++;setDay(value);setResult(null)}} keyboardType="numbers-and-punctuation" maxLength={10}/><Button title={busy?'確認中…':'この日の返済額を確認'} disabled={busy||!/^\d{4}-\d{2}-\d{2}$/.test(day)} onPress={()=>void calculate()}/>{!!error&&<Text accessibilityRole="alert" style={ui.error}>{error}</Text>}{result&&<><Text style={ui.body}>元金 {yen(result.principalJpy)}</Text><Text style={ui.body}>{result.chargeLabel??'質料'} {yen(result.interestJpy)}</Text><Text style={ui.amount}>合計 {yen(result.totalJpy)}</Text><Text style={ui.muted}>基準日時 {date(result.basisAt)} / 算出 {date(result.calculatedAt)}</Text></>}<Text style={ui.muted}>指定日末時点（満期日は契約期限時点）の見込みです。実際の必要額は運営の入金照合時に確定します。ここでは振込や返済申告は行いません。</Text></View>;
}
