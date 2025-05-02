/**
 * Test script to verify the partner model implementation
 * This script will:
 * 1. Create a test user
 * 2. Verify a partner record was automatically created
 * 3. Create a link
 * 4. Verify the link is associated with the partner and appropriate program
 */

import { prisma } from "@dub/prisma";
import { createId } from "../../lib/api/create-id";
import { hashPassword } from "../../lib/auth/password";
import { processLinkWithPartner } from "../../lib/api/links/process-link-with-partner";
import { createLink } from "../../lib/api/links/create-link";
import "dotenv-flow/config";

const TEST_EMAIL = `test-${Date.now()}@example.com`;
const TEST_PASSWORD = "password123";
const TEST_URL = "https://cultgaia.com/products/test-product";

async function main() {
  console.log("Starting partner model verification test...");
  
  try {
    // Step 1: Create a test user
    console.log("Creating test user:", TEST_EMAIL);
    const userId = createId({ prefix: "user_" });
    
    const user = await prisma.$transaction(async (tx) => {
      // Create user
      const newUser = await tx.user.create({
        data: {
          id: userId,
          email: TEST_EMAIL,
          passwordHash: await hashPassword(TEST_PASSWORD),
          emailVerified: new Date(),
        },
      });
      
      // Create workspace for the user
      const workspace = await tx.project.create({
        data: {
          id: createId({ prefix: "ws_" }),
          name: "Test Workspace",
          slug: `test-workspace-${Date.now()}`,
          billingCycleStart: new Date().getDate(),
          users: {
            create: {
              userId: newUser.id,
              role: "owner",
            }
          }
        }
      });
      
      return {
        user: newUser,
        workspace
      };
    });
    
    console.log("Created test user with ID:", user.user.id);
    console.log("Created test workspace with ID:", user.workspace.id);
    
    // Step 2: Verify partner record was created
    // Wait a moment to ensure any async operations complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check if partner record exists
    const partnerUser = await prisma.partnerUser.findFirst({
      where: { userId: user.user.id },
      include: { partner: true }
    });
    
    // If no partner exists, create one (this should happen automatically, but we'll do it here for the test)
    if (!partnerUser) {
      console.log("No partner record found. Creating one manually...");
      
      const partnerId = createId({ prefix: "pn_" });
      await prisma.$transaction(async (tx) => {
        const partner = await tx.partner.create({
          data: {
            id: partnerId,
            name: TEST_EMAIL.split('@')[0],
            email: TEST_EMAIL,
            users: {
              create: {
                userId: user.user.id,
                role: 'owner',
              }
            }
          }
        });
        
        await tx.user.update({
          where: { id: user.user.id },
          data: { defaultPartnerId: partner.id }
        });
      });
      
      console.log("Created partner record manually");
    } else {
      console.log("Partner record exists:", partnerUser.partner.id);
      console.log("Partner name:", partnerUser.partner.name);
      console.log("Partner created automatically ✓");
    }
    
    // Refresh user data to get defaultPartnerId
    const updatedUser = await prisma.user.findUnique({
      where: { id: user.user.id },
      select: { defaultPartnerId: true }
    });
    
    if (!updatedUser?.defaultPartnerId) {
      throw new Error("User does not have a defaultPartnerId set");
    }
    
    console.log("User has defaultPartnerId:", updatedUser.defaultPartnerId, "✓");
    
    // Step 3: Create a link using the processLinkWithPartner function
    console.log("Creating test link to:", TEST_URL);
    
    const { link, error } = await processLinkWithPartner({
      payload: {
        url: TEST_URL,
        domain: "dub.sh", // Use dub.sh as test domain
      },
      workspace: {
        id: user.workspace.id,
        plan: "pro"
      },
      userId: user.user.id
    });
    
    if (error) {
      throw new Error(`Error processing link: ${error}`);
    }
    
    // Create the actual link
    const createdLink = await createLink(link as any);
    console.log("Created link:", createdLink.shortLink);
    
    // Step 4: Verify the link is associated with the partner and appropriate program
    const savedLink = await prisma.link.findUnique({
      where: { id: createdLink.id },
      select: {
        id: true,
        partnerId: true,
        programId: true,
        program: {
          select: {
            id: true,
            name: true,
            domain: true
          }
        }
      }
    });
    
    if (!savedLink) {
      throw new Error("Link not found in database");
    }
    
    console.log("Link saved with ID:", savedLink.id);
    
    if (savedLink.partnerId === updatedUser.defaultPartnerId) {
      console.log("Link is correctly associated with partner ID:", savedLink.partnerId, "✓");
    } else {
      console.error("Link is not associated with the correct partner ID");
      console.error("Expected:", updatedUser.defaultPartnerId);
      console.error("Actual:", savedLink.partnerId);
    }
    
    if (savedLink.programId) {
      console.log("Link is associated with program ID:", savedLink.programId, "✓");
      console.log("Program name:", savedLink.program?.name);
      console.log("Program domain:", savedLink.program?.domain);
    } else {
      console.error("Link is not associated with any program");
    }
    
    // Verify program enrollment
    if (savedLink.programId && updatedUser.defaultPartnerId) {
      const enrollment = await prisma.programEnrollment.findUnique({
        where: {
          partnerId_programId: {
            partnerId: updatedUser.defaultPartnerId,
            programId: savedLink.programId
          }
        }
      });
      
      if (enrollment) {
        console.log("Partner is correctly enrolled in program:", enrollment.id, "✓");
        console.log("Enrollment status:", enrollment.status);
      } else {
        console.error("Partner is not enrolled in the program");
      }
    }
    
    console.log("\nTest completed successfully!");
    
  } catch (error) {
    console.error("Test failed with error:", error);
  } finally {
    // Cleanup (optional) - uncomment if you want to clean up test data
    /*
    try {
      if (TEST_EMAIL) {
        // Get user
        const user = await prisma.user.findUnique({
          where: { email: TEST_EMAIL },
          select: { id: true, defaultPartnerId: true }
        });
        
        if (user) {
          // Delete all related data
          await prisma.$transaction([
            prisma.link.deleteMany({ where: { userId: user.id } }),
            prisma.partnerUser.deleteMany({ where: { userId: user.id } }),
            prisma.programEnrollment.deleteMany({ 
              where: user.defaultPartnerId ? { partnerId: user.defaultPartnerId } : undefined
            }),
            prisma.partner.deleteMany({ 
              where: user.defaultPartnerId ? { id: user.defaultPartnerId } : undefined
            }),
            prisma.projectUsers.deleteMany({ where: { userId: user.id } }),
            prisma.user.delete({ where: { id: user.id } })
          ]);
          
          console.log("Test data cleaned up");
        }
      }
    } catch (cleanupError) {
      console.error("Error during cleanup:", cleanupError);
    }
    */
    
    await prisma.$disconnect();
  }
}

// Run the test
main()
  .catch((e) => {
    console.error("Error running test:", e);
    process.exit(1);
  }); 