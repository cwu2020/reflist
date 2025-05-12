"use client";

import { AnimatedSizeContainer, useLocalStorage } from "@dub/ui";
import { useSearchParams } from "next/navigation";
import {
  ComponentType,
  Dispatch,
  SetStateAction,
  createContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { EmailSignIn } from "./email-sign-in";
import { GitHubButton } from "./github-button";
import { GoogleButton } from "./google-button";
import { SSOSignIn } from "./sso-sign-in";

export const authMethods = [
  "google",
  "github",
  "email",
  "saml",
  "password",
] as const;

export type AuthMethod = (typeof authMethods)[number];

export const errorCodes = {
  "no-credentials": "Please provide an email and password.",
  "invalid-credentials": "Email or password is incorrect.",
  "exceeded-login-attempts":
    "Account has been locked due to too many login attempts. Please contact support to unlock your account.",
  "too-many-login-attempts": "Too many login attempts. Please try again later.",
  "email-not-verified": "Please verify your email address.",
  "framer-account-linking-not-allowed":
    "It looks like you already have an account with us. Please sign in with your Framer account email instead.",
  Callback:
    "We encountered an issue processing your request. Please try again or contact support if the problem persists.",
  OAuthSignin:
    "There was an issue signing you in. Please ensure your provider settings are correct.",
  OAuthCallback:
    "We faced a problem while processing the response from the OAuth provider. Please try again.",
};

export const LoginFormContext = createContext<{
  authMethod: AuthMethod | undefined;
  setAuthMethod: Dispatch<SetStateAction<AuthMethod | undefined>>;
  clickedMethod: AuthMethod | undefined;
  showPasswordField: boolean;
  showSSOOption: boolean;
  setShowPasswordField: Dispatch<SetStateAction<boolean>>;
  setClickedMethod: Dispatch<SetStateAction<AuthMethod | undefined>>;
  setLastUsedAuthMethod: Dispatch<SetStateAction<AuthMethod | undefined>>;
  setShowSSOOption: Dispatch<SetStateAction<boolean>>;
}>({
  authMethod: undefined,
  setAuthMethod: () => {},
  clickedMethod: undefined,
  showPasswordField: false,
  showSSOOption: false,
  setShowPasswordField: () => {},
  setClickedMethod: () => {},
  setLastUsedAuthMethod: () => {},
  setShowSSOOption: () => {},
});

export default function LoginForm({
  methods = [...authMethods],
  next,
}: {
  methods?: AuthMethod[];
  next?: string;
}) {
  const searchParams = useSearchParams();
  const [showPasswordField, setShowPasswordField] = useState(false);
  const [showSSOOption, setShowSSOOption] = useState(false);
  const [clickedMethod, setClickedMethod] = useState<AuthMethod | undefined>(
    undefined,
  );

  // Check for users coming from the claim process
  const phoneNumber = searchParams?.get("phoneNumber");
  const fromClaim = searchParams?.get("claim") === "true";

  const [lastUsedAuthMethodLive, setLastUsedAuthMethod] = useLocalStorage<
    AuthMethod | undefined
  >("last-used-auth-method", undefined);
  const { current: lastUsedAuthMethod } = useRef<AuthMethod | undefined>(
    lastUsedAuthMethodLive,
  );

  // For claim process, prioritize email method
  const defaultMethod = fromClaim ? "email" : 
    authMethods.find((m) => m === lastUsedAuthMethodLive) ?? "email";

  const [authMethod, setAuthMethod] = useState<AuthMethod | undefined>(defaultMethod);

  useEffect(() => {
    const error = searchParams?.get("error");
    if (error) {
      toast.error(
        errorCodes[error] ||
          "An unexpected error occurred. Please try again later.",
      );
    }
  }, [searchParams]);

  // Reset the state when leaving the page
  useEffect(() => () => setClickedMethod(undefined), []);

  // For users coming from claim process, only show email option
  const effectiveMethods = fromClaim ? ["email"] : methods;

  const authProviders: {
    method: AuthMethod;
    component: ComponentType;
    props?: Record<string, unknown>;
  }[] = [
    {
      method: "google",
      component: GoogleButton,
      props: { next },
    },
    // {
    //   method: "github",
    //   component: GitHubButton,
    // },
    {
      method: "email",
      component: EmailSignIn,
      props: { next },
    },
    // {
    //   method: "saml",
    //   component: SSOSignIn,
    // },
  ];

  const currentAuthProvider = authProviders.find(
    (provider) => provider.method === authMethod,
  );

  const AuthMethodComponent = currentAuthProvider?.component;

  const showEmailPasswordOnly = authMethod === "email" && showPasswordField;

  return (
    <LoginFormContext.Provider
      value={{
        authMethod,
        setAuthMethod,
        clickedMethod,
        showPasswordField,
        showSSOOption,
        setShowPasswordField,
        setClickedMethod,
        setLastUsedAuthMethod,
        setShowSSOOption,
      }}
    >
      {fromClaim && (
        <div className="mb-4 rounded-md bg-blue-50 p-3 text-sm text-blue-700 border border-blue-100">
          <p className="font-medium mb-1">Signing in to claim your earnings</p>
          <p>
            Sign in with your existing account to associate it with your verified phone number 
            and claim your earnings.
          </p>
        </div>
      )}
      
      <div className="flex flex-col gap-3">
        <AnimatedSizeContainer height>
          <div className="flex flex-col gap-3 p-1">
            {authMethod && (
              <div className="flex flex-col gap-2">
                {AuthMethodComponent && (
                  <AuthMethodComponent {...currentAuthProvider?.props} />
                )}

                {!showEmailPasswordOnly &&
                  authMethod === lastUsedAuthMethod && 
                  !fromClaim && (
                    <div className="text-center text-xs">
                      <span className="text-neutral-500">
                        You signed in with{" "}
                        {lastUsedAuthMethod.charAt(0).toUpperCase() +
                          lastUsedAuthMethod.slice(1)}{" "}
                        last time
                      </span>
                    </div>
                  )}
                
                {!fromClaim && (
                  <div className="my-2 flex flex-shrink items-center justify-center gap-2">
                    <div className="grow basis-0 border-b border-neutral-300" />
                    <span className="text-xs font-normal uppercase leading-none text-neutral-500">
                      or
                    </span>
                    <div className="grow basis-0 border-b border-neutral-300" />
                  </div>
                )}
              </div>
            )}

            {showEmailPasswordOnly ? (
              !fromClaim && (
                <div className="mt-2 text-center text-sm text-neutral-500">
                  <button
                    type="button"
                    onClick={() => setShowPasswordField(false)}
                    className="font-semibold text-neutral-500 transition-colors hover:text-black"
                  >
                    Continue with another method
                  </button>
                </div>
              )
            ) : (
              !fromClaim && authProviders
                .filter(
                  (provider) =>
                    provider.method !== authMethod &&
                    effectiveMethods.includes(provider.method),
                )
                .map((provider) => (
                  <div key={provider.method}>
                    <provider.component />
                  </div>
                ))
            )}
          </div>
        </AnimatedSizeContainer>
      </div>
    </LoginFormContext.Provider>
  );
}
