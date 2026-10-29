function errorText(error:unknown):string{
 const seen=new Set<object>();
 function read(value:unknown,depth=0):string{
  if(typeof value==='string')return value.slice(0,1500);
  if(!value||typeof value!=='object'||depth>3||seen.has(value))return '';
  seen.add(value);const item=value as Record<string,unknown>;
  return [item.name,item.code,item.message,read(item.cause,depth+1)].filter(v=>typeof v==='string').join(': ');
 }
 return read(error);
}
export function diagnosticErrorDetail(error:unknown):string{
 // Only bounded error fields; never stack, response payload, cookies or headers.
 return errorText(error).replace(/https?:\/\/[^\s"']+/gi,'[URL]').replace(/Bearer\s+\S+/gi,'Bearer [非表示]')
  .replace(/[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}(?:\.[A-Za-z0-9_-]+)?/g,'[非表示]')
  .replace(/((?:token|secret|password|apikey|key)\s*[=:]\s*)[^\s,;]+/gi,'$1[非表示]')
  .replace(/[A-Za-z0-9_-]{40,}/g,'[非表示]').replace(/[\r\n\t]+/g,' ').slice(0,220);
}
export function networkFailureCode(error: unknown): 'dns'|'timeout'|'tls'|'network'|null {
 const message=errorText(error);
 if(/UnknownHostException|Unable to resolve host|ENOTFOUND|EAI_AGAIN/i.test(message))return 'dns';
 if(/SSLHandshakeException|SSLPeerUnverifiedException|CertPathValidatorException|CertificateException|Trust anchor|CERTIFICATE_VERIFY_FAILED|certificate pinning/i.test(message))return 'tls';
 if(/AbortError|TimeoutError|SocketTimeoutException|timed?\s*out|operation was aborted/i.test(message))return 'timeout';
 if(/Network request failed|fetch failed|Failed to fetch/i.test(message))return 'network';
 return null;
}
export function networkFailureSummary(code: ReturnType<typeof networkFailureCode>) {
 if(code==='dns')return '通信先の名前を解決できませんでした（DNS）。';
 if(code==='timeout')return '通信が時間内に完了しませんでした。';
 if(code==='tls')return 'サーバー証明書の確認に失敗しました（TLS）。';
 return 'サーバーへ接続できませんでした。';
}
export function networkFailureMessage(code: ReturnType<typeof networkFailureCode>) {
 return networkFailureSummary(code)+'左上の「テスト環境」から接続診断を実行してください。';
}
