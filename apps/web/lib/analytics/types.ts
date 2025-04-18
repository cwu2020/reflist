import z from "../zod";
import {
  analyticsQuerySchema,
  eventsQuerySchema,
} from "../zod/schemas/analytics";
import { getPartnerEarningsTimeseriesSchema } from "../zod/schemas/partner-profile";
import {
  ANALYTICS_SALE_UNIT,
  ANALYTICS_VIEWS,
  EVENT_TYPES,
  VALID_ANALYTICS_ENDPOINTS,
  intervals,
} from "./constants";

export type IntervalOptions = (typeof intervals)[number];

export type AnalyticsGroupByOptions =
  (typeof VALID_ANALYTICS_ENDPOINTS)[number];

export type AnalyticsResponseOptions =
  | "clicks"
  | "leads"
  | "sales"
  | "saleAmount";

export type EventType = (typeof EVENT_TYPES)[number];

export type AnalyticsView = (typeof ANALYTICS_VIEWS)[number];
export type AnalyticsSaleUnit = (typeof ANALYTICS_SALE_UNIT)[number];

export type DeviceTabs = "devices" | "browsers" | "os" | "triggers";

export type AnalyticsFilters = z.infer<typeof analyticsQuerySchema> & {
  workspaceId?: string;
  dataAvailableFrom?: Date;
  isDemo?: boolean;
  isDeprecatedClicksEndpoint?: boolean;
  folderIds?: string[];
  isMegaFolder?: boolean;
};

export type EventsFilters = z.infer<typeof eventsQuerySchema> & {
  workspaceId?: string;
  dataAvailableFrom?: Date;
  isDemo?: boolean;
  customerId?: string;
  folderIds?: string[];
  isMegaFolder?: boolean;
  eventType?: EventType;
  event?: EventType;
  limit?: number;
  offset?: number;
  order?: "asc" | "desc";
  sortBy?: string;
  page?: number;
};

const partnerAnalyticsSchema = z.object({
  event: z.string().optional(),
  interval: z.string().optional(),
  start: z.union([z.string(), z.date()]).optional(),
  end: z.union([z.string(), z.date()]).optional(),
  groupBy: z.string().optional(),
  linkId: z.string().optional(),
});

export type PartnerAnalyticsFilters = z.infer<typeof partnerAnalyticsSchema>;
export type PartnerEarningsTimeseriesFilters = z.infer<
  typeof getPartnerEarningsTimeseriesSchema
>;

const partnerEventsSchema = z.object({
  event: z.string().optional(),
  interval: z.string().optional(),
  start: z.union([z.string(), z.date()]).optional(),
  end: z.union([z.string(), z.date()]).optional(),
  groupBy: z.string().optional(),
  page: z.number().optional(),
  limit: z.number().optional(),
  order: z.string().optional(),
  sortOrder: z.string().optional(),
  sortBy: z.string().optional(),
});

export type PartnerEventsFilters = z.infer<typeof partnerEventsSchema>;

export type PartnerAnalyticsResponse = {
  count: {
    clicks: number;
    leads: number;
    sales: number;
    saleAmount: number;
    earnings: number;
  };
  timeseries: Array<{
    start: string;
    clicks: number;
    leads: number;
    sales: number;
    saleAmount: number;
    earnings: number;
  }>;
  top_links: Array<{
    id: string;
    link: string;
    clicks: number;
    leads: number;
    sales: number;
    saleAmount: number;
    earnings: number;
    createdAt: string;
  }>;
};

export type PartnerAnalyticsTimeseries = Array<{
  start: string;
  clicks: number;
  leads: number;
  sales: number;
  saleAmount: number;
  earnings: number;
}>;
