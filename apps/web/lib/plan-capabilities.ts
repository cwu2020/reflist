import { WorkspaceProps } from "@/lib/types";

// Get the capabilities of a workspace based on the plan
export const getPlanCapabilities = (
  plan: WorkspaceProps["plan"] | undefined | string,
) => {
  return {
    canAddFolder: true, // Allow all plans to add folders
    canManageFolderPermissions: plan && !["free", "pro"].includes(plan), // default access level is write
  };
};
