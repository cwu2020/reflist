import { FolderAccessRequest } from "@dub/prisma/client";
import { fetcher } from "@dub/utils";
import useSWR from "swr";
import useWorkspace from "./use-workspace";

export function useFolderAccessRequests() {
  const { id, flags } = useWorkspace();

  const { data, error, isLoading, isValidating, mutate } = useSWR<
    FolderAccessRequest[]
  >(
    id && flags?.linkFolders
      ? `/api/folders/access-requests?workspaceId=${id}`
      : null,
    fetcher,
    {
      dedupingInterval: 60000,
    },
  );

  return {
    accessRequests: data,
    error,
    isLoading,
    isValidating,
    mutate,
  };
}
