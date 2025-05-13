import { PageContent } from "@/ui/layout/page-content";
import { MaxWidthWrapper } from "@dub/ui";
import { StepPage } from "./step-page";
import { Store } from "lucide-react";
import { Form } from "./form";

export default function ShopPage() {
  return (
    <PageContent title="Shop">
      <MaxWidthWrapper>
        <StepPage
          icon={Store}
          title="Create a Shopping Link"
          description="Enter a product URL to create a shopping link with cashback."
        >
          <Form />
        </StepPage>
      </MaxWidthWrapper>
    </PageContent>
  );
} 