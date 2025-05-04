import { Footer, MaxWidthWrapper, Nav, NavMobile } from "@dub/ui";
import Toolbar from "@/ui/layout/toolbar/toolbar";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col justify-between bg-neutral-50/80">
      <NavMobile />
      <Nav maxWidthWrapperClassName="max-w-screen-lg lg:px-4 xl:px-0" />
      <main className="grow">
        <MaxWidthWrapper className="mt-10 max-w-4xl">
          <div className="rounded-lg border border-neutral-200 bg-white p-8 shadow-sm">
            {children}
          </div>
        </MaxWidthWrapper>
      </main>
      <Toolbar show={["help"]} />
      <Footer className="max-w-screen-lg border-0 bg-transparent lg:px-4 xl:px-0" />
    </div>
  );
} 