# Manual Sales Process Documentation

## 1. Admin Manual Sales Process

### Form Submission
When an admin submits a manual sale through the admin dashboard, the following data is sent:

```typescript
{
  linkId: string;                // ID of the link to record the sale for
  amount: number;                // Amount in cents
  currency: string;              // Currency code (default: "usd")
  paymentProcessor: string;      // Payment processor used
  eventName: string;             // Name of the event (default: "Manual Sale")
  invoiceId?: string;            // Optional invoice ID
  notes?: string;                // Optional internal notes
  customerId?: string;           // Optional customer ID (if provided, uses existing customer)
}
```

### Backend Processing
The backend (`/api/admin/sales`) processes this data by:

1. Validating the admin has permission
2. Validating the data against the schema
3. Finding the link and project
4. Creating a unique `eventId` with format: `manual_[random_id]_[base64_encoded_admin_info]`
5. Calculating earnings based on program commission structure
6. Creating or finding a customer record
7. Creating a commission record
8. Updating link statistics
9. Updating project statistics
10. Sending a Tinybird event record

## 2. Database Schema Requirements

### Commission Model
The Commission table requires:

```
id                String           // Unique identifier with prefix "cm_"
programId         String           // Program ID or empty string if none
partnerId         String           // Partner ID or empty string if none
linkId            String           // Link ID
customerId        String           // Customer ID
eventId           String           // Event ID (with prefix "manual_")
type              EventType        // "sale" for manual sales
amount            Int              // Amount in cents
quantity          Int              // Quantity (usually 1)
currency          String           // Currency code
status            CommissionStatus // Initially "pending"
invoiceId         String?          // Optional invoice ID
earnings          Int              // Calculated earnings amount
```

### Customer Model
The Customer table requires:

```
id                String           // Unique identifier with prefix "cus_"
name              String?          // Customer name (or generated placeholder name)
externalId        String           // Unique ID (format: "manual_sale_[random_id]")
projectId         String           // Project ID
linkId            String           // Link ID
```

Important: The Customer model doesn't have a `programId` field in the database schema, but the validation schema expects it.

## 3. Tinybird Integration

### Event Schema
Tinybird expects a sale event with:

```typescript
{
  timestamp: string;              // ISO timestamp
  event_id: string;               // Same eventId used in Commission
  event_name: string;             // "Manual Sale" or custom name
  customer_id: string;            // ID of the customer
  click_id: string;               // Generated ID
  link_id: string;                // ID of the link
  url: string;                    // URL of the link
  // Geographic data (defaults to San Francisco)
  country: string;                // "US"
  continent: string;              // "NA"
  city: string;                   // "San Francisco"
  region: string;                 // "CA"
  latitude: string;               // "37.7695"
  longitude: string;              // "-122.385"
  // Device data (defaults to desktop)
  device: string;                 // "desktop"
  device_vendor: string;          // "Apple"
  device_model: string;           // "Macintosh"
  browser: string;                // "Chrome"
  browser_version: string;        // "124.0.0.0"
  engine: string;                 // "Blink"
  engine_version: string;         // "124.0.0.0"
  os: string;                     // "Mac OS"
  os_version: string;             // "10.15.7"
  cpu_architecture: string;       // "Unknown"
  ua: string;                     // Full user agent string
  bot: number;                    // 0 (not a bot)
  qr: number;                     // 0 (not a QR code scan)
  // Referrer info
  referer: string;                // "admin" for manual sales
  referer_url: string;            // "admin" for manual sales
  ip: string;                     // "127.0.0.1" for manual sales
  // Transaction data
  invoice_id: string;             // Invoice ID or generated
  amount: number;                 // Amount in cents
  currency: string;               // Currency code
  payment_processor: string;      // Payment processor
  // Metadata
  metadata: string;               // JSON string with admin info
}
```

### API Parameters
The Tinybird API call uses:
- Endpoint: `${TINYBIRD_API_URL}/v0/events?name=dub_sale_events`
- Headers: 
  - `Authorization: Bearer ${TINYBIRD_API_KEY}`
  - `Content-Type: application/json`
- Method: POST
- Body: JSON event object

## 4. Zod Validation Schema Requirements

### Database Schema vs. Validation Schema

#### Database Schema
- Defined in Prisma schema files
- Describes the actual structure of tables in the database
- Enforced at the database level
- Changes require migrations

#### Validation Schema
- Defined using Zod schemas
- Used to validate API requests and responses
- Enforced at the application level
- Can be modified without database changes

#### Reconciliation
Ideally, the validation schema should match the database schema to avoid confusion and bugs. However, they serve different purposes:
- Database schemas define storage structure
- Validation schemas define API contracts

In our case, the mismatch with `programId` should eventually be reconciled by either:
1. Adding the field to the database schema (requires migration)
2. Removing the field from the validation schema (requires updating all consumers)

### Full Customer Schema
Here is the complete Zod validation schema for customers:

```typescript
export const CustomerSchema = z.object({
  id: z
    .string()
    .describe(
      "The unique ID of the customer. You may use either the customer's `id` on Dub (obtained via `/customers` endpoint) or their `externalId` (unique ID within your system, prefixed with `ext_`, e.g. `ext_123`).",
    ),
  externalId: z
    .string()
    .describe("Unique identifier for the customer in the client's app."),
  name: z.string().describe("Name of the customer."),
  email: z.string().nullish().describe("Email of the customer."),
  avatar: z.string().nullish().describe("Avatar URL of the customer."),
  country: z.string().nullish().describe("Country of the customer."),
  createdAt: z.date().describe("The date the customer was created."),
  programId: z.string().nullish().describe("The ID of the program the customer is associated with."),
});

// An extended schema that includes the customer's link, partner, and discount.
export const CustomerEnrichedSchema = CustomerSchema.extend({
  link: LinkSchema.pick({
    id: true,
    domain: true,
    key: true,
    shortLink: true,
    programId: true,
  }).nullish(),
  partner: PartnerSchema.pick({
    id: true,
    name: true,
    email: true,
    image: true,
  }).nullish(),
  discount: DiscountSchema.nullish(),
});
```

### Sales Record Schema
```typescript
const recordSaleSchema = z.object({
  linkId: z.string(),
  amount: z.number().int().min(0),
  currency: z.string().default("usd"),
  paymentProcessor: z.string(),
  eventName: z.string().default("Manual Sale"),
  invoiceId: z.string().optional(),
  notes: z.string().optional(),
  customerId: z.string().optional(),
});
```

### Commission Percentage and Earnings Calculation

The commission percentage is not stored directly in the Commission table. Instead:

1. **Program Commission Structure**: The commission percentage is stored in the `Program` table, which defines the commission structure for each program.

2. **Calculation Process**:
   When a manual sale is created, the `calculateProgramEarnings` function is called:

   ```typescript
   // Calculate earnings based on program's commission structure
   const earnings = await calculateProgramEarnings({
     programId: link.programId || null,
     amount: validatedData.amount,
     quantity: 1
   });
   ```

3. **Implementation**: The `calculateProgramEarnings` function fetches the program details and applies the commission structure:

   ```typescript
   // Simplified version of the logic
   export async function calculateProgramEarnings({ programId, amount, quantity }) {
     if (!programId) {
       // Default commission of 10% if no program is specified
       return Math.round(amount * 0.1);
     }
     
     const program = await prisma.program.findUnique({
       where: { id: programId },
       include: { commissionStructure: true }
     });
     
     if (!program) {
       return Math.round(amount * 0.1); // Default fallback
     }
     
     // Apply the program's commission structure
     // This could be a percentage, flat fee, or tiered structure
     return calculateCommission(program.commissionStructure, amount, quantity);
   }
   ```

4. **For Manual Sales**: In our testing script, we used a simplified 10% calculation:
   ```javascript
   earnings: amount * 0.1, // Assumes 10% earnings
   ```

5. **Storage**: Once calculated, the earnings amount is stored in the `earnings` field of the Commission record, but the percentage used to calculate it is not stored.

## 5. How We Handled All Issues

### Schema Mismatch Fix
We resolved the mismatch between the database model and validation schema by:

1. Modifying the `CustomerSchema` validation to make the `programId` field optional using `.nullish()`
2. For commissions, we set `programId` to `link.programId || ""` to ensure it's never undefined
3. When creating a customer, we left it without a `programId` field since it doesn't exist in the database

### Earnings Dashboard Fix
Initially, manual sales didn't appear in the earnings dashboard because it was filtering based on:

```typescript
{
  program: {
    workspaceId: workspace.id,
  }
}
```

We modified all earnings-related API endpoints to use the following filter instead:

```typescript
{
  OR: [
    // Include commissions from programs belonging to this workspace
    {
      program: {
        workspaceId: workspace.id,
      },
    },
    // Include commissions from links directly created in this workspace
    {
      link: {
        projectId: workspace.id,
      },
    },
  ],
}
```

This ensures that manual sales (which may not have valid program IDs) still appear in the earnings dashboard if they're from links created in the workspace.

### Added Customer ID Support
We added a `customerId` field to the manual sales form to allow admins to specify an existing customer ID. If left blank, a new customer is automatically created.

## 6. Dashboard Filtering

### Events & Analytics Dashboard
Shows events based on the Tinybird event records, filtering by:
- Workspace/project ID
- Time range
- Event type

### Earnings Dashboard
The earnings dashboard filters commissions by:
- Commissions with earnings > 0
- Commissions from programs belonging to the workspace OR
- Commissions from links created in the workspace
- Optional filters: status, type, date range, etc.

The counts and timeseries endpoints use similar filtering logic to show:
- Monthly earnings
- Available balance
- Pending earnings
- Earnings over time

## 7. Manual Sale Identification
Manual sales can be identified by:
- `eventId` starting with `"manual_"`
- Metadata containing admin information
- Referer field set to "admin"

This allows for easy filtering and special handling of manual sales if needed. 