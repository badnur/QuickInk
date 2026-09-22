import { Inter } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/Navbar'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'PrintKoro — Print Anything, Anytime, Near You in Bangladesh',
  description: 'Fast, simple, and affordable self-service printing with PrintKoro. Upload from your phone, print at a nearby kiosk or partner shop in 60 seconds. ৳2 per page.',
  icons: {
    icon: '/icon.png',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={`${inter.className} antialiased`}>
        <Navbar />
        <main className="min-h-screen pt-20">
          {children}
        </main>
      </body>
    </html>
  )
}
