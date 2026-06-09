import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import {
  isAdminApiPathname,
  isAdminHostAllowed,
  isAdminPagePathname,
} from '@/lib/admin/hostAccess'

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return null
  }

  const pathname = value.split('?')[0]
  if (pathname === '/login' || pathname === '/register') {
    return null
  }

  return value
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const pathWithSearch = `${pathname}${request.nextUrl.search}`
  const isAdminPageRoute = isAdminPagePathname(pathname)
  const isAdminApiRoute = isAdminApiPathname(pathname)

  if (
    (isAdminPageRoute || isAdminApiRoute) &&
    !isAdminHostAllowed(request.headers.get('host') ?? request.nextUrl.host)
  ) {
    return new NextResponse(null, { status: 404 })
  }

  let supabaseResponse = NextResponse.next({ request })
  supabaseResponse.headers.set('x-pathname', pathname)
  supabaseResponse.headers.set('x-path-with-search', pathWithSearch)

  const isAdminRoute =
    isAdminPageRoute && !pathname.startsWith('/admin/login')
  const isUserProtectedRoute = pathname.startsWith('/mypage')
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
          supabaseResponse.headers.set('x-path-with-search', pathWithSearch)
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
    loginUrl.searchParams.set('next', pathWithSearch)
    return NextResponse.redirect(loginUrl)
  }

  if (isAuthPage && user) {
    const next = safeNextPath(request.nextUrl.searchParams.get('next'))
    return NextResponse.redirect(new URL(next ?? '/mypage', request.url))
  }

  supabaseResponse.headers.set('x-pathname', pathname)
  supabaseResponse.headers.set('x-path-with-search', pathWithSearch)
  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
