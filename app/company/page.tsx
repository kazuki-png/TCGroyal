import { redirect } from 'next/navigation'

export const metadata = {
  title: '会社概要 | TCG ROYAL',
}

export default function CompanyPage() {
  redirect('https://fintegrahds.com/company/')
}
