import type { Metadata } from 'next'
import { ThemeProvider } from 'next-themes'

import { LegalFooter } from '@/shared/ui/legal-footer'

import './globals.css'

export const metadata: Metadata = {
  title: 'wellcrafted-agentic-base',
  description: 'Production-ready Next.js boilerplate engineered for agentic coding.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="bg-background text-foreground min-h-screen antialiased">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <div className="flex min-h-screen flex-col">
            <div className="flex-1">{children}</div>
            <LegalFooter />
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}
