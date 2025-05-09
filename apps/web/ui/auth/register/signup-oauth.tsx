"use client";

import { Button, Github, Google } from "@dub/ui";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export const SignUpOAuth = ({
  methods,
}: {
  methods: ("email" | "google" | "github")[];
}) => {
  const searchParams = useSearchParams();
  const next = searchParams?.get("next");
  const [clickedGoogle, setClickedGoogle] = useState(false);
  const [clickedGithub, setClickedGithub] = useState(false);

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

  useEffect(() => {
    // when leave page, reset state
    return () => {
      setClickedGoogle(false);
      setClickedGithub(false);
    };
  }, []);

  return (
    <>
      {methods.includes("google") && (
        <Button
          variant="secondary"
          text="Continue with Google"
          onClick={() => {
            setClickedGoogle(true);
            signIn("google", {
              callbackUrl: getCallbackUrl(),
            });
          }}
          loading={clickedGoogle}
          icon={<Google className="h-4 w-4" />}
        />
      )}
      {methods.includes("github") && (
        <Button
          variant="secondary"
          text="Continue with GitHub"
          onClick={() => {
            setClickedGithub(true);
            signIn("github", {
              callbackUrl: getCallbackUrl(),
            });
          }}
          loading={clickedGithub}
          icon={<Github className="h-4 w-4" />}
        />
      )}
    </>
  );
};
