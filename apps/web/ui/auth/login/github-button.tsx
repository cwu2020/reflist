import { Button, Github } from "@dub/ui";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useContext } from "react";
import { LoginFormContext } from "./login-form";

export const GitHubButton = () => {
  const searchParams = useSearchParams();
  const next = searchParams?.get("next");

  // Determine the correct callback URL for development mode
  const getCallbackUrl = () => {
    if (!next || next.length === 0) return undefined;
    
    // In development mode, make sure URLs are properly formatted for local environment
    if (process.env.NODE_ENV === 'development') {
      // If it's an absolute URL to the production environment, convert to local
      if (next.startsWith('https://app.thereflist.com')) {
        return next.replace('https://app.thereflist.com', 'http://localhost:8888/app.thereflist.com');
      }
      // If it's a relative URL, prefix with the app subdomain path
      if (next.startsWith('/') && !next.startsWith('/app.thereflist.com')) {
        return `/app.thereflist.com${next}`;
      }
    }
    return next;
  };

  const { setClickedMethod, clickedMethod, setLastUsedAuthMethod } =
    useContext(LoginFormContext);

  return (
    <Button
      text="Continue with Github"
      variant="secondary"
      onClick={() => {
        setClickedMethod("github");
        setLastUsedAuthMethod("github");
        signIn("github", {
          callbackUrl: getCallbackUrl(),
        });
      }}
      loading={clickedMethod === "github"}
      disabled={clickedMethod && clickedMethod !== "github"}
      icon={<Github className="size-4 text-black" />}
    />
  );
};
