import { fetcher } from "@dub/utils";
import { useSession } from "next-auth/react";
import { useParams, useSearchParams } from "next/navigation";
import useSWR, { SWRConfiguration } from "swr";
import {
  DUB_PARTNERS_ANALYTICS_INTERVAL,
  VALID_ANALYTICS_FILTERS,
} from "../analytics/constants";
import { PartnerAnalyticsFilters, PartnerAnalyticsResponse } from "../analytics/types";

export default function usePartnerAnalytics(
  params: PartnerAnalyticsFilters & {
    programId?: string;
    enabled?: boolean;
  },
  options?: SWRConfiguration,
) {
  const { data: session } = useSession();
  const { programSlug } = useParams();
  const searchParams = useSearchParams();

  const partnerId = session?.user?.["defaultPartnerId"];
  const programIdToUse = params?.programId ?? programSlug;

  const { data } = useSWR<PartnerAnalyticsResponse>(
    params?.start && params?.end
      ? [
          "/api/partners/analytics",
          {
            ...params,
            start: typeof params.start === "string" ? params.start : params.start.toISOString(),
            end: typeof params.end === "string" ? params.end : params.end.toISOString(),
          },
        ]
      : null,
    fetcher,
  );

  return {
    data,
    error: null,
    loading: partnerId && programIdToUse && !data ? true : false,
  };
}
