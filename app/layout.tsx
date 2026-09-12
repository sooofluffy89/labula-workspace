import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Lá Bù Lá · Kitchen recipes", description: "Recipes, shared ingredients and preparation notes for the Lá Bù Lá kitchen.", robots: { index: false, follow: false }, icons: { icon: "/favicon.svg" } };
export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) { return <html lang="en"><body>{children}</body></html>; }
