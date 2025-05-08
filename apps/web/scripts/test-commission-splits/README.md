# Commission Split Testing Script

This script tests the commission split functionality by simulating the exact flow used by the admin sales form, directly calling the same core functions used in production. It's useful for verifying that commission splits are working correctly in a controlled environment.

## What It Does

1. **Finds a specific test link** - Either by URL or by ID
2. **Creates a test customer** - Simulates a customer making a purchase
3. **Processes a sale** - Simulates the admin sales recording process including:
   - Generating a unique event ID
   - Calculating earnings based on commission data
   - Creating commission records via `createPartnerCommission`
   - Processing commission splits based on link configuration
4. **Validates commission records** - Verifies that all expected commission records were created

## Configuration

```typescript
const config: TestConfig = {
  // Link identification
  findLinkBy: "url", // or "id"
  linkUrl: "https://refl.ist/9k21feQ", // Replace with your link
  linkId: "", // Alternative to linkUrl

  // Sale configuration
  saleAmount: 100.00,
  commissionAmount: 30.00,

  // Commission configuration
  userTakeRate: 50, // 50% to link creator, 50% to commission splits

  // Debug settings
  debug: true // Enable detailed logging
};
```

## Running the Test

From the project root directory:

```bash
# Using the shell script (recommended)
./apps/web/scripts/test-commission-splits/run-test.sh

# Or manually with ts-node
npx ts-node -r tsconfig-paths/register apps/web/scripts/test-commission-splits/test-commission-splits.ts
```

## Expected Output

The script logs detailed information at each step of the process. Here's an example of what to expect:

```
=== Test Commission Splits ===
Finding link by URL: https://refl.ist/9k21feQ
Found link: https://refl.ist/9k21feQ (ID: link_01HPNMD45ESHWS9SRVPGVXZF7K)
Creating test customer...
Created test customer: cus_01HXR4J5N7P8W9X0YZ1A2B3C4D
Processing test sale...
Generated event ID: evt_01HXR4J5N7P8W9X0YZ1A2B3C4D
Calculated earnings: $30.00
Created commission with ID: com_01HXR4J5N7P8W9X0YZ1A2B3C4D
=== Validating commission splits ===
Found 2 commission records
Found 1 commission split records
Primary commission details: {
  id: 'com_01HXR4J5N7P8W9X0YZ1A2B3C4D',
  partnerId: 'par_01HPNMD45ESHWS9SRVPGVXZF7K',
  partnerName: 'John Doe',
  earnings: 15,
  amount: 100
}
Split commission details: {
  id: 'com_01HXR4K6N8P9X0YZ1A2B3C4D5E',
  partnerId: 'par_01HPNMD56ESHWS0SRVQGWXZF8L',
  partnerName: 'Jane Smith',
  partnerPhone: '+15551234567',
  earnings: 15,
  amount: 100,
  eventId: 'evt_01HXR4J5N7P8W9X0YZ1A2B3C4D_split_1'
}
Commission split record: {
  id: 'csp_01HXR4K6N8P9X0YZ1A2B3C4D5E',
  commissionId: 'com_01HXR4J5N7P8W9X0YZ1A2B3C4D',
  partnerId: 'par_01HPNMD56ESHWS0SRVQGWXZF8L',
  phoneNumber: '+15551234567',
  splitPercent: 50,
  earnings: 15,
  claimed: false
}
Test completed successfully!
```

## Troubleshooting

- **Database Connection**: Ensure your `.env` file has the correct database credentials
- **Link Not Found**: Verify the link URL or ID exists and is correctly formatted
- **Phone Number Format**: Ensure phone numbers are in E.164 format (e.g., +15551234567)
- **Workspace Setup**: Make sure you've run `npm install` and are in the correct workspace

## How To Test Different Scenarios

To test different commission split scenarios, modify the configuration object:

1. **Different Link**: Change `linkUrl` to test with another link
2. **Different Sale Amounts**: Adjust `saleAmount` and `commissionAmount`
3. **Different Commission Splits**: The test uses the commission splits configured on the link

The script directly calls the same functions used in production, so any issue found here would also appear in the live application. 