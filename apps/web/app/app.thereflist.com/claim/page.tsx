import { Nav, NavMobile } from "@dub/ui";
import PhoneVerificationPageClient from "./page-client";
import ParamPersistClient from "./param-persist-client";

export const metadata = {
  title: "Claim Your Commissions - Reflist",
  description: "Verify your phone number to claim commissions earned from referrals.",
};

export default function ClaimPage() {
  return (
    <>
      <Nav maxWidthWrapperClassName="max-w-screen-lg lg:px-4 xl:px-0" />
      <NavMobile />
      <ParamPersistClient />
      <PhoneVerificationPageClient />
    </>
  );
} 