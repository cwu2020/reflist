// Migration script to transition to the partner model
// This script will:
// 1. Create Partner records for users that don't have them
// 2. Associate existing links with the appropriate partner
// 3. Create program enrollments for partners based on link domains

import { prisma } from "@dub/prisma";
import { createId } from "@/lib/api/create-id";
import { getApexDomain } from "@dub/utils";
import { ProgramEnrollmentStatus } from "@dub/prisma/client";
import "dotenv-flow/config";

async function main() {
  console.log("Starting partner model migration...");
  
  // Step 1: Create Partner records for users that don't have them
  console.log("Creating Partner records for users without them...");
  
  // Find all users without a partner relationship
  const usersWithoutPartners = await prisma.user.findMany({
    where: {
      partners: {
        none: {}
      }
    },
    select: {
      id: true,
      name: true,
      email: true
    }
  });
  
  console.log(`Found ${usersWithoutPartners.length} users without partners`);
  
  // Create a Partner record for each user
  let createdPartners = 0;
  for (const user of usersWithoutPartners) {
    try {
      // Create partner record
      const partnerId = createId({ prefix: "pn_" });
      const partnerName = user.name || (user.email ? user.email.split('@')[0] : "User");
      
      await prisma.$transaction(async (tx) => {
        // Create partner
        const partner = await tx.partner.create({
          data: {
            id: partnerId,
            name: partnerName,
            email: user.email,
            users: {
              create: {
                userId: user.id,
                role: 'owner',
              }
            }
          }
        });
        
        // Update user's defaultPartnerId
        await tx.user.update({
          where: { id: user.id },
          data: { defaultPartnerId: partner.id }
        });
      });
      
      createdPartners++;
    } catch (error) {
      console.error(`Error creating partner for user ${user.id}:`, error);
    }
  }
  
  console.log(`Created ${createdPartners} new partner records`);
  
  // Step 2: Associate existing links with the appropriate partner
  console.log("Associating existing links with partners...");
  
  // Find all links without a partnerId but with a userId
  const linksWithoutPartner = await prisma.link.findMany({
    where: {
      userId: { not: null },
      partnerId: null
    },
    select: {
      id: true,
      userId: true,
      url: true,
      domain: true,
      projectId: true
    }
  });
  
  console.log(`Found ${linksWithoutPartner.length} links to update with partner relationships`);
  
  // Update links with the user's default partner
  let updatedLinks = 0;
  for (const link of linksWithoutPartner) {
    try {
      if (!link.userId) continue;
      
      // Get the user's default partner
      const user = await prisma.user.findUnique({
        where: { id: link.userId },
        select: { defaultPartnerId: true }
      });
      
      if (!user?.defaultPartnerId) {
        // Try to find any partner for this user
        const partnerUser = await prisma.partnerUser.findFirst({
          where: { userId: link.userId },
          select: { partnerId: true }
        });
        
        if (!partnerUser) {
          console.log(`No partner found for user ${link.userId}, skipping link ${link.id}`);
          continue;
        }
        
        // Update link with partner ID
        await prisma.link.update({
          where: { id: link.id },
          data: { partnerId: partnerUser.partnerId }
        });
        
        // Also update user's defaultPartnerId
        await prisma.user.update({
          where: { id: link.userId },
          data: { defaultPartnerId: partnerUser.partnerId }
        });
      } else {
        // Update link with partner ID
        await prisma.link.update({
          where: { id: link.id },
          data: { partnerId: user.defaultPartnerId }
        });
      }
      
      updatedLinks++;
    } catch (error) {
      console.error(`Error updating link ${link.id}:`, error);
    }
  }
  
  console.log(`Updated ${updatedLinks} links with partner relationships`);
  
  // Step 3: Create programs and enroll partners
  console.log("Creating programs and enrolling partners...");
  
  // Get all links with partnerId but without a programId
  const linksWithoutProgram = await prisma.link.findMany({
    where: {
      partnerId: { not: null },
      programId: null,
      url: { not: "" }
    },
    select: {
      id: true,
      url: true,
      partnerId: true,
      projectId: true
    }
  });
  
  console.log(`Found ${linksWithoutProgram.length} links to create programs for`);
  
  // Create programs and enroll partners
  let createdPrograms = 0;
  let enrolledPartners = 0;
  
  // Group links by domain and workspace
  const linksByDomainAndWorkspace = new Map();
  
  for (const link of linksWithoutProgram) {
    if (!link.url || !link.projectId) continue;
    
    try {
      const domain = getApexDomain(link.url);
      if (!domain) continue;
      
      const key = `${domain}:${link.projectId}`;
      if (!linksByDomainAndWorkspace.has(key)) {
        linksByDomainAndWorkspace.set(key, []);
      }
      linksByDomainAndWorkspace.get(key).push(link);
    } catch (error) {
      console.error(`Error processing link ${link.id}:`, error);
    }
  }
  
  // Process each domain and workspace group
  for (const [key, links] of linksByDomainAndWorkspace.entries()) {
    const [domain, workspaceId] = key.split(':');
    
    try {
      // Check if program already exists
      let program = await prisma.program.findFirst({
        where: {
          workspaceId,
          domain
        }
      });
      
      // Create program if it doesn't exist
      if (!program) {
        const domainLabel = domain.split('.')[0].toLowerCase();
        const slug = `${domainLabel}-${Math.random().toString(36).substring(2, 8)}`;
        
        program = await prisma.$transaction(async (tx) => {
          // Create program
          const newProgram = await tx.program.create({
            data: {
              id: createId({ prefix: "prog_" }),
              workspaceId,
              name: domain,
              slug,
              domain,
              url: links[0].url,
              cookieLength: 90,
              holdingPeriodDays: 30,
              minPayoutAmount: 10000
            }
          });
          
          // Create default reward
          const reward = await tx.reward.create({
            data: {
              id: createId({ prefix: "rw_" }),
              programId: newProgram.id,
              name: `Default ${domain} Commission`,
              event: 'sale',
              type: 'percentage',
              amount: 1000 // 10% default commission
            }
          });
          
          // Set default reward
          await tx.program.update({
            where: { id: newProgram.id },
            data: { defaultRewardId: reward.id }
          });
          
          return newProgram;
        });
        
        createdPrograms++;
      }
      
      // Process all links for this domain and workspace
      for (const link of links) {
        try {
          if (!link.partnerId) continue;
          
          // Check if partner is already enrolled
          const enrollment = await prisma.programEnrollment.findUnique({
            where: {
              partnerId_programId: {
                partnerId: link.partnerId,
                programId: program.id
              }
            }
          });
          
          // Enroll partner if not already enrolled
          if (!enrollment) {
            await prisma.programEnrollment.create({
              data: {
                id: createId({ prefix: "pge_" }),
                partnerId: link.partnerId,
                programId: program.id,
                status: ProgramEnrollmentStatus.approved
              }
            });
            
            enrolledPartners++;
          }
          
          // Update link with programId
          await prisma.link.update({
            where: { id: link.id },
            data: { programId: program.id }
          });
        } catch (error) {
          console.error(`Error processing link ${link.id}:`, error);
        }
      }
    } catch (error) {
      console.error(`Error processing domain ${domain} for workspace ${workspaceId}:`, error);
    }
  }
  
  console.log(`Created ${createdPrograms} new programs`);
  console.log(`Enrolled ${enrolledPartners} partners in programs`);
  console.log("Migration completed successfully!");
}

// Run the migration
main()
  .catch((e) => {
    console.error("Error running migration:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });