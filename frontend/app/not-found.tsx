import { SearchBox } from "@/components/search";
import Link from "next/link";
export default function NotFound() {
  return (
    <div className="page">
      <div className="state empty">
        <h1>A little beyond the map.</h1>
        <p>
          This page does not exist. Search the library or research a new
          subject.
        </p>
        <SearchBox large />
        <Link className="button primary" href="/explore">
          Return to the encyclopedia
        </Link>
      </div>
    </div>
  );
}
