import useWorkspace from "@/lib/swr/use-workspace";
import { Grid, useLocalStorage } from "@dub/ui";
import { LinkBroken } from "@dub/ui/icons";
import { useRegisterDomainModal } from "../modals/register-domain-modal";
import { X } from "../shared/icons";
import { Button } from "@dub/ui";
import { Star } from "lucide-react";
import Link from "next/link";

// Temporarily disabled for regular users, but kept for future brand partner use
export function FreeDotLinkBanner() {
  // Return null to hide the banner
  return null;

  /* Original implementation kept for future use
  return (
    <div className="flex items-center justify-between rounded-lg border border-neutral-200 bg-neutral-50 p-4">
      <div className="flex items-center gap-2">
        <Star className="h-4 w-4 text-neutral-600" />
        <p className="text-sm text-neutral-600">
          Get a free <span className="font-mono">.link</span> domain for your short links
        </p>
      </div>
      <Link
        href="/settings/domains"
        className="text-sm text-neutral-600 underline underline-offset-4 hover:text-neutral-800"
      >
        Learn more
      </Link>
    </div>
  );
  */
}
