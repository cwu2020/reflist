import useWorkspace from "@/lib/swr/use-workspace";
import { EnrolledPartnerProps, LinkProps } from "@/lib/types";
import { ArrowUpRight } from "@dub/ui/icons";
import { currencyFormatter, OG_AVATAR_URL } from "@dub/utils";
import Link from "next/link";
import { Prisma } from "@prisma/client";

const formatCurrency = (value: number) =>
  currencyFormatter(value / 100, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// Define the CommissionSplit type for the JSON field
type LinkCommissionSplit = {
  phoneNumber: string;
  splitPercent: number;
};

// Extend the LinkProps type to include commissionSplits with the correct type
interface LinkWithSplits extends LinkProps {
  commissionSplits: Prisma.JsonValue;
}

export function LinkPartnerDetails({
  link,
  partner,
}: {
  link: LinkWithSplits;
  partner?: EnrolledPartnerProps;
}) {
  const { slug } = useWorkspace();
  
  // Parse the commissionSplits field from the link, if it exists
  let commissionSplits: LinkCommissionSplit[] = [];
  if (link.commissionSplits) {
    try {
      // Parse the JSON value to an array of LinkCommissionSplit
      commissionSplits = link.commissionSplits as LinkCommissionSplit[];
    } catch (error) {
      console.error("Error parsing commissionSplits", error);
    }
  }
  
  // Calculate the creator's percentage
  const totalSplitPercent = commissionSplits.reduce((sum, split) => sum + split.splitPercent, 0);
  const creatorPercent = 100 - totalSplitPercent;

  return (
    <div>
      <Link
        href={`/${slug}/programs/${link.programId}/partners?partnerId=${link.partnerId}`}
        className="border-border-subtle group flex items-center justify-between overflow-hidden rounded-t-lg border bg-neutral-100 px-4 py-3"
        target="_blank"
      >
        <div className="flex min-w-0 items-center gap-3">
          {partner ? (
            <img
              src={partner.image || `${OG_AVATAR_URL}${partner.name}`}
              alt={partner.name}
              className="size-8 rounded-full"
            />
          ) : (
            <div className="size-8 animate-pulse rounded-full bg-neutral-200" />
          )}
          <div className="min-w-0">
            {partner ? (
              <span className="block truncate text-xs font-semibold leading-tight text-neutral-900">
                {partner.name}
              </span>
            ) : (
              <div className="h-3 w-24 animate-pulse rounded bg-neutral-200" />
            )}

            {partner ? (
              partner.email && (
                <span className="block min-w-0 truncate text-xs font-medium leading-tight text-neutral-500">
                  {partner.email}
                </span>
              )
            ) : (
              <div className="mt-0.5 h-3 w-20 animate-pulse rounded bg-neutral-200" />
            )}
          </div>
        </div>
        <ArrowUpRight className="size-3 shrink-0 -translate-x-0.5 translate-y-0.5 opacity-0 transition-[transform,opacity] group-hover:translate-x-0 group-hover:translate-y-0 group-hover:opacity-100" />
      </Link>
      <div className="border-border-subtle grid grid-cols-1 divide-y divide-neutral-200 rounded-b-lg border-x border-b sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {[
          ["Revenue", partner ? formatCurrency(partner.saleAmount) : undefined],
          [
            "Commissions",
            partner ? formatCurrency(partner.commissions) : undefined,
          ],
          [
            "Net revenue",
            partner ? formatCurrency(partner.netRevenue) : undefined,
          ],
        ].map(([label, value]) => (
          <div key={label} className="flex flex-col gap-1 px-4 py-3">
            <span className="text-xs font-medium text-neutral-500">
              {label}
            </span>
            {value !== undefined ? (
              <span className="text-sm font-medium text-neutral-900">
                {value}
              </span>
            ) : (
              <div className="h-5 w-20 animate-pulse rounded bg-neutral-200" />
            )}
          </div>
        ))}
      </div>
      
      {/* Commission Splits Section */}
      {commissionSplits.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-neutral-700 mb-2">Commission Splits</h3>
          <div className="border border-neutral-200 rounded-lg overflow-hidden">
            <div className="px-4 py-2 bg-neutral-50 border-b border-neutral-200">
              <div className="flex justify-between">
                <span className="text-xs font-medium text-neutral-600">Creator ({partner?.name})</span>
                <span className="text-xs font-medium text-neutral-800">{creatorPercent}%</span>
              </div>
            </div>
            <div className="divide-y divide-neutral-200">
              {commissionSplits.map((split, index) => (
                <div key={index} className="px-4 py-2 flex justify-between">
                  <span className="text-xs text-neutral-600">{split.phoneNumber}</span>
                  <span className="text-xs font-medium text-neutral-800">{split.splitPercent}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
