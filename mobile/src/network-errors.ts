export function networkFailureCode(error: unknown): 'dns'|'timeout'|'network'|null {
 const message=error instanceof Error?`${error.name}: ${error.message}`:typeof error==='string'?error:'';
 if(/UnknownHostException|Unable to resolve host|ENOTFOUND|EAI_AGAIN/i.test(message))return 'dns';
 if(/AbortError|TimeoutError|timed?\s*out/i.test(message))return 'timeout';
 if(/Network request failed|fetch failed|Failed to fetch/i.test(message))return 'network';
 return null;
}
export function networkFailureMessage(code: ReturnType<typeof networkFailureCode>) {
 if(code==='dns')return '通信先の名前を解決できませんでした（DNS）。左上の「テスト環境」から接続診断を実行してください。';
 if(code==='timeout')return '通信が時間内に完了しませんでした。接続診断を実行して、再度お試しください。';
 return 'サーバーへ接続できませんでした。左上の「テスト環境」から接続診断を実行してください。';
}
