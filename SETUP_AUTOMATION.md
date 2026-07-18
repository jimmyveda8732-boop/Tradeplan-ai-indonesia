# Setup Automation TradePlan AI Indonesia

## 1. Buat project Supabase
- Buat project baru di Supabase.
- Salin URL project dan service role key.

## 2. Jalankan SQL schema
- Buka Supabase SQL Editor.
- Jalankan isi file [supabase/schema.sql](supabase/schema.sql).

## 3. Tambahkan environment variables
Tambahkan variabel berikut di environment server aplikasi dan Vercel:
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- GEMINI_API_KEY
- CRON_SECRET

Jangan menulis nilai rahasia asli di repository.

## 4. Deploy production
- Deploy aplikasi ke Vercel.
- Pastikan environment variables sama tersedia di production.

## 5. Periksa Vercel Cron Logs
- Buka tab Functions atau Logs di Vercel.
- Cek eksekusi cron pada endpoint /api/cron/daily-plan.

## 6. Uji endpoint secara aman
- Uji endpoint cron dengan header Authorization Bearer dan CRON_SECRET yang benar.
- Hindari mengekspos secret di browser atau log publik.
