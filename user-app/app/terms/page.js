import TermsClient from './TermsClient'

export const metadata = {
  title: 'Terms & Conditions (শর্তাবলী ও নীতিমালা) | PrintKoro',
  description: 'Official Terms and Conditions of Service for PrintKoro self-service cloud printing kiosk network in Bangladesh, available in both Bangla (বাংলা) and English. Covers document privacy, auto-wipe security, pricing, refund guarantees, and partner regulations under the laws of Bangladesh.',
  keywords: [
    'PrintKoro terms and conditions',
    'প্রিন্টকোরো শর্তাবলী ও নীতিমালা',
    'cloud printing Bangladesh',
    'self-service printing kiosk',
    'document privacy auto-delete',
    'QuickInk terms of service',
    'bKash Nagad print refund'
  ]
}

export default function TermsPage() {
  return <TermsClient />
}
