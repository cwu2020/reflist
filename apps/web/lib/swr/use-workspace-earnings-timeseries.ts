import { useRouterStuff } from "@dub/ui";
import { fetcher } from "@dub/utils";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { DUB_PARTNERS_ANALYTICS_INTERVAL } from "../analytics/constants";
import { IntervalOptions } from "../analytics/types";
import useWorkspace from "./use-workspace";

// Define the response structure from the API
export interface EarningsTimeseriesItem {
  start: string;
  earnings: number;
  data?: Record<string, number>;
}

export type EarningsTimeseriesResponse = EarningsTimeseriesItem[];

// Custom parameters type specifically for earnings timeseries
interface EarningsTimeseriesParams {
  interval?: IntervalOptions;
  start?: Date | string;
  end?: Date | string;
  groupBy?: "linkId" | "type"; // Custom groupBy options specific to earnings
  enabled?: boolean;
  status?: string;
  type?: string;
  customerId?: string;
  linkId?: string;
}

export function useWorkspaceEarningsTimeseries(params?: EarningsTimeseriesParams) {
  const { slug } = useParams();
  const { id: workspaceId } = useWorkspace();
  const { getQueryString } = useRouterStuff();

  const { data, isLoading, error } = useSWR<EarningsTimeseriesResponse>(
    slug && workspaceId && params?.enabled !== false
      ? `/api/workspace/${slug}/earnings/timeseries${getQueryString(
          {
            ...(params?.interval && { interval: params.interval }),
            ...(params?.groupBy && { groupBy: params.groupBy }),
            ...(params?.start && params.end
              ? {
                  start: params.start instanceof Date 
                    ? params.start.toISOString() 
                    : params.start,
                  end: params.end instanceof Date 
                    ? params.end.toISOString() 
                    : params.end,
                }
              : {
                  interval: params?.interval ?? DUB_PARTNERS_ANALYTICS_INTERVAL,
                }),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            ...(params?.status && { status: params.status }),
            ...(params?.type && { type: params.type }),
            ...(params?.customerId && { customerId: params.customerId }),
            ...(params?.linkId && { linkId: params.linkId }),
          },
          { 
            include: ["type", "linkId", "customerId", "status"] 
          }
        )}`
      : null,
    fetcher,
    {
      dedupingInterval: 60000,
      keepPreviousData: true,
    }
  );

  return {
    data: data || [],
    isLoading,
    error,
  };
} 