-- AlterEnum: add the chip-lab quality-check stage, positioned after Ready to Dispatch
ALTER TYPE "CaseStatus" ADD VALUE 'CHIP_LAB_QUALITY_CHECK' AFTER 'CHIP_LAB_READY_DISPATCH';
