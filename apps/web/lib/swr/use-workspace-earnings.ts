import { useRouterStuff } from "@dub/ui";
import { fetcher } from "@dub/utils";
import { useParams } from "next/navigation";
import useSWR from "swr";
import useWorkspace from "./use-workspace";

// Define the response types
export interface EarningsResponse {
  id: string;
  createdAt: string;
  type: "click" | "lead" | "sale";
  link: {
    id: string;
    shortLink: string;
    url: string;
  };
  customer?: {
    id: string;
    email: string;
  };
  amount: number;
  earnings: number;
  status: "pending" | "processed" | "paid" | "refunded" | "duplicate" | "fraud" | "canceled";
}

export function useWorkspaceEarnings(opts?: {
  enabled?: boolean;
}) {
  const { slug } = useParams();
  const { id: workspaceId } = useWorkspace();
  const { getQueryString } = useRouterStuff();

  const { data, isLoading, error } = useSWR<EarningsResponse[]>(
    slug && workspaceId && opts?.enabled !== false
      ? `/api/workspace/${slug}/earnings${getQueryString()}`
      : null,
    fetcher,
    {
      keepPreviousData: true,
    }
  );

  return {
    earnings: data || [],
    isLoading,
    error,
  };
} 