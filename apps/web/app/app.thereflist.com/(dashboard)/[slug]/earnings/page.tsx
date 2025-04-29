import LayoutLoader from "@/ui/layout/layout-loader";
import { PageContent } from "@/ui/layout/page-content";
import { Suspense } from "react";
import EarningsClient from "./client";
import Earnings from "@/ui/earnings";

export default function WorkspaceEarnings() {
  return (
    <Suspense fallback={<LayoutLoader />}>
      <PageContent title="Earnings">
        <EarningsClient>
          <Earnings />
        </EarningsClient>
      </PageContent>
    </Suspense>
  );
} 