import { useRouterStuff } from "@dub/ui";
import { fetcher } from "@dub/utils";
import { useParams } from "next/navigation";
import useSWR from "swr";
import useWorkspace from "./use-workspace";

// Define the response types
export interface EarningsCounts {
  [key: string]: {
    count: number;
    amount: number;
    earnings: number;
  };
}

export interface EarningsCountResponse {
  counts: EarningsCounts;
  monthlyEarnings: number;
  availableBalance: number;
  pendingEarnings: number;
}

export function useWorkspaceEarningsCount(opts?: {
  enabled?: boolean;
}) {
  const { slug } = useParams();
  const { id: workspaceId } = useWorkspace();
  const { getQueryString } = useRouterStuff();

  const { data, isLoading, error } = useSWR<EarningsCountResponse>(
    slug && workspaceId && opts?.enabled !== false
      ? `/api/workspace/${slug}/earnings/count${getQueryString()}`
      : null,
    fetcher,
    {
      keepPreviousData: true,
    }
  );

  return {
    counts: data?.counts || {},
    monthlyEarnings: data?.monthlyEarnings || 0,
    availableBalance: data?.availableBalance || 0,
    pendingEarnings: data?.pendingEarnings || 0,
    isLoading,
    error,
  };
} 