from typing import TypedDict, Any
from urllib.parse import urlencode, quote
from datetime import datetime, timezone
from uuid import uuid5, NAMESPACE_URL
import json
import re
import xml.etree.ElementTree as ET
from langgraph.graph import StateGraph, START, END
from .security import SafeFetcher
from .llm import synthesize
from bs4 import BeautifulSoup
from urllib.parse import urljoin

STAGES = [
    "CLASSIFYING",
    "PLANNING",
    "RESEARCHING",
    "SOURCE_EVALUATION",
    "CLAIM_EXTRACTION",
    "VERIFICATION",
    "ARTICLE_GENERATION",
    "CITATION_AUDIT",
    "GRAPH_EXTRACTION",
    "MEDIA_PROCESSING",
    "VALIDATION",
]


class State(TypedDict, total=False):
    job_id: str
    topic: str
    ontology: str
    canonical_id: str
    stage: str
    questions: list[str]
    sources: list[dict[str, Any]]
    claims: list[dict[str, Any]]
    warnings: list[str]
    draft: dict[str, Any]
    triples: list[dict[str, Any]]
    media: list[dict[str, Any]]
    provider_usage: dict[str, Any]


fetcher = SafeFetcher()


def extract_claims(sources, topic):
    claims = []
    seen = set()
    for source in sources:
        for sentence in re.split(r"(?<=[.!?])\s+", source["text"]):
            sentence = " ".join(sentence.split()).strip()
            if not 40 <= len(sentence) <= 700 or sentence in seen:
                continue
            if any(
                x in sentence.lower()
                for x in (
                    "ignore previous",
                    "system prompt",
                    "api key",
                    "<script",
                    "follow these instructions",
                )
            ):
                continue
            seen.add(sentence)
            claims.append(
                {
                    "id": str(uuid5(NAMESPACE_URL, source["url"] + "#" + sentence)),
                    "text": sentence,
                    "subject": topic,
                    "predicate": "described as",
                    "object": sentence,
                    "status": "UNVERIFIED",
                    "rationale": "Source excerpt; independent verification is not established. Reviewer inspection required.",
                    "evidence": [
                        {
                            "sourceId": source["id"],
                            "excerpt": sentence,
                            "stance": "SUPPORTS",
                        }
                    ],
                }
            )
            if len(claims) >= 40:
                return claims
    return claims


def harvest(topic):
    sources = []
    warnings = []
    query = urlencode(
        {
            "action": "query",
            "format": "json",
            "generator": "search",
            "gsrsearch": topic,
            "gsrlimit": 3,
            "prop": "extracts|info",
            "explaintext": 1,
            "exintro": 1,
            "inprop": "url",
        }
    )
    try:
        raw, _ = fetcher.get("https://en.wikipedia.org/w/api.php?" + query)
        for page in json.loads(raw).get("query", {}).get("pages", {}).values():
            text = page.get("extract", "").strip()[:10000]
            if not text:
                continue
            url = page.get(
                "fullurl",
                "https://en.wikipedia.org/wiki/"
                + quote(page["title"].replace(" ", "_")),
            )
            sources.append(
                {
                    "id": str(uuid5(NAMESPACE_URL, url)),
                    "url": url,
                    "title": page["title"],
                    "publisher": "Wikipedia contributors",
                    "sourceType": "SECONDARY",
                    "publishedAt": None,
                    "retrievedAt": datetime.now(timezone.utc).isoformat(),
                    "license": "CC BY-SA 4.0; attribution and share-alike apply",
                    "text": text,
                    "independenceGroup": "wikipedia",
                }
            )
    except Exception as exc:
        warnings.append("Wikipedia unavailable: " + type(exc).__name__)
    try:
        raw, _ = fetcher.get(
            "https://export.arxiv.org/api/query?"
            + urlencode(
                {
                    "search_query": "all:" + topic,
                    "max_results": 3,
                    "sortBy": "relevance",
                }
            )
        )
        ns = {"a": "http://www.w3.org/2005/Atom"}
        for entry in ET.fromstring(raw).findall("a:entry", ns):
            url = entry.findtext("a:id", "", ns).replace("http://", "https://")
            if not url.startswith("https://arxiv.org/abs/"):
                continue
            sources.append(
                {
                    "id": str(uuid5(NAMESPACE_URL, url)),
                    "url": url,
                    "title": " ".join(entry.findtext("a:title", "", ns).split()),
                    "publisher": "arXiv",
                    "authors": [x.text for x in entry.findall("a:author/a:name", ns)],
                    "sourceType": "PREPRINT",
                    "publishedAt": entry.findtext("a:published", "", ns)[:10] or None,
                    "retrievedAt": datetime.now(timezone.utc).isoformat(),
                    "license": "See original paper for reuse conditions",
                    "text": " ".join(entry.findtext("a:summary", "", ns).split()),
                    "independenceGroup": url,
                }
            )
    except Exception as exc:
        warnings.append("arXiv unavailable: " + type(exc).__name__)
    if not sources:
        try:
            title = topic[0].upper() + topic[1:]
            raw, url = fetcher.get(
                "https://en.wikipedia.org/wiki/" + quote(title.replace(" ", "_"))
            )
            soup = BeautifulSoup(raw, "html.parser")
            for element in soup.select(
                "script,style,sup.reference,nav,.navbox,.sidebar"
            ):
                element.decompose()
            paragraphs = soup.select(".mw-parser-output p") or soup.select("main p")
            text = " ".join(
                p.get_text(" ", strip=True)
                for p in paragraphs
                if len(p.get_text(strip=True)) > 80
            )[:10000]
            if not text:
                raise ValueError("Article has no extractable prose")
            page_title = soup.select_one("h1")
            sources.append(
                {
                    "id": str(uuid5(NAMESPACE_URL, url)),
                    "url": url,
                    "title": page_title.get_text(" ", strip=True)
                    if page_title
                    else title,
                    "publisher": "Wikipedia contributors",
                    "sourceType": "SECONDARY",
                    "publishedAt": None,
                    "retrievedAt": datetime.now(timezone.utc).isoformat(),
                    "license": "CC BY-SA 4.0; attribution and share-alike apply",
                    "text": text,
                    "independenceGroup": "wikipedia",
                }
            )
            references = []
            for link in soup.select("a[href]"):
                target = urljoin(url, link["href"]).replace(
                    "http://arxiv.org", "https://arxiv.org"
                )
                if (
                    target.startswith("https://arxiv.org/abs/")
                    and target not in references
                ):
                    references.append(target)
            for target in references[:2]:
                try:
                    paper_raw, paper_url = fetcher.get(target)
                    paper = BeautifulSoup(paper_raw, "html.parser")
                    abstract = paper.select_one("blockquote.abstract")
                    if not abstract:
                        continue
                    if abstract.select_one(".descriptor"):
                        abstract.select_one(".descriptor").decompose()
                    paper_text = " ".join(abstract.get_text(" ", strip=True).split())
                    meta = paper.select_one('meta[name="citation_title"]')
                    date_meta = paper.select_one('meta[name="citation_date"]')
                    published = (
                        date_meta.get("content", "").replace("/", "-")[:10]
                        if date_meta
                        else None
                    )
                    sources.append(
                        {
                            "id": str(uuid5(NAMESPACE_URL, paper_url)),
                            "url": paper_url,
                            "title": meta["content"] if meta else target,
                            "publisher": "arXiv",
                            "sourceType": "PREPRINT",
                            "publishedAt": published,
                            "retrievedAt": datetime.now(timezone.utc).isoformat(),
                            "license": "See original paper for reuse conditions",
                            "text": paper_text,
                            "independenceGroup": paper_url,
                        }
                    )
                except Exception as exc:
                    warnings.append("Linked paper unavailable: " + type(exc).__name__)
        except Exception as exc:
            warnings.append("Permitted article fallback unavailable: " + str(exc)[:160])
    return sources, warnings


def audit(state):
    sources = {s["id"]: s for s in state["sources"]}
    if not state.get("claims"):
        raise ValueError("Draft requires claims")
    for claim in state["claims"]:
        if not claim.get("evidence"):
            raise ValueError("Missing evidence")
        for evidence in claim["evidence"]:
            source = sources.get(evidence["sourceId"])
            if (
                not source
                or evidence["excerpt"] not in source["text"]
                or claim["text"] not in evidence["excerpt"]
            ):
                raise ValueError("Citation integrity failure")


def node(stage):
    def run(state):
        result = {"stage": stage}
        if stage == "CLASSIFYING":
            result.update(
                ontology=state.get("ontology", "UNCLASSIFIED"),
                warnings=["Proposed ontology requires reviewer confirmation."],
            )
        elif stage == "PLANNING":
            result["questions"] = [
                f"How is {state['topic']} defined?",
                f"What primary evidence supports {state['topic']}?",
                "What limitations and disagreements are documented?",
            ]
        elif stage == "RESEARCHING":
            topic=state["topic"]
            canonical=state.get("canonical_id", "")
            if canonical:
                from .sources import canonical_title
                topic=canonical_title(canonical)
            sources, warnings = harvest(topic)
            if not sources:
                raise ValueError("No permitted source retrieved; no article generated")
            result.update(
                sources=sources, warnings=state.get("warnings", []) + warnings
            )
        elif stage == "SOURCE_EVALUATION":
            result["sources"] = [
                dict(
                    s,
                    evaluation={
                        "independenceGroup": s["independenceGroup"],
                        "limitation": "Preprint; peer review not established"
                        if s["sourceType"] == "PREPRINT"
                        else "Secondary reference; primary evidence needed",
                    },
                )
                for s in state["sources"]
            ]
        elif stage == "CLAIM_EXTRACTION":
            result["claims"] = extract_claims(state["sources"], state["topic"])
            if not result["claims"]:
                raise ValueError("No citable excerpt extracted")
        elif stage == "VERIFICATION":
            status = (
                "FICTIONAL_CANON"
                if state["ontology"] in ("FictionalEntity", "FictionalLocation")
                else "THEORETICAL_MODEL"
                if state["ontology"] == "HypotheticalTechnology"
                else "UNVERIFIED"
            )
            result["claims"] = [dict(c, status=status) for c in state["claims"]]
            result["warnings"] = state.get("warnings", []) + [
                "Source statements are not independent verification.",
                "Verification status still requires source inspection and human review.",
            ]
        elif stage == "ARTICLE_GENERATION":
            result["draft"] = {
                "title": state["topic"],
                "summary": state["claims"][0]["text"],
                "method": "EXTRACTIVE",
                "content": {
                    "schemaVersion": 1,
                    "sections": [
                        {
                            "id": "overview",
                            "title": "Source-backed research notes",
                            "claims": [c["id"] for c in state["claims"]],
                        }
                    ],
                    "attributes": {},
                },
            }
            synthesis, usage = synthesize(state["topic"], state["claims"])
            result["provider_usage"] = usage
            if synthesis:
                result["draft"]["method"] = "GROQ_ASSISTED"
                result["draft"]["content"]["sections"] = [
                    {"id": f"section-{i+1}", "title": section.title, "claims": section.claim_ids, "explanation": section.explanation, "reviewed": False}
                    for i, section in enumerate(synthesis.sections)
                ]
                result["warnings"] = state.get("warnings", []) + synthesis.limitations + ["Groq explanations are unverified draft text and require explicit editorial acceptance."]
            else:
                result["warnings"] = state.get("warnings", []) + [usage.get("reason", "Extractive fallback selected")]
        elif stage == "CITATION_AUDIT":
            audit(state)
        elif stage == "GRAPH_EXTRACTION":
            result["triples"] = []
        elif stage == "MEDIA_PROCESSING":
            result["media"] = []
        elif stage == "VALIDATION":
            audit(state)
            result["stage"] = "REVIEW_REQUIRED"
        return result

    return run


def build_graph(checkpointer):
    graph = StateGraph(State)
    for s in STAGES:
        graph.add_node(s, node(s))
    graph.add_edge(START, STAGES[0])
    for a, b in zip(STAGES, STAGES[1:]):
        graph.add_edge(a, b)
    graph.add_edge(STAGES[-1], END)
    return graph.compile(checkpointer=checkpointer, interrupt_after=STAGES)
