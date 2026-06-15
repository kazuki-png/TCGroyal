import { LegalPage } from '@/app/components/LegalPage'

export const metadata = {
  title: '特定商取引法に基づく表記 | TCG ROYAL',
}

export default function TokushoPage() {
  return (
    <LegalPage
      title="特定商取引法に基づく表記"
      sections={[
        {
          title: '販売事業者',
          body: '株式会社フィンテグラホールディングス',
        },
        {
          title: '運営責任者',
          body: '赤松 和紀',
        },
        {
          title: '所在地',
          body: 'TCG ROYAL 〒106-0032 東京都港区六本木4-2-14 六本木三河台スクエアビル3F',
        },
        {
          title: '電話番号',
          body: '03-6841-8309',
        },
        {
          title: '商品代金以外の必要料金',
          body: '銀行振込手数料、送料',
        },
        {
          title: '商品代金の支払い時期',
          body: '請求書に記載の支払期日',
        },
        {
          title: '商品の引渡時期',
          body: '入金確認後、24時間以内に発送',
        },
        {
          title: 'お支払い方法',
          body: '銀行振込',
        },
        {
          title: '返品・交換について',
          body: '不良品・発送ミスの場合のみ対応。商品到着後7日以内に要連絡。お客様都合による返品不可。',
        },
        {
          title: '資格・免許',
          body: '古物商許可証　第301112617464号',
        },
      ]}
    />
  )
}
