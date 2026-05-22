import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  let supabaseResponse = NextResponse.next({ request })
  supabaseResponse.headers.set('x-pathname', pathname)

  const isAdminRoute =
    pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')
  const isUserProtectedRoute =
    pathname.startsWith('/mypage') || pathname.startsWith('/cart')
  const isAuthPage =
    pathname === '/login' || pathname === '/register'

  if (!isAdminRoute && !isUserProtectedRoute && !isAuthPage) {
    return supabaseResponse
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          supabaseResponse.headers.set('x-pathname', pathname)
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (isAdminRoute && !user) {
    return NextResponse.redirect(new URL('/admin/login', request.url))
  }

  if (isAdminRoute && user) {
    const { data: adminRow } = await supabase
      .from('admin_users')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()

    if (!adminRow) {
      const loginUrl = new URL('/admin/login', request.url)
      loginUrl.searchParams.set('error', 'forbidden')
      return NextResponse.redirect(loginUrl)
    }
  }

  if (isUserProtectedRoute && !user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (isAuthPage && user) {
    return NextResponse.redirect(new URL('/mypage', request.url))
  }

  supabaseResponse.headers.set('x-pathname', pathname)
  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
