import { Footer, Nav, NavMobile } from "@dub/ui";
import { NewBackground } from "@/ui/shared/new-background";
import Toolbar from "@/ui/layout/toolbar/toolbar";

export default function CustomDomainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col justify-between bg-neutral-50/80">
      <NavMobile />
      <Nav maxWidthWrapperClassName="max-w-screen-lg lg:px-4 xl:px-0" />
        <>
        <NewBackground />
        {children}
        <Toolbar show={["help"]} />
      </>
      <Footer className="max-w-screen-lg border-0 bg-transparent lg:px-4 xl:px-0" />
    </div>
  );
}
