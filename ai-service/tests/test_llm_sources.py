from types import SimpleNamespace as N
from unittest.mock import Mock, patch
import json
import pytest
from app.llm import GroqProvider, configured_provider, ExtractiveProvider, reserve_budget
from app.sources import WikidataAdapter, resolve, canonical_title

CLAIMS=[{"id":"claim-1","text":"A source-linked quotation that awaits independent editorial verification.","status":"UNVERIFIED"}]

def client_for(payload):
    result=N(choices=[N(finish_reason="stop",message=N(content=json.dumps(payload),refusal=None))],usage=N(prompt_tokens=100,completion_tokens=50))
    client=Mock();client.chat.completions.create.return_value=result
    return client

def valid():
    return {"sections":[{"title":"An evidence-backed starting point","explanation":"The supplied source provides a starting point for further investigation.","claim_ids":["claim-1"]}],"limitations":["Independent verification remains pending."],"continuation_hint":None}

def test_schema_citations_and_provider_usage(monkeypatch):
    client=client_for(valid())
    monkeypatch.setattr("app.llm.reserve_budget",lambda:None)
    result,usage=GroqProvider(client).generate_structured("A subject",CLAIMS)
    assert result.sections[0].claim_ids==["claim-1"]
    assert usage["provider"]=="groq" and usage["requiresHumanReview"]
    request=client.chat.completions.create.call_args.kwargs
    assert request["stream"] is False
    schema=request["response_format"]["json_schema"]["schema"]
    assert schema["additionalProperties"] is False
    assert schema["$defs"]["Section"]["properties"]["claim_ids"]["items"]["enum"]==["claim-1"]

@pytest.mark.parametrize("damage",["unknown-citation","url","truncated"])
def test_unvalidated_generation_is_rejected(monkeypatch,damage):
    payload=valid()
    if damage=="unknown-citation":payload["sections"][0]["claim_ids"]=["invented"]
    if damage=="url":payload["sections"][0]["explanation"]="See https://invented.example/source"
    client=client_for(payload)
    if damage=="truncated":client.chat.completions.create.return_value.choices[0].finish_reason="length"
    monkeypatch.setattr("app.llm.reserve_budget",lambda:None)
    with pytest.raises(ValueError):GroqProvider(client).generate_structured("Topic",CLAIMS)

def test_disabled_provider_never_uses_a_key(monkeypatch):
    monkeypatch.setenv("GROQ_ENABLED","false");monkeypatch.setenv("GROQ_API_KEY","synthetic-test-key")
    assert isinstance(configured_provider(),ExtractiveProvider)

def test_daily_budget_is_persistent_and_bounded(monkeypatch,tmp_path):
    monkeypatch.setenv("PROVIDER_BUDGET_PATH",str(tmp_path/"quota.sqlite"));monkeypatch.setenv("GROQ_DAILY_REQUEST_BUDGET","1")
    reserve_budget()
    with pytest.raises(ValueError):reserve_budget()

def test_ambiguous_labels_keep_distinct_provider_ids():
    data={"search":[{"id":"Q308","label":"Mercury","description":"planet"},{"id":"Q925","label":"Mercury","description":"chemical element"}]}
    with patch("app.sources.document",return_value=(data,"https://www.wikidata.org/w/api.php")):
        values=WikidataAdapter().search("Mercury")
    assert len(values)==2 and values[0]["id"]!=values[1]["id"]
    assert all(v["state"]=="IDENTITY_CANDIDATE" for v in values)

def test_unavailable_provider_is_not_reported_as_absent_evidence():
    resolve.cache_clear()
    with patch("app.sources.document",side_effect=ValueError("maxlag")):
        result=resolve("uncached-example",1)
    assert result["state"]=="PROVIDERS_UNAVAILABLE" and len(result["warnings"])==3

def test_canonical_identity_never_accepts_a_url():
    with patch("app.sources.document") as request:
        with pytest.raises(ValueError):canonical_title("https://127.0.0.1/private")
        request.assert_not_called()
