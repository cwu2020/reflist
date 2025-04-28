import { UserProps } from "@/lib/types";
import { NextRequest, NextResponse } from "next/server";
import { parse } from "./utils";
import { getDefaultWorkspace } from "./utils/get-default-workspace";
import { isTopLevelSettingsRedirect } from "./utils/is-top-level-settings-redirect";

export default async function WorkspacesMiddleware(
  req: NextRequest,
  user: UserProps,
) {
  const { path, searchParamsObj, searchParamsString } = parse(req);

  // special case for handling ?next= query param
  if (searchParamsObj.next) {
    return NextResponse.redirect(new URL(searchParamsObj.next, req.url));
  }

  try {
    // Get the default workspace for this user
    const defaultWorkspace = await getDefaultWorkspace(user);
    console.log(`WorkspacesMiddleware: Default workspace for user ${user.id} is ${defaultWorkspace}`);

    // If no default workspace is found (rare case since we now create automatically)
    if (!defaultWorkspace) {
      console.log(`No default workspace found for user ${user.id}, redirecting to onboarding`);
      // For creator-focused flow, redirect to link onboarding step directly
      return NextResponse.redirect(new URL(`/onboarding/link`, req.url));
    }

    // If user has a default workspace, redirect there
    if (path === "/" || path === "/login" || path === "/register") {
      console.log(`Redirecting user ${user.id} to default workspace: ${defaultWorkspace}`);
      return NextResponse.redirect(new URL(`/${defaultWorkspace}`, req.url));
    }

    let redirectPath = path;
    if (["/workspaces", "/links", "/analytics", "/events", "/programs", "/settings", "/upgrade", "/wrapped"].includes(path)) {
      redirectPath = path === "/workspaces" ? "" : path;
    } else if (isTopLevelSettingsRedirect(path)) {
      redirectPath = `/settings${path}`;
    }

    // Redirecting to home page with default workspace
    console.log(`Redirecting user ${user.id} to path: /${defaultWorkspace}${redirectPath}${searchParamsString}`);
    return NextResponse.redirect(
      new URL(`/${defaultWorkspace}${redirectPath}${searchParamsString}`, req.url),
    );
  } catch (error) {
    console.error("Error in WorkspacesMiddleware:", error);
    // Handle errors gracefully - redirect to homepage as fallback
    return NextResponse.redirect(new URL("/", req.url));
  }
}
