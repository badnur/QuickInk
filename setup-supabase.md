# QuickInk Supabase Setup Guide

## 🚀 Quick Setup (5 Minutes)

Follow these steps to get your backend running:

---

## Step 1: Create Database Tables

1. Open [Supabase SQL Editor](https://supabase.com/dashboard/project/xhzfrmpbhasnipirccnt/sql/new)

2. Click "New Query"

3. Copy the ENTIRE content from `/app/lib/supabase/schema.sql`

4. Paste into the SQL Editor

5. Click **"Run"** (or press Ctrl/Cmd + Enter)

6. ✅ Verify Success: You should see "Success. No rows returned"

7. Check tables created:
   - Go to [Table Editor](https://supabase.com/dashboard/project/xhzfrmpbhasnipirccnt/editor)
   - You should see:
     - ✅ **machines** table
     - ✅ **partners** table
     - ✅ **print_jobs** table

---

## Step 2: Create Storage Bucket

1. Go to [Storage](https://supabase.com/dashboard/project/xhzfrmpbhasnipirccnt/storage/buckets)

2. Click **"New Bucket"**

3. Fill in:
   ```
   Bucket name: print-files
   Public bucket: ✅ (CHECKED)
   File size limit: 10240 KB (10 MB)
   Allowed MIME types: 
     - application/pdf
     - image/jpeg
     - image/png
     - application/msword
     - application/vnd.openxmlformats-officedocument.wordprocessingml.document
   ```

4. Click **"Create bucket"**

5. ✅ Verify: You should see `print-files` in your buckets list

---

## Step 3: Verify Environment Variables

Open `/app/.env.local` and verify these are set:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xhzfrmpbhasnipirccnt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

✅ **Already configured!** No action needed.

---

## Step 4: Test the Backend

### Test 1: Get Machines (Should return empty or seed data)
```bash
curl https://instant-print-hub-2.preview.emergentagent.com/api/machines
```

**Expected Response:**
```json
{
  "success": true,
  "machines": [...],
  "count": 5
}
```

### Test 2: Create Partner Registration
```bash
curl -X POST https://instant-print-hub-2.preview.emergentagent.com/api/partners \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Rahman",
    "shop_name": "Test Shop",
    "location": "Dhanmondi, Dhaka",
    "phone": "01712345678"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Partner registration submitted successfully",
  "partner": {
    "id": "...",
    "status": "pending",
    ...
  }
}
```

### Test 3: Upload File (Create a test PDF first)
```bash
# Create a simple test file
echo "Test document" > test.txt

# Upload it
curl -X POST https://instant-print-hub-2.preview.emergentagent.com/api/upload \
  -F "file=@test.txt" \
  -F "pages=1" \
  -F "color_mode=bw"
```

**Expected Response:**
```json
{
  "success": true,
  "job": {
    "id": "...",
    "qr_code": "data:image/png;base64,...",
    "price": 2,
    ...
  }
}
```

---

## 🎯 Success Indicators

✅ **Backend is ready when:**
1. Database tables exist
2. Storage bucket is created
3. All 3 test API calls return success
4. QR code is generated in upload response

---

## 🆘 Troubleshooting

### Error: "relation 'machines' does not exist"
**Fix:** Run the SQL schema again in Step 1

### Error: "The bucket print-files does not exist"
**Fix:** Create the storage bucket in Step 2

### Error: "Failed to fetch"
**Fix:** Check if Next.js server is running (`yarn dev`)

### Error: "Unauthorized"
**Fix:** Verify environment variables are set correctly

---

## 📝 Next Steps

After setup is complete:

1. ✅ Test all API endpoints
2. 📱 Build frontend upload form
3. 🎨 Display QR codes to users
4. 🔐 Implement admin dashboard
5. 🚀 Deploy to production

---

## 🔗 Useful Links

- [Supabase Dashboard](https://supabase.com/dashboard/project/xhzfrmpbhasnipirccnt)
- [SQL Editor](https://supabase.com/dashboard/project/xhzfrmpbhasnipirccnt/sql)
- [Table Editor](https://supabase.com/dashboard/project/xhzfrmpbhasnipirccnt/editor)
- [Storage](https://supabase.com/dashboard/project/xhzfrmpbhasnipirccnt/storage/buckets)
- [API Logs](https://supabase.com/dashboard/project/xhzfrmpbhasnipirccnt/logs/edge-logs)

---

**Setup Time: ~5 minutes**  
**Difficulty: Easy** 🟢
