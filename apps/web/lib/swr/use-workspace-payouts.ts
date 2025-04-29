import { useRouterStuff } from "@dub/ui";
import { fetcher } from "@dub/utils";
import { PayoutStatus } from "@dub/prisma/client";
import { useParams } from "next/navigation";
import useSWR from "swr";
import useWorkspace from "./use-workspace";

// Define the response types
export interface PayoutResponse {
  id: string;
  amount: number;
  currency: string;
  status: PayoutStatus;
  periodStart: string | null;
  periodEnd: string | null;
  createdAt: string;
  paidAt: string | null;
  description?: string;
}

export interface PayoutsResponse {
  payouts: PayoutResponse[];
  count: number;
}

export function useWorkspacePayouts(opts?: {
  enabled?: boolean;
}) {
  const { slug } = useParams();
  const { id: workspaceId } = useWorkspace();
  const { getQueryString } = useRouterStuff();

  const { data, isLoading, error } = useSWR<PayoutsResponse>(
    slug && workspaceId && opts?.enabled !== false
      ? `/api/workspace/${slug}/payouts${getQueryString()}`
      : null,
    fetcher,
    {
      keepPreviousData: true,
    }
  );

  return {
    payouts: data?.payouts || [],
    count: data?.count || 0,
    isLoading,
    error,
  };
} 