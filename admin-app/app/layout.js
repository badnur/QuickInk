import { Inter } from 'next/font/google'
import './globals.css'
import AdminLayoutClient from './AdminLayoutClient'
import { ThemeProvider } from '@/context/ThemeContext'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'PrintKoro Admin Portal — Fleet & Kiosk Operations',
  description: 'Manage PrintKoro printing hardware, monitor live print orders, and analyze platform revenue.',
  icons: {
    icon: '/icon.png',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark scroll-smooth" suppressHydrationWarning>
      <body className={`${inter.className} antialiased bg-slate-50 text-slate-900 dark:bg-black dark:text-slate-100 transition-colors duration-150`}>
        <ThemeProvider>
          <AdminLayoutClient>
            {children}
          </AdminLayoutClient>
        </ThemeProvider>
      </body>
    </html>
  )
}
