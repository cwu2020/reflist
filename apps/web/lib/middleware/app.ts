import { parse } from "@/lib/middleware/utils";
import { NextRequest, NextResponse } from "next/server";
import EmbedMiddleware from "./embed";
import NewLinkMiddleware from "./new-link";
import { appRedirect } from "./utils/app-redirect";
import { getDefaultWorkspace } from "./utils/get-default-workspace";
import { getOnboardingStep } from "./utils/get-onboarding-step";
import { getUserViaToken } from "./utils/get-user-via-token";
import { isTopLevelSettingsRedirect } from "./utils/is-top-level-settings-redirect";
import WorkspacesMiddleware from "./workspaces";

export default async function AppMiddleware(req: NextRequest) {
  const { path, fullPath, searchParamsString } = parse(req);

  // Check if we're in local development mode
  const host = req.headers.get("host") || "";
  const isLocalhost = host.includes("localhost");

  const user = await getUserViaToken(req);
  const isWorkspaceInvite =
    req.nextUrl.searchParams.get("invite") || path.startsWith("/invites/");

  // if there's no user and the path isn't /login or /register, redirect to /login
  if (
    !user &&
    path !== "/login" &&
    path !== "/forgot-password" &&
    path !== "/register" &&
    path !== "/auth/saml" &&
    path !== "/claim" &&
    !path.startsWith("/auth/reset-password/") &&
    !path.startsWith("/share/") &&
    !(isLocalhost && path === "/app.thereflist.com/login")
  ) {
    // In development mode, use the correct path for login
    const loginPath = isLocalhost
      ? `/app.thereflist.com/login${path === "/" ? "" : `?next=${encodeURIComponent(fullPath)}`}`
      : `/login${path === "/" ? "" : `?next=${encodeURIComponent(fullPath)}`}`;
      
    return NextResponse.redirect(new URL(loginPath, req.url));

    // if there's a user
  } else if (user) {
    // /new is a special path that creates a new link (or workspace if the user doesn't have one yet)
    if (path === "/new") {
      return NewLinkMiddleware(req, user);

      /* Onboarding redirects

        - User was created less than a day ago
        - User is not invited to a workspace (redirect straight to the workspace)
        - The path does not start with /onboarding
        - The user has not completed the onboarding step
      */
    } else if (
      new Date(user.createdAt).getTime() > Date.now() - 60 * 60 * 24 * 1000 &&
      !isWorkspaceInvite &&
      !["/onboarding", "/account"].some((p) => path.startsWith(p)) &&
      !(await getDefaultWorkspace(user)) &&
      (await getOnboardingStep(user)) !== "completed"
    ) {
      let step = await getOnboardingStep(user);
      if (!step) {
        // For new creator-focused flow, start with link creation (skip workspace)
        return NextResponse.redirect(new URL("/onboarding/link", req.url));
      } else if (step === "completed") {
        return WorkspacesMiddleware(req, user);
      }

      const defaultWorkspace = await getDefaultWorkspace(user);

      if (defaultWorkspace) {
        // Skip workspace step for all users since they now get a personal workspace automatically
        step = step === "workspace" ? "link" : step;
        return NextResponse.redirect(
          new URL(`/onboarding/${step}?workspace=${defaultWorkspace}`, req.url),
        );
      } else {
        // If somehow they don't have a default workspace, send them to link step
        // This should rarely happen with auto-creation of personal workspaces
        return NextResponse.redirect(new URL("/onboarding/link", req.url));
      }

      // Special handling for /claim path
    } else if (path === "/claim") {
      // Rewrite to the claim page instead of treating it as a workspace
      console.log(`User ${user.id} accessing /claim - rewriting to claim page`);
      return NextResponse.rewrite(new URL("/app.thereflist.com/claim", req.url));

      // if the path is / or /login or /register, redirect to the default workspace
    } else if (
      [
        "/",
        "/login",
        "/register",
        "/workspaces",
        "/links",
        "/analytics",
        "/events",
        "/programs",
        "/settings",
        "/upgrade",
        "/wrapped",
      ].includes(path) ||
      path.startsWith("/settings/") ||
      isTopLevelSettingsRedirect(path)
    ) {
      return WorkspacesMiddleware(req, user);
    } else if (appRedirect(path)) {
      return NextResponse.redirect(
        new URL(`${appRedirect(path)}${searchParamsString}`, req.url),
      );
    }
  }

  // otherwise, rewrite the path to /app
  // Always rewrite to the app subdomain path structure
  // For localhost, avoid double-prefixing the path
  if (isLocalhost && path.startsWith("/app.thereflist.com")) {
    return NextResponse.rewrite(new URL(path, req.url));
  }
  return NextResponse.rewrite(new URL(`/app.thereflist.com${fullPath}`, req.url));
}
