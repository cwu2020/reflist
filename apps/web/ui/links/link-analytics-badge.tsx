import { useCheckFolderPermission } from "@/lib/swr/use-folder-permissions";
import useWorkspace from "@/lib/swr/use-workspace";
import {
  Button,
  CardList,
  CopyButton,
  CursorRays,
  InvoiceDollar,
  Tooltip,
  useMediaQuery,
  UserCheck,
} from "@dub/ui";
import { ReferredVia } from "@dub/ui/icons";
import {
  APP_DOMAIN,
  cn,
  currencyFormatter,
  fetcher,
  INFINITY_NUMBER,
  nFormatter,
  pluralize,
  timeAgo,
} from "@dub/utils";
import Link from "next/link";
import { useContext, useMemo, useState } from "react";
import useSWR from "swr";
import { useShareDashboardModal } from "../modals/share-dashboard-modal";
import { ResponseLink } from "./links-container";

// Define types for the response from the links/stats API
interface LinkStatsResponse {
  clicks: number;
  leads: number;
  sales: number;
  saleAmount: number;
  lastClicked?: Date;
}

export function LinkAnalyticsBadge({
  link,
  url,
  sharingEnabled = true,
}: {
  link: Omit<ResponseLink, "user">;
  url?: string;
  sharingEnabled?: boolean;
}) {
  const { slug, plan, id: workspaceId } = useWorkspace();
  const { domain, key, trackConversion } = link;

  // Fetch fresh analytics data including sales data
  const { data: analyticsData } = useSWR(
    workspaceId ? `/api/analytics?domain=${domain}&key=${key}&workspaceId=${workspaceId}&event=clicks,leads,sales` : null,
    fetcher,
    {
      revalidateOnFocus: true,
      refreshInterval: 10000, // Refresh every 10 seconds
      dedupingInterval: 5000,
    }
  );

  // Also fetch fresh link stats directly from the database
  const { data: freshLinkData } = useSWR<LinkStatsResponse>(
    workspaceId ? `/api/links/stats?domain=${domain}&key=${key}` : null,
    fetcher,
    {
      revalidateOnFocus: true,
      refreshInterval: 10000, // Refresh every 10 seconds
      dedupingInterval: 5000,
    }
  );

  // Safely extract the metrics from the analytics data
  const freshMetrics = useMemo(() => {
    // Use the direct link stats query data if available (most up-to-date source)
    if (freshLinkData) {
      return {
        clicks: freshLinkData.clicks || 0,
        leads: freshLinkData.leads || 0,
        sales: freshLinkData.sales || 0,
        saleAmount: freshLinkData.saleAmount || 0,
        lastClicked: freshLinkData.lastClicked,
      };
    }
    
    // Fall back to analytics data if available
    if (!analyticsData) return null;
    
    // Handle different possible response formats
    if (Array.isArray(analyticsData)) {
      // If it's an array, sum up the metrics
      return {
        clicks: analyticsData.reduce((sum, item) => sum + (Number(item.clicks) || 0), 0),
        leads: analyticsData.reduce((sum, item) => sum + (Number(item.leads) || 0), 0),
        sales: analyticsData.reduce((sum, item) => sum + (Number(item.sales) || 0), 0),
        saleAmount: analyticsData.reduce((sum, item) => sum + (Number(item.saleAmount) || 0), 0),
        lastClicked: link.lastClicked,
      };
    } else if (typeof analyticsData === 'object' && analyticsData !== null) {
      // If it's an object with the properties
      return {
        clicks: 'clicks' in analyticsData ? Number(analyticsData.clicks) : 0,
        leads: 'leads' in analyticsData ? Number(analyticsData.leads) : 0,
        sales: 'sales' in analyticsData ? Number(analyticsData.sales) : 0,
        saleAmount: 'saleAmount' in analyticsData ? Number(analyticsData.saleAmount) : 0,
        lastClicked: link.lastClicked,
      };
    }
    
    return null;
  }, [analyticsData, freshLinkData, link.lastClicked]);

  // Use fresh data if available, fall back to prop data
  const clicks = freshMetrics?.clicks ?? link.clicks;
  const leads = freshMetrics?.leads ?? link.leads;
  const sales = freshMetrics?.sales ?? 0;
  const saleAmount = freshMetrics?.saleAmount ?? link.saleAmount;
  const lastClicked = freshMetrics?.lastClicked ?? link.lastClicked;

  // Determine if there have been any clicks
  const hasClicks = clicks > 0;

  const { isMobile } = useMediaQuery();
  const { variant } = useContext(CardList.Context);

  const stats = useMemo(
    () => [
      {
        id: "clicks",
        icon: CursorRays,
        value: clicks,
        iconClassName: "data-[active=true]:text-blue-500",
      },
      // show leads and sales if:
      // 1. link has trackConversion enabled
      // 2. link has leads or sales
      ...(trackConversion || leads > 0 || saleAmount > 0
        ? [
            {
              id: "leads",
              icon: UserCheck,
              value: leads,
              className: "hidden sm:flex",
              iconClassName: "data-[active=true]:text-purple-500",
            },
            {
              id: "sales",
              icon: InvoiceDollar,
              value: saleAmount,
              className: "hidden sm:flex",
              iconClassName: "data-[active=true]:text-teal-500",
            },
          ]
        : []),
    ],
    [clicks, trackConversion, leads, saleAmount]
  );

  const { ShareDashboardModal, setShowShareDashboardModal } =
    useShareDashboardModal({ domain, _key: key });

  // Hacky fix for making sure the tooltip closes (by rerendering) when the modal opens
  const [modalShowCount, setModalShowCount] = useState(0);

  const canManageLink = useCheckFolderPermission(
    link.folderId,
    "folders.links.write",
  );

  return isMobile ? (
    <Link
      href={`/${slug}/analytics?domain=${domain}&key=${key}`}
      className="flex items-center gap-1 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-sm text-neutral-800"
    >
      <CursorRays className="h-4 w-4 text-neutral-600" />
      {nFormatter(clicks)}
    </Link>
  ) : (
    <>
      {sharingEnabled && <ShareDashboardModal />}
      <Tooltip
        key={modalShowCount}
        side="top"
        content={
          <div className="flex flex-col gap-2.5 whitespace-nowrap p-3 text-neutral-600">
            {stats.map(({ id: tab, value }) => (
              <div key={tab} className="text-sm leading-none">
                <span className="font-medium text-neutral-950">
                  {tab === "sales"
                    ? currencyFormatter(value / 100)
                    : nFormatter(value, { full: value < INFINITY_NUMBER })}
                </span>{" "}
                {tab === "sales" ? "total " : ""}
                {pluralize(tab.slice(0, -1), value)}
              </div>
            ))}
            <p className="text-xs leading-none text-neutral-400">
              {hasClicks 
                ? (lastClicked 
                  ? `Last clicked ${timeAgo(lastClicked, { withAgo: true })}`
                  : "Recently clicked") 
                : "No clicks yet"}
            </p>

            {sharingEnabled && (
              <div className="inline-flex items-start justify-start gap-2">
                <Button
                  text={link.dashboardId ? "Edit sharing" : "Share dashboard"}
                  className="h-7 w-full px-2"
                  onClick={() => {
                    setShowShareDashboardModal(true);
                    setModalShowCount((c) => c + 1);
                  }}
                  disabled={!canManageLink}
                />

                {link.dashboardId && (
                  <CopyButton
                    value={`${APP_DOMAIN}/share/${link.dashboardId}`}
                    variant="neutral"
                    className="h-7 items-center justify-center rounded-md border border-neutral-300 bg-white p-1.5 hover:bg-neutral-50 active:bg-neutral-100"
                  />
                )}
              </div>
            )}
          </div>
        }
      >
        <Link
          href={`/${slug}/analytics?domain=${domain}&key=${key}${url ? `&url=${url}` : ""}&interval=${plan === "free" ? "30d" : plan === "pro" ? "1y" : "all"}`}
          className={cn(
            "block overflow-hidden rounded-md border border-neutral-200 bg-neutral-50 p-0.5 text-sm text-neutral-600 transition-colors",
            variant === "loose" ? "hover:bg-neutral-100" : "hover:bg-white",
          )}
        >
          <div className="hidden items-center gap-0.5 sm:flex">
            {stats.map(
              ({ id: tab, icon: Icon, value, className, iconClassName }) => (
                <div
                  key={tab}
                  className={cn(
                    "flex items-center gap-1 whitespace-nowrap rounded-md px-1 py-px transition-colors",
                    className,
                  )}
                >
                  <Icon
                    data-active={value > 0}
                    className={cn("h-4 w-4 shrink-0", iconClassName)}
                  />
                  <span>
                    {tab === "sales"
                      ? currencyFormatter(value / 100)
                      : nFormatter(value)}
                    {stats.length === 1 && " clicks"}
                  </span>
                </div>
              ),
            )}
            {link.dashboardId && (
              <div className="border-l border-neutral-200 px-1.5">
                <ReferredVia className="h-4 w-4 shrink-0 text-neutral-600" />
              </div>
            )}
          </div>
        </Link>
      </Tooltip>
    </>
  );
}
