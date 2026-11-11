import copy
import json
from pathlib import Path
from unittest.mock import patch
import pytest
from app.scientific import parse_molecule, parse_physical, parse_elements, ring_catalog

FIXTURES = Path(__file__).parent / "fixtures"
SOURCE = {"provider": "PubChem", "url": "https://pubchem.ncbi.nlm.nih.gov/compound/962", "retrievedAt": "2026-11-10T00:00:00Z"}

def water():
    return json.loads((FIXTURES / "pubchem-water-962.json").read_text())["PC_Compounds"][0]

def test_recorded_real_water_coordinates_and_provenance():
    result = parse_molecule(water(), {"MolecularFormula": "H2O", "MolecularWeight": "18.015"}, SOURCE)
    assert result["id"] == "962"
    assert [a["atomicNumber"] for a in result["atoms"]] == [8, 1, 1]
    assert result["coordinateUnit"] == "Å"
    assert len(result["bonds"]) == 2
    assert result["source"] == SOURCE
    assert result["computed"] is True

def test_atom_ids_are_joined_not_assumed_to_be_array_positions():
    record = water()
    original = parse_molecule(record, {}, SOURCE)
    mapping = {1: 21, 2: 15, 3: 99}
    record["atoms"]["aid"] = [mapping[a] for a in record["atoms"]["aid"]]
    for coords in record["coords"]:
        coords["aid"] = [mapping[a] for a in coords["aid"]]
    for name in ("aid1", "aid2"):
        record["bonds"][name] = [mapping[a] for a in record["bonds"][name]]
    result = parse_molecule(record, {}, SOURCE)
    assert result["atoms"][0]["id"] == 21
    assert result["atoms"][0]["position"] == original["atoms"][0]["position"]
    assert result["bonds"][0]["from"] in mapping.values()

def test_missing_3d_never_manufactures_z_coordinates():
    record = water()
    record["coords"] = []
    result = parse_molecule(record, {}, SOURCE)
    assert not result["atoms"]
    assert "No coordinates were invented" in result["warnings"][0]

@pytest.mark.parametrize("damage", ["units", "coordinates", "bonds", "truncated_atoms", "truncated_bonds", "duplicate_atoms"])
def test_malformed_scientific_record_rejected(damage):
    record = water()
    if damage == "units":
        for coords in record["coords"]:
            coords["type"] = [2]
    elif damage == "coordinates":
        record["coords"][0]["conformers"][0]["x"][0] = float("nan")
    elif damage == "bonds":
        record["bonds"]["aid1"][0] = 123456
    elif damage == "truncated_atoms":
        record["atoms"]["element"].pop()
    elif damage == "truncated_bonds":
        record["bonds"]["order"].pop()
    else:
        record["coords"][0]["aid"][1] = record["coords"][0]["aid"][0]
    with pytest.raises(ValueError):
        parse_molecule(record, {}, SOURCE)

def test_recorded_jpl_physical_data_and_orbit():
    physical = json.loads((FIXTURES / "jpl-saturn-699.json").read_text())
    values = parse_physical(physical["result"])
    assert values["equatorialRadius"]["value"] == 60268
    assert values["equatorialRadius"]["unit"] == "km"
    orbital = json.loads((FIXTURES / "jpl-saturn-elements.json").read_text())
    result = parse_elements(orbital["result"])
    assert result and result["semiMajorAxisAu"] > 9 and 0 < result["eccentricity"] < .1
    assert result["center"] == "Sun"
    assert "approximation" in result["model"]
    assert parse_elements("$$SOE\n2026-11-10\n$$EOE") is None

def test_jpl_geophysical_report_variation_and_source_uncertainty():
    report = json.loads((FIXTURES / "jpl-earth-399.json").read_text())["result"]
    values = parse_physical(report)
    assert values["equatorialRadius"]["value"] == 6378.137
    assert values["polarRadius"]["value"] == 6356.752
    assert values["meanRadius"]["uncertainty"] == 0.02
    assert "+-0.02" in values["meanRadius"]["sourceExcerpt"]
    assert values["orbitPeriod"]["unit"] == "years"

def test_ring_geometry_is_parsed_from_provider_rows():
    html=b'<table><tr><th>Feature</th><th>Inner</th><th>Outer</th></tr><tr><td>D Ring</td><td>66,900</td><td>74,491</td></tr><tr><td>Test Gap</td><td>80,000</td><td>81,000</td></tr></table>'
    with patch("app.scientific.SafeFetcher.get", return_value=(html, "https://pds-rings.seti.org/saturn/saturn_rings_table.html")):
        rings=ring_catalog("Saturn")
    assert len(rings)==1 and rings[0]["innerRadiusKm"]==66900
    assert rings[0]["outerRadiusKm"]==74491
    assert rings[0]["sourceUrl"].startswith("https://pds-rings.seti.org/")
