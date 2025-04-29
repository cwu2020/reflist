"use client";

import useWorkspace from "@/lib/swr/use-workspace";
import LayoutLoader from "@/ui/layout/layout-loader";
import WorkspaceExceededClicks from "@/ui/workspaces/workspace-exceeded-clicks";
import { ReactNode } from "react";

export default function EarningsClient({
  children,
}: {
  children: ReactNode;
}) {
  const { exceededClicks, loading } = useWorkspace();

  if (loading) {
    return <LayoutLoader />;
  }

  if (exceededClicks) {
    return <WorkspaceExceededClicks />;
  }

  return children;
} 