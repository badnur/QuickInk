import { Inter } from 'next/font/google'
import './globals.css'
import AdminLayoutClient from './AdminLayoutClient'

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
    <html lang="en" className="dark scroll-smooth">
      <body className={`${inter.className} antialiased bg-[#090d16] text-slate-100`}>
        <AdminLayoutClient>
          {children}
        </AdminLayoutClient>
      </body>
    </html>
  )
}
