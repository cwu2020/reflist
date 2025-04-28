import WorkspaceAuth from "app/app.thereflist.com/(dashboard)/[slug]/auth";
import { ReactNode } from "react";

export default function NewProgramWorkspaceLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <WorkspaceAuth>{children}</WorkspaceAuth>;
}
