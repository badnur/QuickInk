import PrivacyClient from './PrivacyClient'

export const metadata = {
  title: 'Privacy Policy (গোপনীয়তা নীতি) | PrintKoro',
  description: 'Official Privacy Policy and Zero-Retention Data Governance for PrintKoro cloud printing kiosk network in Bangladesh, available in both Bangla (বাংলা) and English. Learn about our optical-sensor confirmed hardware file shredding, memory-only spooling, and tokenized payments.',
  keywords: [
    'PrintKoro privacy policy',
    'প্রিন্টকোরো গোপনীয়তা নীতি',
    'cloud printing privacy Bangladesh',
    'zero retention printing',
    'document security auto wipe',
    'QuickInk data protection',
    'safe printing kiosk Bangladesh'
  ]
}

export default function PrivacyPage() {
  return <PrivacyClient />
}
