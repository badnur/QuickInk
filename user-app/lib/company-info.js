/**
 * PrintKoro / QuickInk Technologies - Central Corporate & Legal Information
 * Payment Gateway Merchant Compliance:
 * - Trade License Number
 * - Registered Physical Office Address & Contact
 * - BDT Currency Definition
 */

export const COMPANY_INFO = {
  brandName: 'PrintKoro',
  legalEntityName: 'PrintKoro',
  tradeLicenseNo: process.env.NEXT_PUBLIC_TRADE_LICENSE_NO || '40',
  tinNo: process.env.NEXT_PUBLIC_TIN_NO || '535269',
  
  // Tagline & Overview
  tagline: "Bangladesh's Premier Smart Self-Service Cloud Printing Network",
  taglineBn: 'বাংলাদেশের সর্বাধুনিক সেলফ-সার্ভিস ক্লাউড প্রিন্টিং ও পার্টনার স্টেশন নেটওয়ার্ক',
  description: 'PrintKoro is a revolutionary on-demand smart cloud printing and self-service kiosk network in Bangladesh, enabling students, professionals, and citizens to print documents directly from smartphones or computers in 60 seconds without pendrives or waiting lines.',
  descriptionBn: 'প্রিন্টকোরো হলো বাংলাদেশের প্রথম ও সর্বাধুনিক স্মার্ট ক্লাউড প্রিন্টিং নেটওয়ার্ক, যার মাধ্যমে পেনড্রাইভের ঝুঁকি ছাড়াই যে কেউ স্মার্টফোন বা ল্যাপটপ থেকে সরাসরি ডকুমেন্টস আপলোড করে ৬০ সেকেন্ডে প্রিন্ট নিতে পারেন।',

  // Physical Business Addresses
  registeredOffice: 'Bagha, Rajshahi - 6280, Bangladesh',
  registeredOfficeBn: 'বাঘা, রাজশাহী - ৬২৮০, বাংলাদেশ',
  operationsHub: 'Dhaka & Rajshahi, Bangladesh',
  operationsHubBn: 'ঢাকা ও রাজশাহী, বাংলাদেশ',
  
  // Contact Numbers & Support
  helpline: '+880 1733-398911',
  helplineRaw: '+8801733398911',
  whatsapp: '+880 1733-398911',
  whatsappUrl: 'https://wa.me/8801733398911',
  email: 'help@printkoro.com',
  supportEmail: 'support@printkoro.com',
  refundEmail: 'refund@printkoro.com',
  contactEmail: 'contact@printkoro.com',

  // Operating Hours
  operatingHours: 'Saturday - Thursday: 9:00 AM - 9:00 PM BST (Online & Kiosk Network Operates 24/7)',
  operatingHoursBn: 'শনিবার - বৃহস্পতিবার: সকাল ৯:০০ - রাত ৯:০০ (কিয়স্ক নেটওয়ার্ক ২৪/৭ সক্রিয়)',

  // Currency & Jurisdiction
  currency: 'BDT',
  currencySymbol: '৳',
  jurisdiction: 'Dhaka, Bangladesh',
  governingLaw: "Laws of the People's Republic of Bangladesh"
}
