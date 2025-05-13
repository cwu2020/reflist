import { PageContent } from "@/ui/layout/page-content";
import { MaxWidthWrapper } from "@dub/ui";
import { StepPage } from "../step-page";
import { Store } from "lucide-react";
import { MeForm } from "./form";

export default function MePage() {
  return (
    <PageContent title="Shop">
      <MaxWidthWrapper>
        <StepPage
          icon={Store}
          title="Your Shopping Link"
          description="Here's your shopping link with cashback. Click the link to start shopping!"
        >
          <MeForm />
        </StepPage>
      </MaxWidthWrapper>
    </PageContent>
  );
} 