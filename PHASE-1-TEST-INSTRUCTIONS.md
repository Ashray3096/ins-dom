# Phase 1 Testing Instructions

## ✅ What We Just Built

- **Database Tables**: `field_library` and `template_fields`
- **TypeScript Types**: `/src/types/field-library.ts`
- **API Routes**:
  - `GET /api/fields` - List fields
  - `POST /api/fields` - Create field
  - `GET /api/fields/[id]` - Get field by ID
  - `PUT /api/fields/[id]` - Update field
  - `DELETE /api/fields/[id]` - Delete/deprecate field
- **UI Page**: `/dashboard/fields` - Full CRUD interface
- **Navigation**: Added "Fields" link to sidebar

---

## 🧪 Test Steps

### Step 1: Check Development Server

Make sure your dev server is running. If not:
```bash
npm run dev
```

Wait for build to complete (should take ~30 seconds).

### Step 2: Navigate to Fields Page

1. Open browser: `http://localhost:3000`
2. Log in (if needed)
3. Look at left sidebar
4. Click **"Fields"** (should be between Templates and Entities)

### Step 3: Verify Empty State

You should see:
- Page title: "Field Library"
- Description: "Reusable field definitions for templates and entities"
- **"Create Field"** button in top right
- Search bar and filters
- Empty state message: "No fields found - Create your first field to get started"

### Step 4: Create Your First Field

Click **"Create Field"** button. A modal should open.

Fill in these test values:

```
Name: vendor_name
Label: Vendor Name
Description: Company/vendor supplying products
Field Type: TEXT
Category: vendor
Classification: INTERNAL
Tags: vendor, supplier, company
Transformations: trim, uppercase
```

Click **"Create Field"** button.

**Expected result:**
- Success toast: "Field created successfully!"
- Modal closes
- Field appears in the list

### Step 5: Verify Field Display

You should see your field in the list with:
- ✅ Name in monospace font: `vendor_name`
- ✅ Badges:
  - Blue badge: "TEXT"
  - Blue badge: "INTERNAL"
  - Gray outline: "vendor"
- ✅ Label: "Vendor Name"
- ✅ Description: "Company/vendor supplying products"
- ✅ Transformations: "trim, uppercase"
- ✅ Tags: vendor, supplier, company (as gray chips)
- ✅ Delete button (trash icon)

### Step 6: Create More Test Fields

Create these additional fields to test variety:

**Field 2: sales_l12m**
```
Name: sales_l12m
Label: Sales (L12M)
Description: Sales for last 12 months
Field Type: NUMBER
Category: sales
Classification: CONFIDENTIAL
Tags: sales, revenue
Transformations: remove_commas, parse_number
```

**Field 3: report_date**
```
Name: report_date
Label: Report Date
Description: Date of the report
Field Type: DATE
Category: date
Classification: PUBLIC
Tags: date, report
```

**Expected result:** You should have 3 fields now.

### Step 7: Test Search

1. Type "vendor" in the search box
2. Click **"Search"**
3. Should show only `vendor_name` field

### Step 8: Test Category Filter

1. Clear search box
2. Select "sales" from Category dropdown
3. Click **"Search"**
4. Should show only `sales_l12m` field

### Step 9: Test Delete (Edge Case)

1. Try to delete `vendor_name` field
2. Click trash icon
3. Confirm deletion
4. **Expected**: Field should be deleted (we haven't used it in templates yet)

### Step 10: Check API Directly (Optional)

Open browser dev tools → Network tab

1. Create another field
2. Look at Network tab
3. Should see `POST /api/fields` with 201 status
4. Response should contain your field data

---

## ✅ Success Criteria

After testing, you should have:

- [x] Fields page loads without errors
- [x] Can create fields via modal
- [x] Fields display correctly with badges
- [x] Search works
- [x] Category filter works
- [x] Type filter works
- [x] Delete works
- [x] Field validation (try creating duplicate name - should fail)
- [x] No console errors

---

## ❌ Common Issues & Solutions

### Issue: "Unauthorized" error
**Solution**: Make sure you're logged in. Check Supabase auth status.

### Issue: Fields page shows blank/white screen
**Solution**:
1. Check browser console for errors
2. Check if `field_library` table exists in Supabase
3. Check API route file paths are correct

### Issue: "Failed to create field" error
**Solution:**
1. Check field name is snake_case (lowercase with underscores)
2. Check field name doesn't already exist
3. Check Supabase RLS policies are enabled

### Issue: Modal doesn't close after creating field
**Solution:** This is likely a success! Check if field appears in list below.

### Issue: Navigation doesn't show "Fields" link
**Solution:** Hard refresh browser (Cmd+Shift+R or Ctrl+Shift+R)

---

## 📸 What You Should See (Screenshots Reference)

**Empty State:**
```
┌─────────────────────────────────────────┐
│ Field Library      [Refresh] [Create]   │
├─────────────────────────────────────────┤
│ Reusable field definitions...           │
│                                          │
│ [Search box] [Category▼] [Type▼]        │
│                                          │
│         No fields found                  │
│   Create your first field to get started│
└─────────────────────────────────────────┘
```

**With Fields:**
```
┌─────────────────────────────────────────┐
│ Fields (3)                               │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │ vendor_name [TEXT] [INTERNAL] [vendor] [🗑] │
│ │ Vendor Name                          │ │
│ │ Company/vendor supplying products    │ │
│ │ Transformations: trim, uppercase     │ │
│ │ [vendor] [supplier] [company]        │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ sales_l12m [NUMBER] [CONFIDENTIAL] [sales] [🗑] │
│ │ Sales (L12M)                         │ │
│ │ Sales for last 12 months             │ │
│ │ Transformations: remove_commas, ...  │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

---

## 🎯 After Testing

**Please confirm:**

1. ✅ I can see the Fields page
2. ✅ I can create fields
3. ✅ Fields display correctly
4. ✅ Search/filters work
5. ✅ No errors in console

**Reply with:** "Phase 1 complete - tested successfully" or paste any errors you encounter.

Once confirmed, we'll move to **Phase 2: Universal Template Wizard** where you'll use these fields!
