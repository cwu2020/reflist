import AdminLinksClient from "app/app.thereflist.com/(dashboard)/[slug]/links/page-client";
import { Suspense } from "react";

export default function AdminLinks() {
  return (
    <Suspense>
      <AdminLinksClient />
    </Suspense>
  );
}
