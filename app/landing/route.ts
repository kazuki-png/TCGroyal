export async function GET() {
  return new Response(null, {
    status: 308,
    headers: {
      location: '/yuso-kaitori',
    },
  })
}
