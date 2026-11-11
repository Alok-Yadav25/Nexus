"""Live, subject-independent Wikipedia discovery and attributed reading.

Provider text stays distinct from NEXUS-reviewed claims. HTML is converted to a
small document tree; no provider scripts, styles, embeds or event handlers survive.
"""

import base64
import json
from datetime import datetime, timezone
from urllib.parse import quote, unquote, urlencode, urljoin, urlsplit

from bs4 import BeautifulSoup, NavigableString, Tag

from .sources import document

API = "https://en.wikipedia.org/w/api.php?"
ROOT_CATEGORY = "Main topic classifications"
TAGS = frozenset(
    "p h2 h3 h4 h5 h6 ul ol li blockquote table caption thead tbody tfoot tr td th dl dt dd pre code strong b em i sup sub a span br hr s small div section abbr".split()
)


def now():
    return datetime.now(timezone.utc).isoformat()


def title_value(value):
    value = " ".join(value.replace("_", " ").split())
    if not value or len(value) > 240 or any(ord(c) < 32 for c in value):
        raise ValueError("Enter an encyclopedia title of 1–240 characters")
    return value


def action(**params):
    payload, _ = document(
        API
        + urlencode({"action": "query", "format": "json", "formatversion": 2, **params})
    )
    return payload


def search(query, offset=0):
    query = title_value(query)
    if not 0 <= offset <= 10000:
        raise ValueError("Invalid search offset")
    data = action(
        generator="search",
        gsrsearch=query,
        gsrnamespace=0,
        gsrlimit=12,
        gsroffset=offset,
        prop="description|info|pageprops",
        inprop="url",
        ppprop="wikibase_item|disambiguation",
    )
    pages = sorted(
        data.get("query", {}).get("pages", []), key=lambda p: p.get("index", 0)
    )
    items = [
        {
            "id": p["pageid"],
            "title": p["title"],
            "description": p.get(
                "description",
                "Encyclopedia article · open to read and inspect its references",
            ),
            "url": p.get(
                "canonicalurl", "https://en.wikipedia.org/?curid=" + str(p["pageid"])
            ),
            "wikidataId": p.get("pageprops", {}).get("wikibase_item"),
            "disambiguation": "disambiguation" in p.get("pageprops", {}),
        }
        for p in pages
    ]
    return {
        "query": query,
        "items": items,
        "offset": offset,
        "nextOffset": data.get("continue", {}).get("gsroffset"),
        "provider": "Wikipedia",
        "retrievedAt": now(),
    }


def encode_cursor(value):
    return base64.urlsafe_b64encode(json.dumps(value).encode()).decode().rstrip("=")


def decode_cursor(value):
    if not value:
        return {}
    try:
        if len(value) > 2000:
            raise ValueError()
        decoded = json.loads(base64.urlsafe_b64decode(value + "=" * (-len(value) % 4)))
        if (
            not isinstance(decoded, dict)
            or not decoded
            or set(decoded) - {"cmcontinue", "continue"}
        ):
            raise ValueError()
        if any(not isinstance(v, str) or len(v) > 1200 for v in decoded.values()):
            raise ValueError()
        return decoded
    except (ValueError, TypeError, UnicodeError) as exc:
        raise ValueError("Invalid topic cursor") from exc


def topics(category=ROOT_CATEGORY, cursor=""):
    category = title_value(category.removeprefix("Category:"))
    data = action(
        list="categorymembers",
        cmtitle="Category:" + category,
        cmnamespace="0|14",
        cmtype="page|subcat",
        cmlimit=50,
        **decode_cursor(cursor),
    )
    items = [
        {
            "id": p["pageid"],
            "title": p["title"],
            "label": p["title"].removeprefix("Category:"),
            "kind": "CATEGORY" if p["ns"] == 14 else "ARTICLE",
        }
        for p in data.get("query", {}).get("categorymembers", [])
    ]
    return {
        "category": category,
        "items": items,
        "nextCursor": encode_cursor(data["continue"]) if data.get("continue") else None,
        "provider": "Wikipedia",
        "retrievedAt": now(),
    }


def wiki_id(value):
    return "wiki-" + value


def article_link(href, current_title):
    """Accept fixed wiki routes or ordinary web links, never executable schemes."""
    if href.startswith("#"):
        return "#" + wiki_id(unquote(href[1:]))
    parsed = urlsplit(urljoin("https://en.wikipedia.org/wiki/", href))
    if (
        parsed.scheme not in ("https", "http")
        or not parsed.hostname
        or parsed.username
        or parsed.password
    ):
        return None
    if parsed.hostname == "en.wikipedia.org" and parsed.path.startswith("/wiki/"):
        if parsed.query:
            return parsed.geturl()
        target = unquote(parsed.path[6:]).replace("_", " ")
        fragment = (
            "#" + quote(wiki_id(unquote(parsed.fragment)), safe="")
            if parsed.fragment
            else ""
        )
        if target == current_title:
            return fragment or "#wiki-top"
        if target.startswith("Category:"):
            return "/explore?" + urlencode({"category": target[9:]})
        namespace = target.split(":", 1)[0].lower() if ":" in target else ""
        if (
            namespace
            not in {
                "file",
                "image",
                "talk",
                "user",
                "user talk",
                "wikipedia",
                "template",
                "help",
                "portal",
                "special",
                "mediawiki",
                "module",
                "media",
            }
            and len(target) <= 240
        ):
            return "/read/wikipedia?" + urlencode({"title": target}) + fragment
    return parsed.geturl()


def article_tree(html, title):
    soup = BeautifulSoup(html, "html.parser")
    root = soup.body or soup
    for node in root.select(
        "script,style,iframe,object,embed,form,input,button,select,textarea,svg,canvas,video,audio,template,link,meta,.navbox,.vertical-navbox,.mw-editsection,.metadata,.sistersitebox,.noprint"
    ):
        node.decompose()
    toc = []
    for n, heading in enumerate(root.find_all(["h2", "h3"])):
        ident = heading.get("id") or f"section-{n}"
        heading["id"] = ident
        toc.append(
            {
                "id": wiki_id(ident),
                "title": heading.get_text(" ", strip=True),
                "level": int(heading.name[1]),
            }
        )
    budget = [30000]
    truncated = [False]

    def convert(node, depth=0):
        if budget[0] <= 0 or depth > 60:
            truncated[0] = True
            return None
        budget[0] -= 1
        if isinstance(node, NavigableString):
            # Comments must never become visible article content.
            return str(node) if type(node) is NavigableString else None
        if not isinstance(node, Tag):
            return None
        if node.name == "math":
            return {
                "tag": "code",
                "children": [node.get("alttext") or node.get_text(" ", strip=True)],
            }
        if node.name == "img":
            return None  # Media has separate licenses; text attribution alone is insufficient.
        children = [
            v for child in node.children if (v := convert(child, depth + 1)) is not None
        ]
        if node.name in {"table", "thead", "tbody", "tfoot", "tr"}:
            children = [
                child
                for child in children
                if not isinstance(child, str) or child.strip()
            ]
        if not children and not node.get("id") and node.name not in ("br", "hr"):
            return None
        tag = node.name if node.name in TAGS else "span"
        result = {"tag": tag, "children": children}
        if node.get("id"):
            result["id"] = wiki_id(str(node["id"])[:300])
        if tag == "a" and node.get("href"):
            href = article_link(node["href"], title)
            if href:
                result["href"] = href
        for attr in ("colspan", "rowspan"):
            if tag in ("td", "th") and str(node.get(attr, "")).isdigit():
                result[attr] = min(100, max(1, int(node[attr])))
        return result

    tree = [v for child in root.children if (v := convert(child)) is not None]
    retained_ids = set()

    def collect_ids(nodes):
        for item in nodes:
            if isinstance(item, dict):
                if item.get("id"):
                    retained_ids.add(item["id"])
                collect_ids(item.get("children", []))

    collect_ids(tree)
    return (
        tree,
        [item for item in toc if item["id"] in retained_ids][:150],
        truncated[0],
    )


def article(title):
    title = title_value(title)
    payload, _ = document(
        "https://en.wikipedia.org/w/rest.php/v1/page/"
        + quote(title.replace(" ", "_"), safe="")
        + "/with_html",
        max_bytes=8_000_000,
    )
    if payload.get("content_model") != "wikitext" or not payload.get("html"):
        raise ValueError("This page is not an encyclopedia article")
    title = payload["title"]
    tree, toc, truncated = article_tree(payload["html"], title)
    page_id = payload["id"]
    revision = payload.get("latest", {})
    return {
        "id": page_id,
        "title": title,
        "provider": "Wikipedia",
        "url": "https://en.wikipedia.org/?curid=" + str(page_id),
        "revisionId": revision.get("id"),
        "modifiedAt": revision.get("timestamp"),
        "revisionUrl": "https://en.wikipedia.org/w/index.php?"
        + urlencode({"oldid": revision.get("id")}),
        "historyUrl": "https://en.wikipedia.org/w/index.php?"
        + urlencode({"title": title, "action": "history"}),
        "license": payload.get(
            "license",
            {
                "title": "CC BY-SA 4.0",
                "url": "https://creativecommons.org/licenses/by-sa/4.0/",
            },
        ),
        "attribution": "Wikipedia contributors",
        "retrievedAt": now(),
        "content": tree,
        "toc": toc,
        "truncated": truncated,
    }
