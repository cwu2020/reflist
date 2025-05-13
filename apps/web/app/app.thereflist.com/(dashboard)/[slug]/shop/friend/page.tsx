import { PageContent } from "@/ui/layout/page-content";
import { MaxWidthWrapper } from "@dub/ui";
import { StepPage } from "../step-page";
import { UserPlus } from "lucide-react";
import { FriendForm } from "./form";

export default function FriendPage() {
  return (
    <PageContent title="Shop">
      <MaxWidthWrapper>
        <StepPage
          icon={UserPlus}
          title="For a Friend"
          description="Set your commission split and invite your friend."
        >
          <FriendForm />
        </StepPage>
      </MaxWidthWrapper>
    </PageContent>
  );
} 