import type { Metadata } from "next";
import "./globals.css";
import {AccessBoundary} from "./access-boundary";
import {getChatGPTUser} from "./chatgpt-auth";
export const metadata: Metadata = { title: "Lá Bù Lá · Kitchen recipes", description: "Recipes, shared ingredients and preparation notes for the Lá Bù Lá kitchen.", robots: { index: false, follow: false }, icons: { icon: "/favicon.svg" } };
export default async function RootLayout({ children }: Readonly<{children: React.ReactNode}>) { const user=await getChatGPTUser();return <html lang="en"><body><AccessBoundary key={user?.userId??"anonymous"} userId={user?.userId}>{children}</AccessBoundary></body></html>; }
