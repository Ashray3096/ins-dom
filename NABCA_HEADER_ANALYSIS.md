# NABCA Table Header Analysis - Required Pattern Updates

## Analysis from `sample_all_tables_results.json`

### TABLE 1: Brand Leaders
**Actual Headers (Row 3):**
```
['BRAND', 'Type', 'Rank', '% Total', 'Case Sales', '+ or Last Year', 'Case Sales', '+ or Last Year', 'Case Sales Last Twelve Months']
```

**Issues with Current Pattern:**
- ❌ `YTD Rank` → Should be `Rank`
- ✅ `BRAND` - Correct
- ✅ `Type` - Correct
- ✅ `Case Sales` - Correct (appears multiple times)

**Recommended Required Headers:**
```
['BRAND', 'Type', 'Rank', 'Case Sales']
```

---

### TABLE 2: Current Month Sales
**Actual Headers (Row 2):**
```
['CLASS', 'Dist. Spirits', 'Class', 'Cases', '1.75 L', '1.0 L', '750 ml', '750 ml Traveler', '375 ml', '200 ml']
```

**Issues with Current Pattern:**
- ❌ `% Total Dist. Spirits` → Should be `Dist. Spirits` (without "% Total")
- ❌ `Total Cases` → Should be just `Cases`
- ✅ `CLASS` - Correct

**Recommended Required Headers:**
```
['CLASS', 'Dist. Spirits', 'Cases']
```

---

### TABLE 3: YTD Sales
**Actual Headers (Row 2):**
```
['CLASS', 'Dist. Spirits', 'Class', 'Cases', '1.75 L', '1.0 L', '750 ml', '750 ml Traveler', '375 ml', '200 ml']
```

**Same as Table 2**

**Recommended Required Headers:**
```
['CLASS', 'Dist. Spirits', 'Cases']
```

---

### TABLE 4: Rolling 12-Month Sales
**Actual Headers (Row 2):**
```
['CLASS', 'Dist. Spirits', 'Class', 'Cases', '1.75 L', '1.0 L', '750 ml', '750 ml Traveler', '375 ml', '200 ml']
```

**Same as Tables 2 & 3**

**Recommended Required Headers:**
```
['CLASS', 'Dist. Spirits', 'Cases']
```

---

### TABLE 5: Brand Summary
**Actual Headers (Row 2):**
```
['Brand', 'Vendor', 'Last Twelve Months', 'Last Year to Date', '% of Type', 'Case Sales', 'Current Month', '1.75 L', '1.0 L', '750 ml']
```

**Row 1 Also Contains Headers:**
```
['Class & Type', 'Case Sales', 'Case Sales', 'This', 'Year to Date', 'Case Sales', 'Current', 'Month Sales', 'by Bottle', 'Sizes']
```

**Issues with Current Pattern:**
- ⚠️ Multi-row headers - need to handle both Row 1 and Row 2
- ✅ `Brand` - Correct (Row 2)
- ✅ `Vendor` - Correct (Row 2)
- ✅ `Case Sales` - Correct (appears in both rows)

**Recommended Required Headers (from Row 2):**
```
['Brand', 'Vendor', 'Case Sales']
```

---

### TABLE 6: Vendor Top 100
**Actual Headers (Row 2):**
```
['Vendor', 'Rank', 'Share of Market', 'Last 12 Months This Year', 'Last 12 Months Prior Year', '+ or', 'This Year to Date', 'Last Year to Date', '+ or', 'Current Month This Year']
```

**Issues with Current Pattern:**
- ❌ `L12M This Year` → Should be `Last 12 Months This Year` (NOT abbreviated!)
- ✅ `Vendor` - Correct
- ✅ `Rank` - Correct
- ✅ `Share of Market` - Correct

**Recommended Required Headers:**
```
['Vendor', 'Rank', 'Share of Market', 'Last 12 Months This Year']
```

---

### TABLE 7: Vendor Top 20 by Class
**Actual Headers (Row 1):**
```
['Class / Vendor', 'Rank', 'Share of Market', 'Last 12 Months This Year', 'Last 12 Months Prior Year', '+ or', 'This Year to Date', 'Last Year to Date', '+ or', 'Current Month This Year']
```

**Issues with Current Pattern:**
- Header is `Class / Vendor` not just `Vendor`
- Same issue with `L12M This Year` → `Last 12 Months This Year`

**Recommended Required Headers:**
```
['Class / Vendor', 'Rank', 'Share of Market', 'Last 12 Months This Year']
```

---

### TABLE 8: Control States
**Actual Headers (Row 2):**
```
['Vendor / Brand', 'Class', 'Last 12 Months This Year', 'Last 12 Months Prior Year', '% Change', 'This Year to Date', 'Last Year to Date', '% Change', 'Current Month This Year', 'Current Month Last Year']
```

**Issues with Current Pattern:**
- ❌ `L12M This Year` → Should be `Last 12 Months This Year`
- ❌ `YTD This Year` → Should be `This Year to Date`
- ✅ `Vendor / Brand` - Correct
- ✅ `Class` - Correct

**Recommended Required Headers:**
```
['Vendor / Brand', 'Class', 'Last 12 Months This Year', 'This Year to Date']
```

---

## Key Findings:

1. **NO ABBREVIATIONS**: Textract output has full text, not abbreviations
   - "L12M" appears as "Last 12 Months"
   - "YTD" appears as "Year to Date" or "This Year to Date"

2. **Headers NOT Always in Row 1**:
   - Tables 1-8 have headers in Row 2 or Row 3
   - Need position-agnostic scanning (already implemented ✅)

3. **Multi-Row Headers** (Table 5):
   - Some tables split headers across multiple rows
   - Need to handle compound headers

4. **Optional Headers Are Correct**:
   - Bottle sizes (1.75 L, 1.0 L, 750 ml, etc.) are correctly marked as optional

## Recommended Action:

Update `/src/lib/nabca-template-config.ts` with corrected requiredHeaders for all 8 tables.
