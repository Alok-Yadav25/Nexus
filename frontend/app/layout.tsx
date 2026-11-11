import { cookies, headers } from "next/headers";
import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import { Shell } from "@/components/shell";
import "@fontsource-variable/geist";
import "@fontsource-variable/manrope";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";
export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL || "http://localhost:3000"),
  title: {
    default: "NEXUS — A universe of connected knowledge",
    template: "%s · NEXUS",
  },
  description:
    "Explore an evidence-driven encyclopedia. Follow connections, inspect sources, and research new ideas.",
};
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const saved = (await cookies()).get("nexus-theme")?.value;
  const nonce = (await headers()).get("x-nonce") || undefined;
  const theme = saved === "light" || saved === "dark" ? saved : undefined;
  const initialize = `(function(){var t=${JSON.stringify(theme || null)};if(!t){try{t=localStorage.getItem('nexus-theme')}catch(e){}if(t!=='light'&&t!=='dark')t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'}document.documentElement.dataset.theme=t})()`;
  return (
    <html
      lang="en"
      data-theme={theme}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: initialize }}
        />
      </head>
      <body>
        <Providers>
          <Shell>{children}</Shell>
        </Providers>
      </body>
    </html>
  );
}
