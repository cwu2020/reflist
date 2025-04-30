import { Suspense } from "react";
import SalesPageClient from "./sales-client";

export default async function SalesPage() {
  return (
    <Suspense>
      <SalesPageClient />
    </Suspense>
  );
} 