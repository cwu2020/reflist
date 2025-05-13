import { Icon } from "@dub/ui";
import { cn } from "@dub/utils";
import { PropsWithChildren, ReactNode } from "react";

export function StepPage({
  children,
  icon: Icon,
  title,
  description,
  className,
}: PropsWithChildren<{
  icon?: Icon;
  title: ReactNode;
  description: ReactNode;
  className?: string;
}>) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-sm flex-col items-center",
        "animate-slide-up-fade [--offset:10px] [animation-duration:1s] [animation-fill-mode:both]",
        className,
      )}
    >
      {Icon && <StepIcon icon={Icon} />}
      <h1 className="mt-4 text-center text-2xl font-medium leading-tight">
        {title}
      </h1>
      <div className="mt-1.5 text-center text-base leading-tight text-neutral-500">
        {description}
      </div>
      <div className="mt-8 w-full">{children}</div>
    </div>
  );
}

function StepIcon({ icon: Icon }: { icon: Icon }) {
  return (
    <div className="rounded-full border border-neutral-200 bg-white p-2.5">
      <Icon className="size-[18px]" />
    </div>
  );
} 