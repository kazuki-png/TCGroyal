import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('cards')
    .select('id,name,category,card_number,grade,buy_price,image_url,created_at,updated_at')
    .order('category')
    .order('grade')
    .order('name')

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json(data)
}
