import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'

export const ALLOWED_EMAILS = [
  'dpalmer.it@gmail.com',
  'scout.logi@gmail.com',
  'lizzyp24@gmail.com',
]

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      return ALLOWED_EMAILS.includes(user.email ?? '')
    },
  },
  pages: {
    signIn: '/lab/login',
    error: '/lab/login',
  },
  session: { strategy: 'jwt' },
}
