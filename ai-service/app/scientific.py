"""Provider-backed educational models. Coordinates and measurements are never synthesized."""
from datetime import datetime, timezone, timedelta
from functools import lru_cache
from threading import Lock
from urllib.parse import urlencode, quote
import csv
from bs4 import BeautifulSoup
import io
import json
import math
import re
import time
from .security import SafeFetcher

ELEMENTS = "? H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og".split()
_locks = {"jpl": Lock(), "pubchem": Lock()}
_last = {"jpl": 0.0, "pubchem": 0.0}


def api_json(provider, url):
    # These JSON APIs explicitly permit programmatic access. DNS pinning, TLS,
    # allowlisted hosts, redirect checks and size limits remain enforced.
    with _locks[provider]:
        time.sleep(max(0, (1.0 if provider == "jpl" else .25) - (time.monotonic() - _last[provider])))
        try:
            raw, final = SafeFetcher()._raw(url)
            return json.loads(raw), final
        finally:
            _last[provider] = time.monotonic()


def provenance(provider, url, **extra):
    return {"provider": provider, "url": url, "retrievedAt": datetime.now(timezone.utc).isoformat(), **extra}


def parse_molecule(record, properties, source):
    atoms = record.get("atoms", {})
    coords = next((c for c in record.get("coords", []) if 2 in c.get("type", []) and c.get("conformers")), None)
    result = {"kind": "molecule", "id": str(record["id"]["id"]["cid"]), "title": properties.get("IUPACName") or properties.get("MolecularFormula", "Molecule"), "formula": properties.get("MolecularFormula"), "molecularWeight": properties.get("MolecularWeight"), "massUnit": "g/mol", "source": source, "computed": True, "atoms": [], "bonds": [], "warnings": []}
    if not coords:
        result["warnings"] = ["PubChem did not supply a 3D conformer. No coordinates were invented."]
        return result
    unit = "Å" if 10 in coords.get("type", []) else "nm" if 11 in coords.get("type", []) else None
    if unit is None:
        raise ValueError("Provider coordinate units are missing or unsupported")
    conformer = coords["conformers"][0]
    aids = coords.get("aid", [])
    if not aids or len(set(aids)) != len(aids) or any(len(conformer.get(axis, [])) != len(aids) for axis in ("x", "y", "z")):
        raise ValueError("Incomplete or duplicate coordinate identifiers")
    atom_ids = atoms.get("aid", [])
    if len(atom_ids) != len(atoms.get("element", [])) or len(set(atom_ids)) != len(atom_ids) or set(atom_ids) != set(aids):
        raise ValueError("Atom identity and coordinate records do not match")
    if len(aids) > 300:
        raise ValueError("This structure exceeds the interactive atom budget; use the original PubChem record")
    positions = dict(zip(aids, zip(conformer.get("x", []), conformer.get("y", []), conformer.get("z", []))))
    scale = 10 if unit == "nm" else 1
    for aid, number in zip(atoms.get("aid", []), atoms.get("element", [])):
        xyz = positions.get(aid)
        if xyz is None or len(xyz) != 3 or not all(math.isfinite(x) for x in xyz):
            raise ValueError("Incomplete or invalid provider coordinates")
        result["atoms"].append({"id": aid, "atomicNumber": number, "symbol": ELEMENTS[number] if 0 < number < len(ELEMENTS) else "?", "position": [x * scale for x in xyz]})
    bond = record.get("bonds", {})
    if len({len(bond.get(field, [])) for field in ("aid1", "aid2", "order")}) > 1:
        raise ValueError("Incomplete provider bonds")
    valid = {a["id"] for a in result["atoms"]}
    for a, b, order in zip(bond.get("aid1", []), bond.get("aid2", []), bond.get("order", [])):
        if a not in valid or b not in valid or order not in (1, 2, 3, 4):
            raise ValueError("Unsupported or invalid provider bond")
        result["bonds"].append({"from": a, "to": b, "order": order})
    result.update(coordinateUnit="Å", conformer=conformer.get("id", {}).get("id"), warnings=["Computed PubChem conformer. Ball sizes and colors are illustrative; distances describe this conformer, not a universal experimental geometry."])
    return result


@lru_cache(maxsize=128)
def molecule(query, cache_epoch=None):
    normalized = query.strip()
    cid_text = normalized.removeprefix("CID:")
    if cid_text.isdigit():
        cid = int(cid_text)
    else:
        matches, _ = api_json("pubchem", "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/" + quote(normalized, safe="") + "/cids/JSON")
        cids = matches.get("IdentifierList", {}).get("CID", [])
        if len(cids) != 1:
            raise ValueError("No unique compound found. Use a specific PubChem CID to disambiguate.")
        cid = cids[0]
    base = f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/{cid}"
    props, _ = api_json("pubchem", base + "/property/MolecularFormula,MolecularWeight,IUPACName/JSON")
    source = provenance("PubChem", f"https://pubchem.ncbi.nlm.nih.gov/compound/{cid}", terms="https://pubchem.ncbi.nlm.nih.gov/docs/downloads", attribution="NCBI PubChem; contributing source rights apply")
    try:
        data, _ = api_json("pubchem", base + "/JSON?record_type=3d")
    except ValueError:
        data, _ = api_json("pubchem", base + "/JSON?record_type=2d")
    records = data.get("PC_Compounds", [])
    if not records:
        raise ValueError("No compound record returned")
    return parse_molecule(records[0], props["PropertyTable"]["Properties"][0], source)


def parse_physical(report):
    patterns = [
        ("equatorialRadius", r"Equ(?:at(?:orial)?)?\.?\s*radius[^=\n]*=\s*([\d.]+)", "km"),
        ("polarRadius", r"Polar (?:radius|axis)[^=\n]*=\s*([\d.]+)", "km"),
        ("meanRadius", r"(?:Vol\. Mean Radius|Mean radius)[^=]*=\s*([\d.]+)", "km"),
        ("surfaceGravity", r"(?:Equ\.?\s*grav[^=\n]*|Surface gravity[^=\n]*|g_e,[^=\n]*)=\s*([\d.]+)", "m/s²"),
        ("obliquity", r"Obliquity to orbit[^=\n]*=\s*([\d.]+)", "degrees"),
        ("orbitPeriod", r"Sidereal orb(?:it)?\s*period[^=\n]*=\s*([\d.]+)\s*y(?:r)?", "years"),
    ]
    out = {}
    for key, pattern, unit in patterns:
        match = re.search(pattern, report, re.I)
        if match:
            quantity = {"value": float(match[1]), "unit": unit, "sourceExcerpt": match[0]}
            uncertainty = re.match(r"\s*(?:\+-|±|\+/-)\s*([\d.]+)", report[match.end():])
            if uncertainty:
                quantity["uncertainty"] = float(uncertainty[1])
                quantity["sourceExcerpt"] += uncertainty[0]
            out[key] = quantity
    return out


def parse_elements(report):
    if "$$SOE" not in report or "$$EOE" not in report:
        return None
    prefix, tail = report.split("$$SOE", 1)
    headers = next((line for line in reversed(prefix.splitlines()) if "EC," in line and "MA," in line), None)
    if not headers:
        return None
    keys = [x.strip() for x in next(csv.reader([headers]))]
    row = next((r for r in csv.reader(io.StringIO(tail.split("$$EOE")[0])) if r and r[0].strip()), None)
    if not row or len(row) != len(keys):
        return None
    values = dict(zip(keys, [x.strip() for x in row]))
    try:
        out = {key: float(values[key]) for key in ("EC", "IN", "OM", "W", "MA", "A", "PR")}
        if not all(math.isfinite(v) for v in out.values()) or out["A"] <= 0 or not 0 <= out["EC"] < 1:
            return None
        return {"eccentricity": out["EC"], "inclinationDegrees": out["IN"], "ascendingNodeDegrees": out["OM"], "periapsisDegrees": out["W"], "meanAnomalyDegrees": out["MA"], "semiMajorAxisAu": out["A"], "periodDays": out["PR"], "epoch": values.get("Calendar Date (TDB)") or values.get("Calendar Date (TDB) ") or row[1].strip(), "center": "Sun", "model": "Osculating elements; educational two-body approximation, not precision ephemeris"}
    except (KeyError, ValueError):
        return None



def ring_catalog(name):
    # The scientific catalog is discovered from the resolved provider name;
    # renderer geometry has no planet-name branches or invented ring radii.
    slug = name.casefold()
    if not re.fullmatch(r"[a-z]+", slug):
        return []
    url = f"https://pds-rings.seti.org/{slug}/{slug}_rings_table.html"
    raw, final = SafeFetcher().get(url)
    rings = []
    for row in BeautifulSoup(raw, "html.parser").select("table tr"):
        cells = row.find_all(["td", "th"], recursive=False)
        if len(cells) < 3:
            continue
        title = cells[0].get_text(" ", strip=True)
        if "Ring" not in title or any(term in title for term in ("Ringlet", "Gap", "Region")):
            continue
        try:
            a = float(cells[1].get_text(strip=True).replace(",", ""))
            b = float(cells[2].get_text(strip=True).replace(",", ""))
            if not 0 < a < b:
                continue
            rings.append({"name": title, "innerRadiusKm": a, "outerRadiusKm": b, "sourceUrl": final, "retrievedAt": datetime.now(timezone.utc).isoformat()})
        except ValueError:
            continue
    return rings[:16]

@lru_cache(maxsize=128)
def planet(query, cache_epoch=None):
    lookup, lookup_url = api_json("jpl", "https://ssd.jpl.nasa.gov/api/horizons_lookup.api?" + urlencode({"sstr": query, "group": "pln"}))
    matches = lookup.get("result", [])
    exact = [x for x in matches if x.get("name", "").casefold() == query.strip().casefold() or str(x.get("spkid")) == query.strip()]
    matches = exact or matches
    if len(matches) != 1:
        raise ValueError("No unique celestial body found; use its exact NASA/JPL name or SPK ID")
    body = matches[0]
    identifier = str(body["spkid"])
    if not re.fullmatch(r"\d{1,12}", identifier):
        raise ValueError("Unsupported provider identifier")
    base = "https://ssd.jpl.nasa.gov/api/horizons.api?"
    params = {"format": "json", "COMMAND": identifier, "MAKE_EPHEM": "NO", "OBJ_DATA": "YES"}
    data, url = api_json("jpl", base + urlencode(params))
    report = data.get("result", "")
    if data.get("error") or not report:
        raise ValueError("NASA/JPL returned no usable physical data")
    revised = re.search(r"Revised:\s*([^\n]+?)\s{3,}", report)
    source = provenance("NASA/JPL Horizons", url, revision=revised[1].strip() if revised else None, attribution="NASA/JPL Solar System Dynamics", terms="https://ssd-api.jpl.nasa.gov/")
    properties = parse_physical(report)
    if not any(properties.get(k, {}).get("value", 0) > 0 for k in ("equatorialRadius", "meanRadius")):
        raise ValueError("NASA/JPL supplied no usable physical radius; no body geometry was invented")
    today = datetime.now(timezone.utc).date()
    params.update(MAKE_EPHEM="YES", EPHEM_TYPE="ELEMENTS", CENTER="500@10", START_TIME=str(today), STOP_TIME=str(today + timedelta(days=2)), STEP_SIZE="1d", OUT_UNITS="AU-D", CSV_FORMAT="YES")
    elements = None
    warnings = ["Geometry uses sourced radii when available. Surface colors are illustrative, not photographic imagery."]
    try:
        orbital, orbital_url = api_json("jpl", base + urlencode(params))
        elements = parse_elements(orbital.get("result", ""))
        if elements:
            elements["sourceUrl"] = orbital_url
        else:
            warnings.append("Orbital elements were incomplete; no orbit was invented.")
    except (ValueError, OSError):
        warnings.append("Orbital data is unavailable; physical data remains usable.")
    rings = []
    try:
        rings = ring_catalog(body["name"])
    except (ValueError, OSError):
        warnings.append("Ring catalog unavailable; absence of ring data does not establish that a body has no rings.")
    if rings:
        warnings.append("Ring schematic: radial boundaries from NASA PDS. Colors, opacity, thickness and viewing orientation are illustrative; finer structure and ring dynamics are omitted.")
    return {"rings": rings, "kind": "planet", "id": identifier, "title": body["name"], "bodyType": body.get("type"), "properties": properties, "orbitalElements": elements, "source": source, "warnings": warnings, "physicalReport": report[:20000], "apiVersion": data.get("signature", {}).get("version")}
