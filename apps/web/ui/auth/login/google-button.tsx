import { Button } from "@dub/ui";
import { Google } from "@dub/ui/icons";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useContext } from "react";
import { LoginFormContext } from "./login-form";

export function GoogleButton({ next }: { next?: string }) {
  const searchParams = useSearchParams();
  const finalNext = next ?? searchParams?.get("next");
  
  // Determine the correct callback URL for development mode
  const getCallbackUrl = () => {
    if (!finalNext || finalNext.length === 0) return undefined;
    
    // In development mode, make sure URLs are properly formatted for local environment
    if (process.env.NODE_ENV === 'development') {
      // If it's an absolute URL to the production environment, convert to local
      if (finalNext.startsWith('https://app.thereflist.com')) {
        return finalNext.replace('https://app.thereflist.com', 'http://localhost:8888/app.thereflist.com');
      }
      // If it's a relative URL, prefix with the app subdomain path
      if (finalNext.startsWith('/') && !finalNext.startsWith('/app.thereflist.com')) {
        return `/app.thereflist.com${finalNext}`;
      }
    }
    return finalNext;
  };

  const { setClickedMethod, clickedMethod, setLastUsedAuthMethod } =
    useContext(LoginFormContext);

  return (
    <Button
      text="Continue with Google"
      variant="secondary"
      onClick={() => {
        setClickedMethod("google");
        setLastUsedAuthMethod("google");
        signIn("google", {
          callbackUrl: getCallbackUrl(),
        });
      }}
      loading={clickedMethod === "google"}
      disabled={clickedMethod && clickedMethod !== "google"}
      icon={<Google className="size-4" />}
    />
  );
}
