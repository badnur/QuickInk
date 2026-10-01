import { Inter, Hind_Siliguri } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/Navbar'
import { LanguageProvider } from '@/context/LanguageContext'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const hindSiliguri = Hind_Siliguri({
  subsets: ['bengali'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-bangla',
})

export const metadata = {
  title: 'PrintKoro — Print Anything, Anytime, Near You in Bangladesh',
  description: 'Fast, simple, and affordable self-service printing with PrintKoro. Upload from your phone, get your OTP code, and print at a nearby partner shop in 60 seconds.',
  icons: {
    icon: '/icon.png',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="bn" className="scroll-smooth">
      <body className={`${inter.variable} ${hindSiliguri.variable} font-sans antialiased text-gray-900 bg-white selection:bg-[#00bf63]/20 selection:text-[#00bf63]`}>
        <LanguageProvider>
          <Navbar />
          <main className="min-h-screen pt-20">
            {children}
          </main>
        </LanguageProvider>
      </body>
    </html>
  )
}
