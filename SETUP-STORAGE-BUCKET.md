# Setup Supabase Storage Bucket

## The "Bucket Not Found" Error

You're getting this error because the `artifacts` bucket doesn't exist in your Supabase project yet.

## Step-by-Step: Create the Artifacts Bucket

### 1. Go to Supabase Dashboard

Navigate to: https://supabase.com/dashboard/project/YOUR_PROJECT_ID

### 2. Open Storage

Click on **Storage** in the left sidebar (the icon looks like a folder)

### 3. Create New Bucket

1. Click "**New bucket**" button (top right)
2. Fill in the form:
   ```
   Name: artifacts
   Public bucket: ☐ (leave UNCHECKED - private bucket)
   File size limit: 10 MB
   Allowed MIME types: (leave empty or add):
     - application/pdf
     - text/html
     - message/rfc822
     - application/json
   ```
3. Click "**Create bucket**"

### 4. Set Up RLS Policies

By default, the bucket has no access policies. You need to add Row Level Security (RLS) policies.

#### Option A: Using Supabase UI

1. Click on the `artifacts` bucket
2. Go to **Policies** tab
3. Click "**New policy**"

**Policy 1: Allow users to upload**
```
Policy name: Users can upload artifacts
Operation: INSERT
Target roles: authenticated

Policy definition:
(bucket_id = 'artifacts'::text)
```

**Policy 2: Allow users to read their own files**
```
Policy name: Users can read their artifacts
Operation: SELECT
Target roles: authenticated

Policy definition:
(bucket_id = 'artifacts'::text)
```

**Policy 3: Allow users to delete their own files**
```
Policy name: Users can delete their artifacts
Operation: DELETE
Target roles: authenticated

Policy definition:
(bucket_id = 'artifacts'::text)
```

#### Option B: Using SQL (More Precise)

Go to SQL Editor and run:

```sql
-- Policy for uploading (users can upload to any path)
CREATE POLICY "Users can upload artifacts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'artifacts'
);

-- Policy for reading (users can read from any path)
CREATE POLICY "Users can read artifacts"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'artifacts'
);

-- Policy for deleting (users can delete from any path)
CREATE POLICY "Users can delete artifacts"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'artifacts'
);

-- Policy for updating (users can update files)
CREATE POLICY "Users can update artifacts"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'artifacts'
)
WITH CHECK (
  bucket_id = 'artifacts'
);
```

## Test the Setup

After creating the bucket and policies:

1. Go to `/dashboard/artifacts` in your app
2. Select a provider
3. Upload a PDF file
4. You should see:
   - ✅ File uploads successfully
   - ✅ Appears in the list
   - ✅ No "bucket not found" error

## Verify in Supabase

1. Go to Supabase Dashboard → Storage → `artifacts` bucket
2. You should see your uploaded files organized by provider ID
3. Structure: `artifacts/{provider-id}/{timestamp}-{random}/{filename}.pdf`

## Troubleshooting

### Still getting "bucket not found"?
- Check bucket name is exactly `artifacts` (lowercase, no spaces)
- Refresh your browser to clear any cached errors
- Verify you're in the correct Supabase project

### Getting "permission denied"?
- Check RLS policies are created and enabled
- Verify you're logged in (check authentication)
- Check the policy definitions match the SQL above

### Files not appearing after upload?
- Check browser console for errors
- Verify the API call to `/api/upload` succeeded
- Check the `artifacts` table in your database has the record

## Next Steps

Once the bucket is working:

1. ✅ Upload files through `/dashboard/artifacts`
2. ⏭️ Create sources through `/dashboard/sources` (coming next)
3. ⏭️ Configure S3 sources with test mode
4. ⏭️ Build AI extraction workflow

## Summary

The correct flow is:

```
1. Providers → Create provider (NABCA, etc.)
2. Sources → Configure source (S3, URL, file_upload)
3. Artifacts → Upload files or sync from sources
4. Extract → Run AI extraction on artifacts
```

Without the storage bucket, step 3 fails. Once it's set up, everything should work!
