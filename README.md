# Google Apps Script to Vercel, Supabase & GitHub Migration Guide

This project provides the complete architecture and starter template to migrate your Google Apps Script project into a modern, production-grade cloud stack:
- **Database & Backend:** [Supabase](https://supabase.com) (PostgreSQL, Realtime, Auth, Storage)
- **Frontend Hosting:** [Vercel](https://vercel.com) (Global CDN, Serverless Edge, Instant Preview Deployments)
- **Source Control & CI/CD:** [GitHub](https://github.com) (Automated deployments on git push)

---

## 📑 Migration Blueprint & Steps

### Step 1: Exporting Code & Data from Google Apps Script

Because Google Apps Script projects are secured inside your Google account:
1. Open your Apps Script Project: [Apps Script Editor](https://script.google.com/u/0/home/projects/12osDaWbrX3QZ6CN5dvckvC_JoZ8qIg0k-OA4GAKzraX5c_isIdq2A1WE/edit)
2. **Export Your Code:**
   - Copy your `Code.gs` logic (or any `.gs` files).
   - Copy any `.html` files (e.g., `Index.html`, modals, forms).
3. **Export Your Google Sheets Data:**
   - Open the linked Google Sheet.
   - Go to **File &rarr; Download &rarr; Comma Separated Values (.csv)**.
   - Save the `.csv` file locally.

---

### Step 2: Supabase Setup & Schema Creation

1. Go to [database.new](https://database.new) or [Supabase Dashboard](https://supabase.com/dashboard) and create a new project.
2. Open the **SQL Editor** tab from the left sidebar.
3. Open `supabase-schema.sql` in this repo, copy its contents, paste it into the Supabase SQL editor, and click **Run**.
4. Adjust table columns to match your Google Sheet headers if needed.
5. In **Project Settings &rarr; API**, copy:
   - **Project URL** (`https://<project-ref>.supabase.co`)
   - **anon / public key**

---

### Step 3: Data Migration from Google Sheets to Supabase

You have two convenient methods:

#### Method A: Using the built-in CSV Migrator (Easiest)
1. Open `migrate-csv-to-supabase.html` in your browser.
2. Enter your Supabase URL & anon key.
3. Drag & drop the `.csv` file you exported in Step 1.
4. Click **Start Migration to Supabase** to batch-insert your rows directly into PostgreSQL.

#### Method B: Native Supabase CSV Import
1. In your Supabase Dashboard, click **Table Editor &rarr; [your table]**.
2. Click **Insert &rarr; Import data from CSV**.
3. Select your `.csv` file and map the columns.

---

### Step 4: Code Modernization (Replacing GAS APIs)

| Google Apps Script API | Modern Web Equivalent (Supabase / JS) |
|---|---|
| `SpreadsheetApp.getActiveSpreadsheet().getSheetByName(...)` | `supabase.from('records').select('*')` |
| `sheet.appendRow([...])` | `supabase.from('records').insert([...])` |
| `sheet.getRange(row, col).setValue(...)` | `supabase.from('records').update({...}).eq('id', id)` |
| `sheet.deleteRow(row)` | `supabase.from('records').delete().eq('id', id)` |
| `google.script.run.withSuccessHandler(...)` | Native `async / await` JavaScript fetch / Supabase SDK |
| `DriveApp.createFile(...)` | `supabase.storage.from('bucket').upload(...)` |
| `MailApp.sendEmail(...)` | Resend API / SendGrid or Supabase Auth Emails |

---

### Step 5: Connect to GitHub

1. Initialize git and commit:
   ```bash
   git add .
   git commit -m "Migrate Google Apps Script to modern web stack"
   ```
2. Create a new repository on [GitHub](https://github.com/new).
3. Link the remote and push:
   ```bash
   git remote add origin https://github.com/<your-username>/<your-repo-name>.git
   git branch -M main
   git push -u origin main
   ```

---

### Step 6: Deploy to Vercel

1. Log in to [Vercel](https://vercel.com).
2. Click **Add New... &rarr; Project**.
3. Select your GitHub repository.
4. Under **Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://<project-ref>.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `your-anon-key`
5. Click **Deploy**!
6. Every time you push a commit to GitHub, Vercel will automatically build and deploy your site with zero downtime.
