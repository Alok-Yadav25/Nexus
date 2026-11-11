"""Generate deterministic attributed editorial seed migration; no dashboard fixtures."""

from pathlib import Path
from uuid import uuid5, NAMESPACE_URL
import json

ROOT = Path(__file__).resolve().parents[2]
uid = lambda value: str(uuid5(NAMESPACE_URL, "nexus:seed:" + value))


def sql(value):
    if value is None:
        return "NULL"
    return "'" + str(value).replace("'", "''") + "'"


statements = [
    "-- Small attributed editorial starter corpus, not autonomous research output."
]


def insert(table, **values):
    statements.append(
        f"INSERT INTO {table} ({','.join(values)}) VALUES ({','.join(sql(x) for x in values.values())});"
    )


sources = [
    (
        "rsc",
        "https://periodic-table.rsc.org/element/3/Lithium",
        "Lithium: element information, properties and uses",
        "Royal Society of Chemistry",
        None,
    ),
    (
        "nobel",
        "https://www.nobelprize.org/uploads/2019/10/advanced-chemistryprize2019-2.pdf",
        "Scientific background: lithium-ion batteries",
        "Royal Swedish Academy of Sciences",
        "2019-10-09",
    ),
    (
        "dyson",
        "https://arxiv.org/abs/2201.11123",
        "Project Hephaistos I: Upper limits on partial Dyson spheres in the Milky Way",
        "arXiv",
        "2022-01-26",
    ),
    (
        "nasa",
        "https://science.nasa.gov/universe/search-for-life/searching-for-signs-of-intelligent-life-technosignatures/",
        "Searching for Signs of Intelligent Life: Technosignatures",
        "NASA",
        None,
    ),
    (
        "marvel",
        "https://www.marvel.com/articles/comics/the-villains-of-black-panther",
        "The Villains of Black Panther",
        "Marvel",
        None,
    ),
]
for key, url, title, publisher, date in sources:
    insert(
        "sources",
        id=uid("source:" + key),
        url=url,
        title=title,
        publisher=publisher,
        source_type="PRIMARY" if key != "rsc" else "REFERENCE",
        published_at=date,
        license="Copyright holder retains rights; brief attributed excerpts only",
    )
articles = [
    (
        "lithium",
        "Lithium",
        "ChemicalElement",
        "Chemistry",
        "Q568",
        ["Li"],
        [
            (
                "number",
                "Lithium has atomic number 3.",
                "has atomic number",
                "3",
                "rsc",
                "Atomic number 3",
                "VERIFIED",
            ),
            (
                "group",
                "Lithium belongs to group 1, the alkali metals.",
                "belongs to",
                "Alkali metals",
                "rsc",
                "Group 1",
                "VERIFIED",
            ),
            (
                "discovery",
                "Johan August Arfvedson discovered lithium in 1817.",
                "discovered by",
                "Johan August Arfvedson",
                "rsc",
                "1817 by Johan August Arfvedson",
                "VERIFIED",
            ),
            (
                "isolation",
                "Bulk lithium metal was obtained in 1855.",
                "isolated in",
                "1855",
                "rsc",
                "extracted in 1855",
                "VERIFIED",
            ),
            (
                "uses",
                "Lithium is used in rechargeable batteries.",
                "used in",
                "Lithium-ion batteries",
                "rsc",
                "rechargeable batteries",
                "VERIFIED",
            ),
        ],
        {
            "Symbol": ("Li", "number"),
            "Atomic number": ("3", "number"),
            "Group": ("1 · Alkali metals", "group"),
        },
    ),
    (
        "lithium-ion-batteries",
        "Lithium-ion batteries",
        "Technology",
        "Energy",
        "Q282195",
        ["Li-ion", "LIB"],
        [
            (
                "development",
                "The 2019 Nobel Prize in Chemistry recognized the development of lithium-ion batteries.",
                "recognized by",
                "Nobel Prize in Chemistry 2019",
                "nobel",
                "for the development of lithium-ion batteries",
                "VERIFIED",
            ),
            (
                "commercial",
                "Commercial lithium-ion batteries entered the market in 1991.",
                "commercialized in",
                "1991",
                "nobel",
                "1991",
                "VERIFIED",
            ),
        ],
        {"Commercial introduction": ("1991", "commercial")},
    ),
    (
        "alkali-metals",
        "Alkali metals",
        "Material",
        "Chemistry",
        "Q19557",
        [],
        [
            (
                "lithium",
                "Lithium is a member of the alkali metals in group 1.",
                "includes",
                "Lithium",
                "rsc",
                "alkali metals group",
                "VERIFIED",
            )
        ],
        {},
    ),
    (
        "johan-august-arfvedson",
        "Johan August Arfvedson",
        "Person",
        "History",
        "Q46895",
        ["Johan Arfvedson"],
        [
            (
                "discovery",
                "Johan August Arfvedson identified lithium in 1817 while studying petalite.",
                "discovered",
                "Lithium",
                "rsc",
                "1817 by Johan August Arfvedson",
                "VERIFIED",
            )
        ],
        {},
    ),
    (
        "dyson-sphere",
        "Dyson sphere",
        "HypotheticalTechnology",
        "Space",
        "Q146964",
        ["Dyson swarm"],
        [
            (
                "hypothesis",
                "A Dyson sphere is a hypothetical megastructure for harvesting stellar radiation.",
                "harvests",
                "Stellar energy",
                "dyson",
                "hypothetical megastructures",
                "THEORETICAL_MODEL",
            )
        ],
        {"Knowledge type": ("Hypothetical technology", "hypothesis")},
    ),
    (
        "technosignatures",
        "Technosignatures",
        "ScientificTheory",
        "Space",
        None,
        [],
        [
            (
                "infrared",
                "A proposed Dyson sphere could be investigated through excess infrared emission from waste heat.",
                "investigates",
                "Dyson sphere",
                "nasa",
                "observed as excess infrared radiation",
                "THEORETICAL_MODEL",
            )
        ],
        {},
    ),
    (
        "vibranium",
        "Vibranium",
        "FictionalEntity",
        "Fiction",
        "Q174524",
        ["Wakandan vibranium"],
        [
            (
                "canon",
                "In Marvel stories, vibranium is associated with the fictional kingdom of Wakanda.",
                "located in",
                "Wakanda",
                "marvel",
                "vibranium metal",
                "FICTIONAL_CANON",
            )
        ],
        {"Knowledge type": ("Fictional canon", "canon")},
    ),
    (
        "wakanda",
        "Wakanda",
        "FictionalLocation",
        "Fiction",
        "Q193852",
        [],
        [
            (
                "canon",
                "Wakanda is the kingdom associated with Black Panther in Marvel comics.",
                "part of",
                "Marvel stories",
                "marvel",
                "from the kingdom",
                "FICTIONAL_CANON",
            )
        ],
        {},
    ),
]
for slug, title, ontology, domain, canonical, aliases, claims, attrs in articles:
    eid, aid = uid("entity:" + slug), uid("article:" + slug)
    insert(
        "entities",
        id=eid,
        name=title,
        slug=slug,
        ontology=ontology,
        domain=domain,
        description=claims[0][1],
        canonical_id=canonical,
    )
    for alias in aliases:
        insert("entity_aliases", entity_id=eid, alias=alias, normalized=alias.lower())
    content = {
        "schemaVersion": 1,
        "sections": [
            {
                "id": "overview",
                "title": "Overview",
                "claims": [uid("claim:" + slug + ":" + c[0]) for c in claims],
            }
        ],
        "attributes": {
            key: {"value": value, "claimId": uid("claim:" + slug + ":" + claim)}
            for key, (value, claim) in attrs.items()
        },
        "editorialNote": "Attributed starter entry. Research-generated drafts always require human review.",
    }
    insert(
        "articles",
        id=aid,
        entity_id=eid,
        slug=slug,
        title=title,
        summary=claims[0][1],
        content=json.dumps(content),
        status="PUBLISHED",
    )
    for key, text, predicate, obj, source, excerpt, status in claims:
        cid = uid("claim:" + slug + ":" + key)
        insert(
            "claims",
            id=cid,
            article_id=aid,
            text=text,
            subject=title,
            predicate=predicate,
            object=obj,
            status=status,
            rationale="Editorial seed checked against the linked institutional reference. VERIFIED denotes reference support, not independent multi-source verification."
            if status == "VERIFIED"
            else "Interpret only within the labeled theoretical model or fictional canon.",
        )
        insert(
            "claim_evidence",
            id=uid("evidence:" + slug + ":" + key),
            claim_id=cid,
            source_id=uid("source:" + source),
            excerpt=excerpt,
            stance="SUPPORTS",
        )
        insert(
            "citations",
            id=uid("citation:" + slug + ":" + key),
            article_id=aid,
            claim_id=cid,
            section_id="overview",
        )
    import hashlib

    insert(
        "article_revisions",
        id=uid("revision:" + slug),
        article_id=aid,
        number=1,
        summary="Attributed editorial seed",
        content=json.dumps(content),
        content_hash=hashlib.sha256(
            json.dumps(
                content, sort_keys=True, separators=(",", ":"), ensure_ascii=False
            ).encode()
        ).hexdigest(),
    )
    insert("indexing_outbox", id=uid("outbox:" + slug), article_id=aid, version=1)
for a, b, kind, claim, status in [
    ("lithium", "alkali-metals", "BELONGS_TO", "lithium:group", "VERIFIED"),
    ("lithium", "lithium-ion-batteries", "USED_IN", "lithium:uses", "VERIFIED"),
    (
        "lithium",
        "johan-august-arfvedson",
        "DISCOVERED_BY",
        "lithium:discovery",
        "VERIFIED",
    ),
    (
        "technosignatures",
        "dyson-sphere",
        "RELATED_TO",
        "technosignatures:infrared",
        "THEORETICAL_MODEL",
    ),
    ("vibranium", "wakanda", "LOCATED_IN", "vibranium:canon", "FICTIONAL_CANON"),
]:
    insert(
        "relationships",
        id=uid("edge:" + a + ":" + b),
        from_entity=uid("entity:" + a),
        to_entity=uid("entity:" + b),
        type=kind,
        claim_id=uid("claim:" + claim),
        status=status,
    )
for slug, date, title, key in [
    ("lithium", "1817-01-01", "Discovery of lithium", "discovery"),
    ("lithium", "1855-01-01", "Bulk preparation of lithium metal", "isolation"),
    ("lithium-ion-batteries", "1991-01-01", "Commercial introduction", "commercial"),
    ("lithium-ion-batteries", "2019-10-09", "Nobel Prize in Chemistry", "development"),
]:
    insert(
        "timeline_events",
        id=uid("event:" + slug + ":" + key),
        entity_id=uid("entity:" + slug),
        event_date=date,
        date_precision="DAY" if key == "development" else "YEAR",
        title=title,
        description=next(
            c[1] for a in articles if a[0] == slug for c in a[6] if c[0] == key
        ),
        claim_id=uid("claim:" + slug + ":" + key),
    )
(ROOT / "backend/src/main/resources/db/migration/V2__attributed_seed.sql").write_text(
    "\n".join(statements) + "\n"
)
(ROOT / "infrastructure/seeds/attribution.json").write_text(
    json.dumps(
        [{"url": s[1], "title": s[2], "publisher": s[3]} for s in sources]
        + [
            {
                "url": "https://www.nobelprize.org/prizes/chemistry/2019/press-release/",
                "title": "The Nobel Prize in Chemistry 2019: press release",
                "publisher": "Royal Swedish Academy of Sciences",
            }
        ],
        indent=2,
    )
    + "\n"
)
