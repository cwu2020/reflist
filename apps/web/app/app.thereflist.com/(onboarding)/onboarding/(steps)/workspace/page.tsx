import { GridPlus } from "@dub/ui/icons";
import { StepPage } from "../step-page";
import { Form } from "./form";

export default function Workspace() {
  return (
    <StepPage
      icon={GridPlus}
      title="Create your creator profile"
      description={
        <a
          href="https://dub.co/help/article/what-is-a-workspace"
          target="_blank"
          className="underline transition-colors hover:text-neutral-700"
        >
          What is a creator profile?
        </a>
      }
    >
      <Form />
    </StepPage>
  );
}
