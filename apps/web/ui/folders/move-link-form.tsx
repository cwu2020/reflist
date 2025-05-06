import useWorkspace from "@/lib/swr/use-workspace";
import { ExpandedLinkProps } from "@/lib/types";
import { Button, LinkLogo } from "@dub/ui";
import { getApexDomain, getPrettyUrl, pluralize } from "@dub/utils";
import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { mutate } from "swr";
import { FolderDropdown } from "./folder-dropdown";

interface MoveLinkFormProps {
  links: ExpandedLinkProps[];
  onSuccess: (folderId: string | null) => void;
  onCancel: () => void;
}

interface LinkMoveResult {
  linkId: string;
  success: boolean;
  data?: any;
  error?: string;
}

export const MoveLinkForm = ({
  links,
  onSuccess,
  onCancel,
}: MoveLinkFormProps) => {
  const workspace = useWorkspace();
  const [isMoving, setIsMoving] = useState(false);

  const [selectedFolderId, setSelectedFolderId] = useState<string>(
    links[0].folderId ?? "unsorted",
  );

  // Move link to selected folder
  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    if (!selectedFolderId) {
      return;
    }

    e.preventDefault();
    setIsMoving(true);

    // Convert "unsorted" to null for the API request
    const targetFolderId = selectedFolderId === "unsorted" ? null : selectedFolderId;

    console.log("[MoveLinkForm] Starting move operation", {
      linkIds: links.map(({ id }) => id),
      fromFolderId: links[0].folderId,
      toFolderId: targetFolderId,
    });

    try {
      // We'll now take a more robust approach by updating links one by one
      // This avoids potential batch update issues and makes it easier to debug
      const results: LinkMoveResult[] = [];
      let allSuccessful = true;

      for (const link of links) {
        try {
          // Make individual PUT request for each link
          const response = await fetch(`/api/links/${link.id}?workspaceId=${workspace.id}`, {
            method: "PATCH",  // Using PATCH endpoint for individual link updates
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              folderId: targetFolderId,
            }),
          });

          if (!response.ok) {
            console.error(`[MoveLinkForm] Error moving link ${link.id}:`, await response.text());
            allSuccessful = false;
            results.push({
              linkId: link.id,
              success: false,
              error: `API returned ${response.status}`
            });
            continue;
          }

          const result = await response.json();
          console.log(`[MoveLinkForm] Successfully moved link ${link.id}:`, result);
          
          results.push({
            linkId: link.id,
            success: true,
            data: result
          });
          
          // Force immediate revalidation of this specific link's data
          await mutate(`/api/links/${link.id}?workspaceId=${workspace.id}`);
          
        } catch (error) {
          console.error(`[MoveLinkForm] Exception moving link ${link.id}:`, error);
          allSuccessful = false;
          results.push({
            linkId: link.id,
            success: false,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      console.log("[MoveLinkForm] All individual move operations completed:", results);

      // Force cache revalidation for all links in both folders
      await mutate(
        (key) => typeof key === "string" && key.includes(`/api/links?`),
        undefined,
        { revalidate: true }
      );
      
      // Also invalidate link counts
      await mutate(
        (key) => typeof key === "string" && key.includes(`/api/links/count`),
        undefined,
        { revalidate: true }
      );

      if (allSuccessful) {
        console.log("[MoveLinkForm] All links successfully moved");
        toast.success(`${links.length > 1 ? 'Links' : 'Link'} moved successfully!`);
        
        // Wait a short time to allow the revalidation to complete
        setTimeout(() => {
          onSuccess(targetFolderId);
        }, 300);
      } else {
        const successCount = results.filter(r => r.success).length;
        
        if (successCount > 0) {
          toast.warning(`Moved ${successCount} out of ${links.length} links. Some links failed to move.`);
        } else {
          toast.error("Failed to move links. Please try again.");
        }
        
        setIsMoving(false);
      }
    } catch (error) {
      console.error("[MoveLinkForm] Unexpected error during move operation:", error);
      toast.error("An unexpected error occurred while moving the link");
      setIsMoving(false);
    }
  };

  return (
    <>
      <div className="space-y-2 border-b border-neutral-200 p-4 sm:p-6">
        {links.length === 1 && (
          <LinkLogo apexDomain={getApexDomain(links[0].url)} className="mb-4" />
        )}
        <h3 className="truncate text-lg font-medium leading-none">
          Move{" "}
          {links.length > 1
            ? `${links.length} links`
            : getPrettyUrl(links[0].shortLink)}
        </h3>
      </div>

      <div className="bg-neutral-50 sm:rounded-b-2xl">
        <form onSubmit={onSubmit}>
          <div className="flex flex-col gap-y-6 px-4 text-left sm:px-6">
            <div className="mt-6">
              <label className="text-sm font-normal text-neutral-500">
                Folder
              </label>
              <div className="mt-1">
                <FolderDropdown
                  variant="input"
                  hideViewAll={true}
                  disableAutoRedirect={true}
                  onFolderSelect={(folder) => {
                    setSelectedFolderId(folder.id);
                  }}
                  buttonClassName="w-full max-w-full md:max-w-full border border-neutral-200 bg-white"
                  buttonTextClassName="text-base md:text-base font-normal"
                  selectedFolderId={selectedFolderId ?? undefined}
                />
              </div>
            </div>
          </div>

          <div className="mt-8 flex justify-end gap-2 border-t border-neutral-200 px-4 py-4 sm:px-6">
            <Button
              type="button"
              variant="secondary"
              text="Cancel"
              className="h-8 w-fit px-3"
              onClick={onCancel}
              disabled={isMoving}
            />
            <Button
              type="submit"
              text={
                isMoving
                  ? "Moving..."
                  : `Move ${pluralize("link", links.length)}`
              }
              disabled={isMoving}
              loading={isMoving}
              className="h-8 w-fit px-3"
            />
          </div>
        </form>
      </div>
    </>
  );
};
