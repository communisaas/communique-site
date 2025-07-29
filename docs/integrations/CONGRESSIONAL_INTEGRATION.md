# Congressional Integration - User-Focused Approach

## 🎯 Overview

This implementation focuses on the **actual user journey** for congressional advocacy, not over-engineered features. The integration supports:

1. **Onboarding**: Address → Representatives mapping during user signup
2. **Advocacy**: Use stored representatives for CWC/email delivery
3. **Simplicity**: Right-sized for the actual use case

## 🏗 Architecture

### User Flow
```
User Signup → Address Entry → Rep Lookup → Store Reps → Advocacy Ready
                    ↓
               (One-time setup)
                    ↓
         mailto: Link → Use Stored Reps → Generate CWC XML → Submit
```

### Key Components

#### 1. **Address Lookup Service** (`src/lib/congress/address-lookup.ts`)
- **Purpose**: Convert user address → their representatives during onboarding
- **APIs**: 
  - **Primary**: Census Bureau Geocoding API (free, reliable)
  - **Fallback**: OpenSourceActivismTech ZIP-district mapping (119th Congress)
  - **Representatives**: Congress.gov API (real government data)
- **Output**: User's House rep + 2 Senators with actual contact info

#### 2. **User Representatives Storage** (Database)
- **Purpose**: Store each user's specific representatives
- **Models**: `User`, `representative`, `user_representatives`
- **Benefit**: No need to re-lookup during advocacy

#### 3. **CWC Generator** (`src/lib/congress/cwc-generator.ts`)
- **Purpose**: Generate CWC XML using user's stored representatives
- **Input**: Template + User + Target Rep
- **Output**: CWC-compliant XML for submission

## 📊 Database Schema

### Enhanced User Model
```prisma
model User {
  // ... existing fields
  phone     String?
  street    String?    // From KYC/onboarding
  city      String?
  state     String?
  zip       String?
  congressional_district String?
  representatives user_representatives[]
}
```

### Representative Storage
```prisma
model representative {
  bioguide_id   String @unique  // Official Congress.gov ID
  name          String
  party         String  
  state         String
  district      String          // "01", "02", etc.
  chamber       String          // "house" or "senate"
  office_code   String          // For CWC submissions
  // ... other fields
}

model user_representatives {
  user_id          String
  representative_id String
  relationship     String    // "house", "senate_senior", "senate_junior"
  // ... other fields
}
```

## 🔧 API Endpoints

### 1. Address Lookup
```http
POST /api/address/lookup
{
  "street": "123 Main St",
  "city": "San Francisco", 
  "state": "CA",
  "zip": "94102"
}
```
**Response**: User's representatives (House + Senate)

### 2. Store User Representatives
```http
POST /api/user/representatives
{
  "userId": "user123",
  "representatives": { /* from address lookup */ },
  "userAddress": { /* user's address */ }
}
```
**Purpose**: Called after onboarding to store reps

### 3. Get User Representatives
```http
GET /api/user/representatives?userId=user123
```
**Response**: User's stored representatives

## 🎯 Usage Examples

### During Onboarding
```typescript
// 1. User enters address during signup
const address = { street: "123 Main St", city: "SF", state: "CA", zip: "94102" };

// 2. Lookup their representatives
const response = await fetch('/api/address/lookup', {
  method: 'POST',
  body: JSON.stringify(address)
});
const { representatives } = await response.json();

// 3. Store representatives for user
await fetch('/api/user/representatives', {
  method: 'POST',
  body: JSON.stringify({
    userId: user.id,
    representatives,
    userAddress: address
  })
});

// User now has their reps stored!
```

### During Advocacy (mailto: processing)
```typescript
// 1. Get user and their stored representatives
const userReps = await fetch(`/api/user/representatives?userId=${userId}`);
const { representatives } = await userReps.json();

// 2. Generate CWC XML for their House rep
const cwcXml = CWCGenerator.generateUserAdvocacyXML({
  template: advocacyTemplate,
  user: userData,
  targetRep: representatives.house
});

// 3. Submit to CWC system
// (CWC API client to be implemented)
```

## 🔑 Environment Variables

```bash
# Required: Congress.gov API
CONGRESS_API_KEY="your_congress_gov_api_key"

# Optional: Google Civic API (legacy - Census Bureau API now primary)
GOOGLE_CIVIC_API_KEY="your_google_civic_api_key"
```

## 🚀 Benefits of This Approach

### ✅ **Right-Sized Complexity**
- No over-engineered congressional directory
- Focused on actual user journey
- Simple data model

### ✅ **Performance**
- Lookup representatives once during onboarding
- Fast advocacy processing (no API calls needed)
- Cached representative data
  `
  ### ✅ **User Experience**`
- Seamless onboarding with address entry
- Instant advocacy actions (reps already known)
- Clear rep targeting ("Your Representative: John Smith")

### ✅ **Scalability**
- Database queries instead of API calls for advocacy
- Can handle high advocacy volume
- Periodic sync to update representative data

## 🔄 Data Maintenance

### Rep Data Updates
- Check for changes during elections and redistricting cycles
- `PUT /api/user/representatives` to refresh user's reps
- Administrative sync or user-initiated refresh

### Address Changes
- User can update address → auto-refresh representatives
- Handles moves, redistricting, etc.

## 🎯 Implementation Status

Core congressional integration components:

- **Authentication System** - Protect API endpoints
- **KYC/Onboarding Flow** - UI for address capture
- **Email Service** - For direct delivery
- **CWC API Client** - For congressional submissions
- **Deep-linking** - mailto: → app integration

## 🧪 Testing

### Test Address Lookup
```bash
curl -X POST http://localhost:5173/api/address/lookup \
  -H "Content-Type: application/json" \
  -d '{"street":"123 Main St","city":"San Francisco","state":"CA","zip":"94102"}'
```

### Test Rep Storage
```bash
curl -X POST http://localhost:5173/api/user/representatives \
  -H "Content-Type: application/json" \
  -d '{"userId":"test123","representatives":{...}}'
```

### Test CWC Generation
```typescript
import { CWCGenerator } from '$lib/congress/cwc-generator';

const xml = CWCGenerator.generatePreviewXML(template);
console.log(xml);
```

## 💡 Key Insight

This approach recognizes that **users don't browse congressional directories** - they just want to contact **their** representatives. By storing user-specific rep data during onboarding, we optimize for the 99% use case while keeping the system simple and performant.

---

**Status**: Core congressional integration implementation 