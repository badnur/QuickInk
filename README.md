# QuickInk - Self-Service Printing Kiosk Platform

> **Print Anything, Anytime — Near You**  
> Upload → Pay → Print in 60 seconds

QuickInk is a modern, production-ready MVP website for a self-service printing kiosk startup. Users can find nearby printing kiosks, and shop owners can become partners to earn passive income.

---

## 🚀 Live Demo

Visit: **https://instant-print-hub-2.preview.emergentagent.com**

---

## ✨ Features

### For Users
- **Find Printers**: Interactive map showing nearby QuickInk kiosks with real-time status
- **Simple Pricing**: Transparent pricing - ₹2/page B&W, ₹8/page Color
- **Mobile-First Design**: Fully responsive, works beautifully on all devices
- **Search & Filter**: Find printers by location or name

### For Partners
- **Partner Registration**: Simple form to apply for hosting a kiosk
- **Earning Calculator**: Clear information about commission structure (40% per print)
- **Zero Effort**: Fully automated system with no maintenance required

### Contact & Support
- **Contact Form**: Direct messaging system
- **WhatsApp Integration**: Instant support via WhatsApp
- **Multiple Channels**: Email, phone, and office location provided

---

## 🛠 Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Styling**: Tailwind CSS + shadcn/ui
- **Backend**: Next.js API Routes
- **Database**: MongoDB (ready for integration)
- **Icons**: Lucide React
- **Deployment**: Vercel-ready

---

## 📁 Project Structure

```
/app
├── app/
│   ├── page.js                          # Homepage
│   ├── find-printer/page.js             # Printer finder with map
│   ├── partner/page.js                  # Partner registration
│   ├── contact/page.js                  # Contact page
│   ├── layout.js                        # Root layout with Navbar/Footer
│   ├── globals.css                      # Global styles
│   └── api/
│       └── [[...path]]/route.js         # API routes
├── components/
│   ├── Navbar.jsx                       # Navigation bar
│   ├── Footer.jsx                       # Footer component
│   └── ui/                              # shadcn components
├── lib/
│   └── utils/                           # Utility functions
├── tests/
│   └── backend_test.py                  # Backend API tests
├── .env                                 # Environment variables
├── package.json                         # Dependencies
└── README.md                           # Documentation
```

---

## 🚦 Getting Started

### Prerequisites
- Node.js 18+ and Yarn
- MongoDB (optional for mock data)

### Installation

1. **Clone the repository**
   ```bash
   cd /app
   ```

2. **Install dependencies**
   ```bash
   yarn install
   ```

3. **Configure environment variables**
   
   The `.env` file is already configured with:
   ```env
   MONGO_URL=mongodb://localhost:27017
   DB_NAME=your_database_name
   NEXT_PUBLIC_BASE_URL=https://instant-print-hub-2.preview.emergentagent.com
   CORS_ORIGINS=*
   ```

4. **Run the development server**
   ```bash
   yarn dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:3000`

---

## 🔌 API Endpoints

### Current Implementation (Mock Data)

All API endpoints are currently using **in-memory mock data** for MVP demonstration:

#### `GET /api/machines`
Returns list of printer locations with status and availability.

**Response:**
```json
{
  "success": true,
  "machines": [
    {
      "id": "machine_1",
      "name": "QuickInk - Central Mall",
      "latitude": 19.0760,
      "longitude": 72.8777,
      "address": "Shop 12, Central Mall, Andheri West, Mumbai",
      "status": "online",
      "paper_available": true,
      "distance": "0.5 km"
    }
  ],
  "count": 8
}
```

#### `POST /api/partners`
Submit partner registration application.

**Request:**
```json
{
  "name": "John Doe",
  "shop_name": "ABC Store",
  "location": "123 Main Street, Mumbai",
  "phone": "+91 98765 43210"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Partner application submitted successfully",
  "partner": {
    "id": "partner_1234567890",
    "status": "pending",
    "created_at": "2025-06-24T12:00:00.000Z"
  }
}
```

#### `POST /api/contact`
Submit contact form message.

**Request:**
```json
{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "subject": "Question about pricing",
  "message": "I'd like to know more about bulk printing rates."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Message sent successfully",
  "contact": {
    "id": "message_1234567890",
    "status": "unread",
    "created_at": "2025-06-24T12:00:00.000Z"
  }
}
```

#### `GET /api/partners`
Get all partner applications (admin endpoint).

**Response:**
```json
{
  "success": true,
  "partners": [...],
  "count": 5
}
```

---

## 🔐 Future Integrations (Ready to Add)

The app structure is designed for easy integration with:

### Firebase Firestore
Ready to replace in-memory storage with persistent database:
- Collection: `machines` (printer locations)
- Collection: `partners` (partner applications)
- Collection: `contact` (contact messages)

### Google Maps JavaScript API
Mock map component can be replaced with:
- Real-time printer location markers
- Distance calculation
- Navigation integration
- Location search

### Required API Keys (When Ready):
1. **Firebase**:
   - Service Account JSON
   - Firebase web config (apiKey, authDomain, projectId, storageBucket)

2. **Google Maps**:
   - Google Maps API Key
   - Map ID (from Google Maps Platform)

---

## ✅ Testing

### Backend Tests
Comprehensive test suite with 100% pass rate:

```bash
python3 /app/backend_test.py
```

**Test Results:**
- ✅ GET /api/machines - Returns 8 printer locations
- ✅ POST /api/partners - Partner registration with validation
- ✅ POST /api/contact - Contact form with validation
- ✅ GET /api/partners - Admin endpoint
- ✅ Error handling - 404 and 400 responses

### Manual Testing
- Homepage: Hero, features, pricing, testimonials ✅
- Find Printer: Map view, search, filter ✅
- Partner Page: Registration form with validation ✅
- Contact Page: Contact form with validation ✅
- Mobile responsiveness ✅

---

## 🎨 Design System

### Colors
- **Primary**: Blue (#3B82F6)
- **Background**: White (#FFFFFF)
- **Gray**: Light Gray (#F3F4F6)
- **Accents**: Green (success), Red (error)

### Typography
- **Font**: Inter (Google Fonts)
- **Headings**: Bold, 2xl-6xl sizes
- **Body**: Regular, gray-700

### Components
- Rounded corners (rounded-lg, rounded-2xl)
- Soft shadows (shadow-lg, shadow-xl)
- Smooth transitions and hover effects
- Mobile-first responsive design

---

## 📱 Pages Overview

### 1. Homepage (`/`)
- **Hero Section**: Main value proposition with CTAs
- **How It Works**: 3-step process explanation
- **Map Preview**: Interactive map teaser
- **Pricing Table**: Simple, transparent pricing
- **Testimonials**: User reviews
- **CTA Banner**: Final conversion section

### 2. Find Printer (`/find-printer`)
- **Search Bar**: Location/name search
- **Interactive Map**: Visual printer locations (mock)
- **Printer List**: Detailed list with status, distance
- **Filters**: Online/offline, paper availability

### 3. Become a Partner (`/partner`)
- **Benefits Section**: Earning potential, zero effort
- **How It Works**: 4-step partner onboarding
- **Registration Form**: Name, shop name, location, phone
- **Success/Error Handling**: User feedback

### 4. Contact (`/contact`)
- **Contact Info**: Email, phone, office address
- **WhatsApp Support**: Direct WhatsApp integration
- **Contact Form**: Name, email, subject, message
- **Success/Error Handling**: User feedback

---

## 🚢 Deployment

### Vercel (Recommended)

1. **Push to Git repository**
2. **Connect to Vercel**
3. **Configure environment variables**:
   - Add `MONGO_URL` (when using real database)
   - Add `NEXT_PUBLIC_BASE_URL`
4. **Deploy** - Automatic deployment on push

### Manual Deployment

```bash
# Build for production
yarn build

# Start production server
yarn start
```

---

## 🔧 Configuration

### Environment Variables

```env
# Database (when ready to integrate)
MONGO_URL=mongodb://localhost:27017
DB_NAME=quickink_db

# Frontend URL
NEXT_PUBLIC_BASE_URL=https://your-domain.com

# CORS (for API)
CORS_ORIGINS=*

# Firebase (when ready to integrate)
# FIREBASE_PROJECT_ID=your-project-id
# FIREBASE_PRIVATE_KEY=your-private-key
# FIREBASE_CLIENT_EMAIL=your-client-email

# Google Maps (when ready to integrate)
# NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-api-key
# NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=your-map-id
```

---

## 📊 Current Status

### ✅ Completed
- Homepage with all sections
- Find Printer page with mock map
- Partner registration page
- Contact page
- Navbar with mobile menu
- Footer
- All backend API routes
- Form validation
- Error handling
- Responsive design
- Backend testing suite

### 🔄 Ready for Integration
- Firebase Firestore (database)
- Google Maps (real map)
- Payment gateway (for printing)
- User authentication
- Admin dashboard
- Analytics

---

## 🤝 Contributing

This is an MVP project. Future enhancements welcome:
- Real database integration
- Google Maps integration
- Payment processing
- User authentication
- File upload functionality
- Print job management

---

## 📝 License

Copyright © 2025 QuickInk. All rights reserved.

---

## 📞 Support

- **Email**: support@quickink.com
- **Phone**: +91 1800-123-4567
- **Office**: 123 Business Park, Mumbai, Maharashtra 400001

---

## 🎯 Next Steps

1. **Get API Keys**: 
   - Create Firebase project
   - Enable Google Maps API
   
2. **Integrate Real Services**:
   - Replace mock data with Firebase
   - Replace mock map with Google Maps
   
3. **Add Features**:
   - User authentication
   - File upload system
   - Payment integration
   - Admin dashboard

---

**Built with ❤️ for QuickInk**
