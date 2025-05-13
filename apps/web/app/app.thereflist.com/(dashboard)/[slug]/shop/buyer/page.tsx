import { PageContent } from "@/ui/layout/page-content";
import { MaxWidthWrapper } from "@dub/ui";
import { StepPage } from "../step-page";
import { Store } from "lucide-react";
import { BuyerForm } from "./form";

export default function BuyerPage() {
  return (
    <PageContent title="Shop">
      <MaxWidthWrapper>
        <StepPage
          icon={Store}
          title="Who's buying?"
          description="Choose whether you're buying for yourself or creating a link for a friend."
        >
          <BuyerForm />
        </StepPage>
      </MaxWidthWrapper>
    </PageContent>
  );
} 