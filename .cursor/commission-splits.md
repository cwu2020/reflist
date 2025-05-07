To enable commission splitting between link creators (users) and link buyers, here's the best approach based on your existing system architecture:
1. Create a CommissionSplit Model
Add a new model to track how commissions are split:


model CommissionSplit {
  id             String    @id @default(cuid())
  commissionId   String
  partnerId      String    // The partner receiving a portion
  splitPercent   Int       // Percentage (0-100) of commission share
  earnings       Int       // Actual earnings amount
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  commission     Commission @relation(fields: [commissionId], references: [id], onDelete: Cascade)
  partner        Partner   @relation(fields: [partnerId], references: [id])
  @@unique([commissionId, partnerId])
  @@index([partnerId])
  @@index([commissionId])
}
2. Modify Link Creation Process
Update the link creation process to capture split information:
typescript
Apply
// Add a schema for commission splits
const linkSplitSchema = z.object({
  partnerId: z.string(),  // ID of partner to share with
  splitPercent: z.number().min(1).max(99)  // Cannot be 0% or 100%
});
// Add to link creation schema
const createLinkWithSplitSchema = createLinkSchema.extend({
  splits: z.array(linkSplitSchema).optional()
});
3. Store Split Configuration on Links
Add a JSON field to the Link model to store split configurations:
prisma
Apply
model Link {
  // existing fields...
  commissionSplits Json?  // Store split configurations 
}
4. Update Commission Creation Process
Modify the createPartnerCommission function to handle splits:
typescript
Apply
export const createPartnerCommission = async ({
  // existing params...
}) => {
  // Calculate earnings as normal
  let earnings = calculateSaleEarnings({...});
  
  // Get link details including splits
  const link = await prisma.link.findUnique({
    where: { id: linkId }
  });
  
  const splits = link.commissionSplits as {
    partnerId: string;
    splitPercent: number;
  }[] | null;
  
  // If no splits, create commission as normal
  if (!splits || splits.length === 0) {
    return await prisma.commission.create({
      data: { /* existing data */ },
    });
  }
  
  // With splits, use a transaction to create multiple records
  return await prisma.$transaction(async (tx) => {
    // Calculate creator's share (primary partner)
    const creatorPercent = 100 - splits.reduce((sum, split) => sum + split.splitPercent, 0);
    const creatorEarnings = Math.floor(earnings * (creatorPercent / 100));
    
    // Create primary commission with reduced earnings
    const primaryCommission = await tx.commission.create({
      data: {
        id: createId({ prefix: "cm_" }),
        programId,
        partnerId, // Original partner (link creator)
        customerId,
        linkId,
        eventId,
        invoiceId,
        quantity,
        amount,
        type: event,
        currency,
        earnings: creatorEarnings,
      },
    });
    
    // Create commission splits
    for (const split of splits) {
      const splitEarnings = Math.floor(earnings * (split.splitPercent / 100));
      
      // Record the split
      await tx.commissionSplit.create({
        data: {
          commissionId: primaryCommission.id,
          partnerId: split.partnerId,
          splitPercent: split.splitPercent,
          earnings: splitEarnings,
        }
      });
      
      // Create separate commission for the split partner
      await tx.commission.create({
        data: {
          id: createId({ prefix: "cm_" }),
          programId,
          partnerId: split.partnerId, // Split partner
          customerId,
          linkId,
          eventId: `${eventId}_split_${split.partnerId}`, // Make unique
          invoiceId,
          quantity,
          amount,
          type: event,
          currency,
          earnings: splitEarnings,
        },
      });
    }
    
    return primaryCommission;
  });
};
5. Update the Dashboard
Modify the earnings dashboard to show split information:
Add a "Split Earnings" tab/filter to show commission splits
Display "Received from Splits" vs. "My Link Earnings"
Show a breakdown of earnings by source
6. User Interface for Setting Splits
Create an interface during link creation:
tsx
Apply
function LinkSplitSettings() {
  const [splits, setSplits] = useState([]);
  
  const addSplit = () => {
    setSplits([...splits, { partnerId: '', splitPercent: 50 }]);
  };
  
  return (
    <div>
      <h3>Commission Splits</h3>
      {splits.map((split, index) => (
        <div key={index}>
          <PartnerSelector 
            value={split.partnerId} 
            onChange={(partnerId) => updateSplit(index, { partnerId })}
          />
          <PercentageInput
            value={split.splitPercent}
            onChange={(splitPercent) => updateSplit(index, { splitPercent })}
          />
          <RemoveButton onClick={() => removeSplit(index)} />
        </div>
      ))}
      <Button onClick={addSplit}>Add Split</Button>
    </div>
  );
}
7. Payouts Integration
Ensure the payouts system recognizes split commissions:
Each partner receives their own commissions independently
Split information is tracked for transparency and reporting
Partners can see which splits contributed to their earnings
Benefits of This Approach
Minimal Schema Changes: Leverages existing Commission model
Complete Transparency: All splits are tracked and visible
Flexible Split Configurations: Can support multiple buyers with different percentages
Independent Payouts: Each partner's earnings are processed separately
Scalability: Works with your existing reporting and analytics
This approach enables users to create links, define commission splits with buyers, and have the system automatically distribute earnings while maintaining a clear audit trail.
can you write in words how each part of this system works end to end?
Commission Split System: End-to-End Workflow
1. Link Creation with Commission Splits
When a user creates a link with commission splits:
The user navigates to the link creation interface and fills out the basic link details (URL, domain, etc.)
They enable the "Split Commission" option, which reveals additional controls
They select partner(s) to split with from a dropdown of available partners
For each partner, they specify a percentage (e.g., 30% to Partner A, 20% to Partner B)
The system validates that total splits don't exceed 100% and that all partners are eligible
Upon submission, the link is created with regular link details plus the commission split configuration
The split information is stored in the commissionSplits JSON field on the Link record
2. Customer Clicks and Conversions
When a customer interacts with a split-configured link:
A customer clicks the link and is redirected to the destination
The click is tracked normally in the system with the appropriate link ID
If the customer makes a purchase or completes a conversion
The conversion tracking mechanism captures the sale amount, customer details, etc.
The system identifies that this sale is associated with a link that has commission splits
3. Commission Calculation and Distribution
When a sale is processed for a link with splits:
The standard commission calculation process runs, determining the total commission amount
E.g., 10% of a $100 sale = $10 total commission
The system retrieves the link's split configuration
It calculates each partner's portion based on their percentage:
Link creator (original partner): 50% of $10 = $5
Partner A: 30% of $10 = $3
Partner B: 20% of $10 = $2
In a database transaction, it creates:
A primary Commission record for the link creator with their portion ($5)
Additional Commission records for each split partner with their portions ($3, $2)
CommissionSplit records documenting the split relationship between these commissions
Each Commission record contains:
The partner ID of the recipient
The amount they earned
References to the same link, customer, and sale event
A unique event ID (derived from the original event ID)
4. Dashboard and Reporting
How splits appear in dashboards and reports:
When partners view their earnings dashboard, they see:
Commissions earned from their own links
Commissions earned from links where they're included in splits (labeled accordingly)
Link creators can see:
Total sales/conversions generated by their links
Their portion of earnings after splits
Detailed breakdown of how commissions were distributed
Administrators can view:
Complete split histories
Total commission amounts across all partners
Audit trails of all split transactions
5. Payouts Processing
When commissions are processed for payment:
The system processes commissions to "processed" status after holding periods
When creating payouts, each partner's earned commissions are bundled together, regardless of whether they came from their own links or splits
Partners receive a single payout that includes all their earnings
Payout reports show the source of earnings, including which came from splits
Each partner's payout is calculated and processed independently based on their own minimum thresholds
6. Split Management
How splits are managed over time:
Split configurations are set when a link is created and remain fixed for that link
If a user wants to change the split, they would create a new link with different settings
Historical splits are preserved for accounting and transparency
Split partners can view which links they're receiving splits from, but cannot modify the configuration
Only the link creator can determine split percentages when creating the link
7. Technical Implementation
Behind the scenes:
The CommissionSplit table connects Commission records via foreign keys
When queries run against the Commission table, they fetch all commissions regardless of split origin
The split percentage and amount are recorded for audit and reporting purposes
The system maintains referential integrity through the transaction model - either all split commissions are created, or none are
Analytics data aggregates both direct and split commissions to show total earnings
This system allows users to collaborate on link promotion while ensuring transparent and automated commission distribution, all within your existing commission tracking infrastructure.
ok so in this implementation given that a single link has multiple partners to pay out, who do we put in the partnerid section of the link schema?
In this implementation, the partnerId field in the Link schema still serves an important role despite having multiple partners to pay out. Here's how to handle it:
The Primary Partner Approach
The partnerId field in the Link schema would contain the ID of the primary partner (the link creator) who:
Created the link: The user who initially generated the link
Owns the link: Has permission to modify, archive, or manage the link
Initiated the splits: Decided to share commissions with others
Technical Implementation Details
Link Record:
text
Apply
   Link {
     id: "link_xyz123",
     partnerId: "pn_abc123",  // Primary partner (link creator)
     commissionSplits: [      // Secondary partners (split recipients)
       { partnerId: "pn_def456", splitPercent: 30 },
       { partnerId: "pn_ghi789", splitPercent: 20 }
     ],
     // Other link fields...
   }
Database Constraints:
The partnerId field maintains its regular foreign key relationship to the Partner table
The programEnrollment relationship remains based on [programId, partnerId]
The commissionSplits JSON field stores the additional split configuration
Attribution Logic:
For analytics and event tracking, the link is attributed to the primary partner
The primary partner's dashboard shows the link in their "My Links" section
Secondary partners don't see the link in their links list, but see earnings from it
Why This Approach Works
Maintains Database Integrity: Keeps the existing database relationships intact
Clear Ownership Model: One partner is the definitive owner of each link
Authorization Controls: Permission systems continue to work as expected
Attribution: Clearly shows who created and manages the link
Backward Compatibility: Works with existing code that expects a single partnerId
