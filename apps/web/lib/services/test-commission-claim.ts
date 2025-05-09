/**
 * Test script for the commission claiming flow.
 * This can be run with ts-node or similar to test the services directly.
 */

import { prisma } from "@dub/prisma";
import { createId } from "../api/create-id";
import { commissionClaimService } from "./commission-claim-service";
import { phoneVerificationService } from "./phone-verification-service";
import { partnerManagementService } from "./partner-management-service";
import { registerEventHandlers } from "../events/register-handlers";
import { emitEvent } from "../events/emitter";
import { EventType } from "../events/types";
import { PhoneVerifiedEvent } from "../events/types";

// Register event handlers
registerEventHandlers();

/**
 * Set up test data
 */
async function setupTestData() {
  // Generate test IDs
  const userId = createId({ prefix: "user_" });
  const partnerId = createId({ prefix: "pn_" });
  const programId = createId({ prefix: "prog_" });
  const commissionId = createId({ prefix: "cm_" });
  const splitId = createId({ prefix: "cus_" });
  const phoneNumber = "+1" + Math.floor(Math.random() * 9000000000 + 1000000000);
  
  console.log(`Setting up test data with phone ${phoneNumber}`);
  
  try {
    // Create test user
    const user = await prisma.user.create({
      data: {
        id: userId,
        name: "Test User",
        email: `test-${Date.now()}@example.com`,
        defaultPartnerId: partnerId
      }
    });
    
    // Create partner
    const partner = await prisma.partner.create({
      data: {
        id: partnerId,
        name: "Test Partner",
        users: {
          create: {
            userId: userId,
            role: 'owner'
          }
        }
      }
    });
    
    // Create program
    const program = await prisma.program.create({
      data: {
        id: programId,
        name: "Test Program",
        slug: `test-program-${Date.now()}`,
        workspaceId: "ws_test",
        type: "affiliate",
      }
    });
    
    // Create commission
    const commission = await prisma.commission.create({
      data: {
        id: commissionId,
        programId: programId,
        partnerId: "pn_noexist", // Use non-existent partner to simulate commission for someone else
        linkId: "link_test",
        type: "sale",
        amount: 100,
        quantity: 1,
        earnings: 10,
        currency: "USD",
        status: "pending",
      }
    });
    
    // Create unclaimed commission split with test phone number
    await prisma.$executeRaw`
      INSERT INTO \`CommissionSplit\` (
        \`id\`, \`commissionId\`, \`phoneNumber\`, \`splitPercent\`, 
        \`earnings\`, \`claimed\`, \`createdAt\`, \`updatedAt\`
      ) VALUES (
        ${splitId}, ${commissionId}, ${phoneNumber}, 100, 
        10, FALSE, NOW(), NOW()
      )
    `;
    
    console.log("Test data created successfully");
    
    return {
      userId,
      partnerId,
      programId,
      commissionId,
      splitId,
      phoneNumber
    };
  } catch (error) {
    console.error("Error setting up test data:", error);
    throw error;
  }
}

/**
 * Test direct claiming
 */
async function testDirectClaiming(userId: string, phoneNumber: string) {
  console.log(`Testing direct claiming with user ${userId} and phone ${phoneNumber}`);
  
  try {
    const result = await commissionClaimService.claimCommissions({
      userId,
      phoneNumber
    });
    
    console.log("Direct claiming result:", result);
    
    return result;
  } catch (error) {
    console.error("Error during direct claiming:", error);
    throw error;
  }
}

/**
 * Test event-based claiming
 */
async function testEventBasedClaiming(userId: string, phoneNumber: string) {
  console.log(`Testing event-based claiming with user ${userId} and phone ${phoneNumber}`);
  
  try {
    // Create another unclaimed split
    const commissionId = createId({ prefix: "cm_" });
    const splitId = createId({ prefix: "cus_" });
    
    // Create commission
    await prisma.commission.create({
      data: {
        id: commissionId,
        programId: "prog_test",
        partnerId: "pn_noexist",
        linkId: "link_test",
        type: "sale",
        amount: 200,
        quantity: 1,
        earnings: 20,
        currency: "USD",
        status: "pending",
      }
    });
    
    // Create unclaimed commission split
    await prisma.$executeRaw`
      INSERT INTO \`CommissionSplit\` (
        \`id\`, \`commissionId\`, \`phoneNumber\`, \`splitPercent\`, 
        \`earnings\`, \`claimed\`, \`createdAt\`, \`updatedAt\`
      ) VALUES (
        ${splitId}, ${commissionId}, ${phoneNumber}, 100, 
        20, FALSE, NOW(), NOW()
      )
    `;
    
    // Emit phone verified event
    console.log("Emitting PHONE_VERIFIED event");
    emitEvent(EventType.PHONE_VERIFIED, {
      phoneNumber,
      userId
    } as Omit<PhoneVerifiedEvent, 'type' | 'timestamp'>);
    
    // Add a small delay to allow event processing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check if split was claimed
    const checkResult = await prisma.$queryRaw`
      SELECT * FROM \`CommissionSplit\` WHERE \`id\` = ${splitId}
    `;
    
    console.log("Split status after event:", checkResult);
    
    return checkResult;
  } catch (error) {
    console.error("Error during event-based claiming:", error);
    throw error;
  }
}

/**
 * Clean up test data
 */
async function cleanupTestData(ids: any) {
  console.log("Cleaning up test data");
  
  try {
    // Clean up in reverse order of creation
    await prisma.$executeRaw`
      DELETE FROM \`CommissionSplit\` WHERE \`phoneNumber\` = ${ids.phoneNumber}
    `;
    
    await prisma.commission.deleteMany({
      where: {
        id: {
          in: [ids.commissionId]
        }
      }
    });
    
    await prisma.program.delete({
      where: {
        id: ids.programId
      }
    });
    
    await prisma.partnerUser.deleteMany({
      where: {
        userId: ids.userId
      }
    });
    
    await prisma.partner.delete({
      where: {
        id: ids.partnerId
      }
    });
    
    await prisma.user.delete({
      where: {
        id: ids.userId
      }
    });
    
    console.log("Test data cleaned up successfully");
  } catch (error) {
    console.error("Error cleaning up test data:", error);
    // Continue even if cleanup fails
  }
}

/**
 * Run the test
 */
async function runTest() {
  let testData;
  
  try {
    console.log("Starting commission claim test");
    
    // Set up test data
    testData = await setupTestData();
    
    // Test direct claiming
    await testDirectClaiming(testData.userId, testData.phoneNumber);
    
    // Test event-based claiming
    await testEventBasedClaiming(testData.userId, testData.phoneNumber);
    
    console.log("All tests completed successfully");
  } catch (error) {
    console.error("Test failed:", error);
  } finally {
    if (testData) {
      await cleanupTestData(testData);
    }
  }
}

// Execute the test if this file is run directly
if (require.main === module) {
  runTest()
    .then(() => process.exit(0))
    .catch(error => {
      console.error("Unhandled error:", error);
      process.exit(1);
    });
} 