// Retired administrator price-linking endpoint. No provider calls or financial writes.
export async function POST() {
 return Response.json({error:'この査定連携は終了しました。融資管理をご利用ください。'},{status:410,headers:{'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow'}})
}