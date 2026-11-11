import type { Metadata } from "next";
import { JourneyWorkspace } from "@/components/journey-workspace";
import { ScientificWorkspace } from "@/components/scientific-workspace";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import {
  Explore,
  SearchResults,
  Discover,
  GraphPage,
  PathDiscovery,
  Evidence,
  Timeline,
  Compare,
} from "@/components/workspaces";
import { ResearchLab, ResearchJob } from "@/components/research-workspace";
import {
  Auth,
  Dashboard,
  Collections,
  Admin,
} from "@/components/account-workspaces";
import { Information } from "@/components/information";
import { Loading } from "@/components/ui";
import { ContentMotionBoundary } from "@/components/content-motion";
import { WikipediaReader } from "@/components/encyclopedia-workspace";
import { ReadingList } from "@/components/reading-workspace";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ segments: string[] }>;
}): Promise<Metadata> {
  const { segments } = await params;
  const privatePage = [
    "auth",
    "dashboard",
    "collections",
    "research",
    "admin",
    "settings",
    "editor",
    "knowledge-maps",
    "read",
    "reading-list",
    "search",
  ].includes(segments[0]);
  return {
    title: segments[0].replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase()),
    robots: privatePage ? { index: false, follow: false } : undefined,
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ segments: string[] }>;
}) {
  const { segments: s } = await params;
  const path = s.join("/");
  let content;
  if (path === "journeys") content = <JourneyWorkspace />;
  else if (path === "labs" || path === "labs/planet")
    content = <ScientificWorkspace kind="planet" />;
  else if (path === "labs/molecule")
    content = <ScientificWorkspace kind="molecule" />;
  else if (path === "explore") content = <Explore />;
  else if (path === "search") content = <SearchResults />;
  else if (path === "reading-list") content = <ReadingList />;
  else if (path === "read/wikipedia") content = <WikipediaReader />;
  else if (path === "discover") content = <Discover />;
  else if (path === "discover/path") content = <PathDiscovery />;
  else if (s[0] === "graph" && s.length <= 2)
    content = <GraphPage entityId={s[1]} />;
  else if (s[0] === "evidence" && s.length === 2)
    content = <Evidence claimId={s[1]} />;
  else if (s[0] === "timeline" && s.length === 2)
    content = <Timeline entityId={s[1]} />;
  else if (path === "compare") content = <Compare />;
  else if (path === "research") content = <ResearchLab />;
  else if (s[0] === "research" && s.length === 2)
    content = <ResearchJob jobId={s[1]} />;
  else if (s[0] === "collections" && s.length <= 2)
    content = <Collections collectionId={s[1]} />;
  else if (path === "dashboard") content = <Dashboard />;
  else if (
    s[0] === "admin" &&
    s.length <= 2 &&
    (!s[1] || ["reviews", "quality", "analytics"].includes(s[1]))
  )
    content = <Admin section={s[1]} />;
  else if (s[0] === "auth" && s.length <= 2) content = <Auth />;
  else if (["about", "methodology", "documentation"].includes(path))
    content = <Information kind={path} />;
  else notFound();
  return (
    <Suspense fallback={<Loading />}>
      <ContentMotionBoundary key={path}>{content}</ContentMotionBoundary>
    </Suspense>
  );
}
