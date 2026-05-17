import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'

import './globals.css'
import { AppProvider } from '@/contexts/AppContext'
import { SocketProvider } from '@/contexts/SocketContext'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })

export const metadata: Metadata = {
  title: 'XRM | XpertWebStudio',
  description: 'XRM — Project & Resource Management by XpertWebStudio',
  generator: 'v0.app',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geist.variable} ${geistMono.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <AppProvider>
            <SocketProvider>
              {children}
              <Toaster position="bottom-right" richColors closeButton />
            </SocketProvider>
          </AppProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
