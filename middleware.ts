export { default } from 'next-auth/middleware'

export const config = {
  matcher: [
    '/lab/dashboard/:path*',
    '/lab/results/:path*',
    '/api/jobs/:path*',
  ],
}
