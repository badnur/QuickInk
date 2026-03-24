# QuickInk Backend System - Complete Guide

## 🚀 Overview

Complete backend system for QuickInk self-service printing kiosks platform built with:
- **Supabase** - PostgreSQL database, Authentication, and File Storage
- **Next.js 14** - API Routes with App Router
- **TypeScript** - Type-safe API development
- **QR Code Generation** - For print job identification

---

## 📁 Project Structure

```
/app
├── lib/
│   └── supabase/
│       ├── client.ts           # Client-side Supabase client
│       ├── server.ts           # Server-side Supabase client
│       └── schema.sql          # Complete database schema
├── app/
│   └── api/
│       ├── partners/
│       │   └── route.ts        # Partner registration endpoints
│       ├── machines/
│       │   ├── route.ts        # Get all machines
│       │   └── [id]/route.ts   # Update machine (admin)
│       ├── upload/
│       │   └── route.ts        # File upload + print job creation
│       └── jobs/
│           ├── route.ts        # Get all jobs
│           ├── [id]/route.ts   # Get job by ID
│           └── [id]/update/
│               └── route.ts    # Update job status (admin)
└── .env.local                  # Environment variables
```

---

## 🔧 Setup Instructions

### 1. Database Setup

1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/xhzfrmpbhasnipirccnt/sql)
2. Open SQL Editor
3. Copy and paste the entire content from `/app/lib/supabase/schema.sql`
4. Run the SQL script
5. Verify tables are created:
   - `machines`
   - `partners`
   - `print_jobs`

### 2. Storage Bucket Setup

1. Go to [Supabase Storage](https://supabase.com/dashboard/project/xhzfrmpbhasnipirccnt/storage/buckets)
2. Click "New Bucket"
3. **Bucket name**: `print-files`
4. **Public bucket**: ✅ Yes (checked)
5. **File size limit**: 10 MB
6. **Allowed MIME types**: 
   - `application/pdf`
   - `image/*`
   - `application/msword`
   - `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
7. Click "Create bucket"

### 3. Environment Variables

Environment variables are already configured in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xhzfrmpbhasnipirccnt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[your-anon-key]
SUPABASE_SERVICE_ROLE_KEY=[your-service-role-key]
```

✅ **Already configured** - No action needed!

### 4. Dependencies

Already installed:
- `@supabase/supabase-js` - Supabase client
- `qrcode` - QR code generation
- `@types/qrcode` - TypeScript types

---

## 📊 Database Schema

### Tables

#### 1. **machines**
Stores printing kiosk/machine information.

```sql
{
  id: UUID (primary key)
  name: TEXT
  address: TEXT
  latitude: DECIMAL
  longitude: DECIMAL
  status: TEXT ('online' | 'offline' | 'maintenance')
  paper_available: BOOLEAN
  distance: TEXT
  created_at: TIMESTAMP
  updated_at: TIMESTAMP
}
```

#### 2. **partners**
Stores partner registration applications.

```sql
{
  id: UUID (primary key)
  name: TEXT
  shop_name: TEXT
  location: TEXT
  phone: TEXT
  status: TEXT ('pending' | 'approved' | 'rejected')
  created_at: TIMESTAMP
  updated_at: TIMESTAMP
}
```

#### 3. **print_jobs**
Stores print job details with file URLs and QR codes.

```sql
{
  id: UUID (primary key)
  file_url: TEXT
  file_name: TEXT
  file_size: INTEGER
  file_type: TEXT
  qr_code: TEXT (data URL)
  qr_data: TEXT (JSON string)
  status: TEXT ('pending' | 'processing' | 'ready' | 'printed' | 'cancelled')
  pages: INTEGER
  price: DECIMAL
  color_mode: TEXT ('bw' | 'color')
  machine_id: UUID (foreign key to machines)
  created_at: TIMESTAMP
  updated_at: TIMESTAMP
}
```

---

## 🔌 API Endpoints

### Public Endpoints (No Authentication Required)

#### 1. Create Partner Registration
```http
POST /api/partners
Content-Type: application/json

{
  "name": "Rahman Ahmed",
  "shop_name": "Rahman Store",
  "location": "House 23, Road 5, Dhanmondi, Dhaka",
  "phone": "01712-345678"
}

Response (201):
{
  "success": true,
  "message": "Partner registration submitted successfully",
  "partner": {
    "id": "uuid",
    "name": "Rahman Ahmed",
    "shop_name": "Rahman Store",
    "status": "pending",
    ...
  }
}
```

#### 2. Get All Machines
```http
GET /api/machines?status=online&limit=10

Response (200):
{
  "success": true,
  "machines": [
    {
      "id": "uuid",
      "name": "QuickInk - Dhanmondi",
      "address": "House 23, Road 5, Dhanmondi",
      "status": "online",
      "paper_available": true,
      ...
    }
  ],
  "count": 5
}
```

#### 3. Upload File & Create Print Job
```http
POST /api/upload
Content-Type: multipart/form-data

FormData:
  - file: [PDF/Image/Word file]
  - color_mode: "bw" | "color" (optional, default: "bw")
  - pages: number (optional, default: 1)

Response (201):
{
  "success": true,
  "message": "File uploaded and print job created successfully",
  "job": {
    "id": "uuid",
    "file_name": "document.pdf",
    "file_url": "https://[supabase-url]/storage/v1/object/public/print-files/...",
    "qr_code": "data:image/png;base64,...",
    "status": "pending",
    "pages": 10,
    "price": 20,
    "color_mode": "bw",
    "created_at": "2025-06-24T10:00:00Z"
  }
}
```

#### 4. Get Print Job by ID
```http
GET /api/jobs/{job-id}

Response (200):
{
  "success": true,
  "job": {
    "id": "uuid",
    "file_url": "https://...",
    "qr_code": "data:image/png;base64,...",
    "status": "pending",
    ...
  }
}
```

#### 5. Get All Print Jobs
```http
GET /api/jobs?status=pending&limit=20

Response (200):
{
  "success": true,
  "jobs": [...],
  "count": 15
}
```

#### 6. Get All Partners
```http
GET /api/partners

Response (200):
{
  "success": true,
  "partners": [...],
  "count": 10
}
```

---

### Admin Endpoints (Require Service Role Key)

All admin endpoints require the service role key in the Authorization header:

```http
Authorization: Bearer [SUPABASE_SERVICE_ROLE_KEY]
```

#### 7. Update Machine Status
```http
PATCH /api/machines/{machine-id}
Authorization: Bearer [service-role-key]
Content-Type: application/json

{
  "status": "offline",
  "paper_available": false
}

Response (200):
{
  "success": true,
  "message": "Machine updated successfully",
  "machine": {...}
}
```

#### 8. Update Print Job Status
```http
PATCH /api/jobs/{job-id}/update
Authorization: Bearer [service-role-key]
Content-Type: application/json

{
  "status": "printed",
  "machine_id": "machine-uuid"
}

Response (200):
{
  "success": true,
  "message": "Print job updated successfully",
  "job": {...}
}
```

---

## 🔒 Security

### Row Level Security (RLS)

All tables have RLS enabled with the following policies:

**machines:**
- ✅ Anyone can SELECT (view)
- 🔐 Only service_role can INSERT/UPDATE

**partners:**
- ✅ Anyone can INSERT (register)
- ✅ Anyone can SELECT (view)
- 🔐 Only service_role can UPDATE

**print_jobs:**
- ✅ Anyone can INSERT (create job)
- ✅ Anyone can SELECT (view job)
- 🔐 Only service_role can UPDATE

### Admin Authentication

Admin routes check for service_role key in request headers:

```typescript
const authHeader = request.headers.get('authorization')
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!authHeader || !authHeader.includes(serviceRoleKey)) {
  return 401 Unauthorized
}
```

---

## 📤 File Upload Flow

1. **Client uploads file** via `/api/upload`
2. **Server validates** file type and size
3. **File uploaded** to Supabase Storage (`print-files` bucket)
4. **Get public URL** from storage
5. **Generate QR code** containing job details
6. **Create database record** in `print_jobs` table
7. **Return job details** including QR code to client

### QR Code Data Structure

```json
{
  "jobId": "QK-123456",
  "fileUrl": "https://[supabase-storage]/path/to/file.pdf",
  "pages": 10,
  "colorMode": "bw"
}
```

---

## 🧪 Testing

### Test with cURL

**1. Create Partner:**
```bash
curl -X POST https://instant-print-hub-2.preview.emergentagent.com/api/partners \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "shop_name": "Test Shop",
    "location": "Test Location, Dhaka",
    "phone": "01712345678"
  }'
```

**2. Get Machines:**
```bash
curl https://instant-print-hub-2.preview.emergentagent.com/api/machines
```

**3. Upload File:**
```bash
curl -X POST https://instant-print-hub-2.preview.emergentagent.com/api/upload \
  -F "file=@document.pdf" \
  -F "color_mode=bw" \
  -F "pages=5"
```

**4. Update Machine (Admin):**
```bash
curl -X PATCH https://instant-print-hub-2.preview.emergentagent.com/api/machines/{id} \
  -H "Authorization: Bearer [service-role-key]" \
  -H "Content-Type: application/json" \
  -d '{"status": "offline"}'
```

---

## 🎯 Pricing Logic

Implemented in `/api/upload`:

```typescript
const pricePerPage = colorMode === 'color' ? 10 : 2  // BDT
const totalPrice = pages * pricePerPage

// Examples:
// 5 pages B&W = 5 × ৳2 = ৳10
// 3 pages Color = 3 × ৳10 = ৳30
```

---

## 📝 Error Handling

All endpoints return consistent error format:

```json
{
  "error": "Error message",
  "details": "Detailed error information"
}
```

**Common Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (admin endpoints)
- `404` - Not Found
- `500` - Internal Server Error

---

## 🚀 Deployment Checklist

- [x] Database schema created in Supabase
- [x] Storage bucket configured
- [x] RLS policies enabled
- [x] Environment variables set
- [x] All API routes implemented
- [x] QR code generation working
- [x] File upload functional
- [x] Admin authentication secured

---

## 📚 Additional Resources

- [Supabase Dashboard](https://supabase.com/dashboard/project/xhzfrmpbhasnipirccnt)
- [Supabase Docs](https://supabase.com/docs)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [QRCode.js](https://github.com/soldair/node-qrcode)

---

## 🆘 Troubleshooting

### Issue: "Failed to upload file"
- Check storage bucket exists and is public
- Verify file size is under 10MB
- Ensure allowed MIME types include your file type

### Issue: "Unauthorized" on admin routes
- Verify `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`
- Ensure Authorization header is correctly formatted
- Check the key matches your Supabase project

### Issue: "Failed to create print job"
- Check database connection
- Verify `print_jobs` table exists
- Check RLS policies allow INSERT

---

**Built with ❤️ for QuickInk Bangladesh**
