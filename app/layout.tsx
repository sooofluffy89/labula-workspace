import {ViewportSize} from "@/components/viewport-size";
import type { Metadata } from "next";
import "./globals.css";
import "./ux.css";
import "./workspace-v2.css";
import "./today-workspace.css";
import "./menu-workspace.css";
import "./composition-workspace.css";
import {ProfileProvider} from "./profile";
import {AccessBoundary} from "./access-boundary";
import {getChatGPTUser} from "./chatgpt-auth";
export const metadata: Metadata = { title: "Workspace 2.0", description: "Evening checks, morning preparation and the shared menu for the LABULA kitchen.", robots: { index: false, follow: false }, icons: { icon: "/favicon.svg" } };
export default async function RootLayout({ children }: Readonly<{children: React.ReactNode}>) { const user=await getChatGPTUser();return <html lang="en"><body><ViewportSize/><AccessBoundary key={user?.userId??"anonymous"} userId={user?.userId}><ProfileProvider key={user?.userId??"anonymous"} userId={user?.userId}>{children}</ProfileProvider></AccessBoundary></body></html>; }
