# Sequential Matching Implementation for Tables 2-4

## Problem
Tables 2, 3, and 4 have **identical headers**: `['CLASS', 'Dist. Spirits', 'Cases']`

Without sequential tracking, all three would match the first pattern (Table 2).

## Solution Implemented

### 1. TypeScript Config (`nabca-template-config.ts`) ✅ DONE
Added `sequenceGroup` field to tables 2, 3, 4:
```typescript
sequenceGroup: 'category_performance'
```

### 2. Python Code Generator Changes Needed

**Location**: `/src/lib/pipelines/code-generator.ts` around line 1008-1040

**Change 1: Initialize tracking before table loop**
```python
# Track assigned entities (for sequential matching of identical patterns)
assigned_entities = set()

# Identify and extract data from each table
for table_idx, table in enumerate(tables):
```

**Change 2: Pass assigned entities to identification function**
```python
# Line ~1017
identified_pattern = identify_nabca_table(table_data, table_patterns, assigned_entities, context)
```

**Change 3: Track assigned entity after identification**
```python
# Line ~1023 (after getting entity_name)
entity_name = identified_pattern['entityName']
table_name = identified_pattern['tableName']
confidence = identified_pattern.get('confidence', 0)

# Add to assigned set for sequential tracking
assigned_entities.add(entity_name)

context.log.info(f"✅ Table {table_idx + 1}: Identified as '{table_name}' → {entity_name} (confidence: {confidence:.2f})")
```

**Change 4: Update identify_nabca_table function signature**
```python
# Line ~1096
def identify_nabca_table(table_data: List[List[str]], patterns: List[Dict], assigned_entities: Set[str], context) -> Optional[Dict]:
    """
    Identify which NABCA table this is based on header matching.
    Handles sequential matching for patterns with identical headers.
    """
    from difflib import SequenceMatcher

    best_match = None
    best_score = 0.0

    for pattern in patterns:
        # SEQUENTIAL MATCHING LOGIC: Skip if entity already assigned and belongs to sequence group
        entity_name = pattern.get('entityName')
        sequence_group = pattern.get('sequenceGroup')

        if sequence_group and entity_name in assigned_entities:
            # This entity was already matched, skip to next in sequence
            context.log.debug(f"Skipping {entity_name} (already assigned in sequence group '{sequence_group}')")
            continue

        # ... rest of existing logic
```

## How It Works

1. **First table with CLASS/Dist. Spirits/Cases headers** → Matches Table 2 → Added to `assigned_entities`
2. **Second table with same headers** → Table 2 skipped (already assigned) → Matches Table 3
3. **Third table with same headers** → Tables 2 & 3 skipped → Matches Table 4

## Testing

After regenerating the pipeline:
1. Tables will be identified in order of appearance
2. Logs will show "Skipping raw_nabca_table_X (already assigned...)" for tables 2-4
3. All 8 tables will be correctly routed to their respective entities

## Status

- ✅ TypeScript config updated with `sequenceGroup`
- ⏳ Python code generator needs updates
- ⏳ Need to regenerate pipeline code

**Next step**: Delete existing pipeline deployment and click "Generate Code" to create new version with these changes.
