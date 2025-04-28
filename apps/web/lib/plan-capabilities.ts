import { WorkspaceProps } from "@/lib/types";

// Get the capabilities of a workspace based on the plan
export const getPlanCapabilities = (
  plan: WorkspaceProps["plan"] | undefined | string,
) => {
  return {
    canAddFolder: true, // Allow all creators to add folders, regardless of plan
    canManageFolderPermissions: plan && !["free", "pro"].includes(plan), // default access level is write
  };
};
