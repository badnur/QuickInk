import DeliveryClient from './DeliveryClient'

export const metadata = {
  title: 'Delivery & Fulfillment Policy (ডেলিভারি নীতিমালা) | PrintKoro',
  description: 'Official Delivery and Fulfillment Policy of PrintKoro (QuickInk Technologies). Details instant cloud dispatch, 60-second kiosk physical print ejection, OTP ticket validity, and doorstep delivery terms in Bangladesh.',
  keywords: [
    'PrintKoro delivery policy',
    'প্রিন্টকোরো ডেলিভারি নীতিমালা',
    'kiosk print turnaround time',
    'cloud document fulfillment Bangladesh',
    'print pickup OTP validity',
    'QuickInk delivery terms'
  ]
}

export default function DeliveryPage() {
  return <DeliveryClient />
}
