import { Home } from "@/components/workspaces";
import { ContentMotionBoundary } from "@/components/content-motion";
export default function Page() {
  return (
    <ContentMotionBoundary>
      <Home />
    </ContentMotionBoundary>
  );
}
