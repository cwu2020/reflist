import { ClientOnly } from "@dub/ui";
import { Suspense } from "react";

interface AuthLayoutProps {
  children: React.ReactNode;
}

export const AuthLayout = ({ children }: AuthLayoutProps) => {
  return (
    <div className="grid w-full grid-cols-1">
      <div className="col-span-1 flex min-h-screen flex-col items-center justify-between border-r border-neutral-200 bg-white/10 shadow-[inset_10px_-50px_94px_0_rgb(199,199,199,0.2)] backdrop-blur">
        <div className="flex h-full w-full flex-col items-center justify-center">
          <ClientOnly className="relative flex w-full flex-col items-center justify-center">
            <Suspense>{children}</Suspense>
          </ClientOnly>
        </div>

        <div className="grid gap-2 pb-8 pt-4">
          <p className="text-xs text-neutral-600">
            © {new Date().getFullYear()} RefList, Inc.
          </p>
          <div className="flex gap-3 text-center text-xs text-neutral-500 underline underline-offset-2">
            <a
              href="https://dub.co/legal/privacy"
              target="_blank"
              className="hover:text-neutral-800"
            >
              Privacy Policy
            </a>
            <a
              href="https://dub.co/legal/terms"
              target="_blank"
              className="hover:text-neutral-800"
            >
              Terms of Service
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
