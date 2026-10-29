/** Keep the physical inspection mandatory; explain each failed check before writing. */
export function inspectionInputError(certNumber: string | null, payload: {
  location?: unknown; certNumber?: unknown; inspected?: unknown
}): string | null {
  if (typeof payload.location !== 'string' || !payload.location.trim() || payload.location.trim().length > 120)
    return '保管場所を1〜120文字で入力してください。'
  if (certNumber !== null && payload.certNumber !== certNumber)
    return '現物のPSA鑑定番号が申込時の番号と一致しません。現物のラベルと申込内容を確認してください。'
  if (certNumber === null && payload.certNumber !== undefined)
    return 'この申込はPSA鑑定番号なしで受け付けています。案件を再読み込みしてください。'
  if (payload.inspected !== true)
    return '現物と申込内容を照合し、検品確認のチェックを入れてください。'
  return null
}
