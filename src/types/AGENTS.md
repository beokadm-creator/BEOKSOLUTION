# TypeScript Schema Definitions - Firestore Models

**Purpose**: 4 files defining all Firestore document interfaces and shared TypeScript types for the eRegi platform.

## OVERVIEW

All Firestore document models are centralized in the `types/` directory. This is the **single source of truth** for data shapes across frontend, backend, and utilities. Never use `any` - always import from these schema definitions.

## STRUCTURE

```
types/
├── schema.ts              # ALL Firestore models (Conference, Registration, User, etc.)
├── society-extensions.ts  # Society-specific type extensions (grades, membership tiers)
├── conference.ts          # Conference-related complex types (agendas, speakers)
└── print.ts               # Badge/receipt print layout types
```

## WHERE TO LOOK

| Domain | File | Key Types |
|--------|------|-----------|
| **Firestore Core** | schema.ts | `Conference`, `Registration`, `User`, `Society`, `Member`, `Page`, `Agenda`, `Speaker` |
| **Society-Specific** | society-extensions.ts | `SocietyGrades`, `MemberTier`, `GradeConfig` |
| **Conference Data** | conference.ts | `AgendaItem`, `SpeakerData`, `SessionInfo` |
| **Print Layouts** | print.ts | `BadgeLayout`, `PrintConfig`, `Position` |

## CONVENTIONS

### Import Pattern
```typescript
// ✅ CORRECT - Always import from schema
import type { Conference, Registration, User } from '@/types/schema';

// ❌ WRONG - Never use 'any'
const data: any = await getDoc(docRef);

// ✅ CORRECT - Type assertion after fetch
const data = doc.data() as Conference;
```

### Timestamp Handling
```typescript
// ❌ WRONG - Never use Date for Firestore
interface Conference {
  startDate: Date;
}

// ✅ CORRECT - Always use Timestamp
import { Timestamp } from 'firebase/firestore';

interface Conference {
  startDate: Timestamp;
  endDate: Timestamp;
}
```

### Optional Fields
```typescript
// Use optional chaining for Firestore optional fields
const venueName = data.venue?.name || 'Unknown Venue';
```

## TYPE ANNOTATIONS

### Core Firestore Models (schema.ts)
- **Conference**: `confId`, `societyId`, `slug`, `info`, `settings`, `registrationSettings`
- **Registration**: `userId`, `confId`, `status`, `badgeQr`, `paymentStatus`, `memberCode`
- **User**: `uid`, `email`, `name`, `phone`, `societyMemberships`, `participations`
- **Society**: `sid`, `name`, `slug`, `domain`, `settings`
- **Member**: `societyId`, `memberCode`, `grade`, `used`, `usedBy`
- **Page**: `confId`, `slug`, `titleKo`, `titleEn`, `content`
- **Agenda**: `confId`, `sessionId`, `title`, `speaker`, `startTime`, `endTime`
- **Speaker**: `confId`, `speakerId`, `name`, `affiliation`, `bio`

### Society Extensions (society-extensions.ts)
- **SocietyGrades**: Mapping of grade codes to display names (e.g., "정회원" → "Regular Member")
- **MemberTier**: Membership tiers with pricing (Member vs Non-Member)
- **GradeConfig**: Grade-specific configuration per society

### Conference Types (conference.ts)
- **AgendaItem**: Individual agenda session with time, location, speakers
- **SpeakerData**: Speaker profile with affiliation, bio, photo
- **SessionInfo**: Session metadata (chair, abstracts, materials)

### Print Types (print.ts)
- **BadgeLayout**: Visual layout configuration for badges (fields, positions, styling)
- **PrintConfig**: Printer settings (paper size, margins, orientation)
- **Position**: X/Y coordinates for badge elements

## ANTI-PATTERNS (THIS PROJECT)

- **NEVER** use `any` for Firestore models - import from `@/types/schema`
- **NEVER** use `Date` for Firestore dates - always use `Timestamp` from firebase/firestore
- **NEVER** define types inline - always reference schema types
- **NEVER** create duplicate types - check schema.ts first before adding new types
- **NEVER** skip type assertions - use `as Conference` after `doc.data()`

## CRITICAL GOTCHAS

### Strict Mode is FALSE
- TypeScript strict mode is disabled in `tsconfig.app.json`
- **Do NOT** rely on compiler for type safety
- Always use explicit type annotations from schema

### Collection Group Queries
- Collection group queries return same types across all collections
- Example: `collectionGroup(db, 'registrations')` returns `Registration[]`

### Non-Member User Documents
- `users/{uid}` may NOT exist for non-members
- Always check with try-catch:
  ```typescript
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      const user = userDoc.data() as User;
      // Handle member
    }
  } catch {
    // Fallback to participation data
  }
  ```

### Timestamp Comparison
```typescript
// ✅ CORRECT - Compare Timestamps
const isActive = Timestamp.now().toMillis() < conference.endDate.toMillis();

// ❌ WRONG - Never compare Timestamp with Date
const isActive = Timestamp.now() < conference.endDate;
```

## NOTES

### Why schema.ts Matters
- **Single Source of Truth**: All data shapes defined once
- **Type Safety**: Prevents data corruption bugs
- **Developer Experience**: IDE autocomplete for all Firestore fields
- **Refactoring Safety**: Change schema in one place, propagate everywhere

### Adding New Types
1. Check if similar type exists in schema.ts
2. Add new interface to appropriate file (schema.ts for Firestore, others for domain-specific)
3. Export type from file
4. Import where needed using `import type { TypeName } from '@/types/...';`

### Firestore Data Fetching
```typescript
// Standard pattern
const docRef = doc(db, 'conferences', confId);
const docSnap = await getDoc(docRef);

if (!docSnap.exists()) {
  throw new Error('Conference not found');
}

const conference = docSnap.data() as Conference;  // Type assertion
```
