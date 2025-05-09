-- Rename the original column (keep a backup)
ALTER TABLE `CommissionSplit` 
RENAME COLUMN `claimedById` TO `claimedByPartnerId`;

-- Add the new column for user claiming
ALTER TABLE `CommissionSplit` 
ADD COLUMN `claimedByUserId` VARCHAR(191) NULL;

-- Add foreign key for the new column
ALTER TABLE `CommissionSplit` 
ADD CONSTRAINT `CommissionSplit_claimedByUserId_fkey` 
FOREIGN KEY (`claimedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Add index for the new column
CREATE INDEX `CommissionSplit_claimedByUserId_idx` ON `CommissionSplit`(`claimedByUserId`); 