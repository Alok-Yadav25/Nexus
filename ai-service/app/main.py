from contextlib import asynccontextmanager
from pathlib import Path
from threading import RLock
from functools import lru_cache
from uuid import UUID
import os
import secrets
import sqlite3
import truststore

truststore.inject_into_ssl()
from fastapi import FastAPI, Depends, Header, HTTPException, Query
import time
from . import scientific, encyclopedia
from .sources import resolve
from .llm import configured_provider
from pydantic import BaseModel, Field
from langgraph.checkpoint.sqlite import SqliteSaver
from .workflow import build_graph
from .security import SafeFetcher, SourceHTTPError

lock = RLock()


@asynccontextmanager
async def lifespan(app):
    path = Path(os.getenv("CHECKPOINT_PATH", "./data/checkpoints.sqlite"))
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path), check_same_thread=False)
    saver = SqliteSaver(conn)
    saver.setup()
    app.state.graph = build_graph(saver)
    yield
    conn.close()


app = FastAPI(title="NEXUS Research Service", version="0.1.0", lifespan=lifespan)


def authenticated(x_service_token: str = Header(default="")):
    if not secrets.compare_digest(
        os.getenv("AI_SERVICE_TOKEN", "local-development-only"), x_service_token
    ):
        raise HTTPException(401, "Invalid service token")


@app.get("/health")
def health():
    return {"status": "UP", "service": "nexus-ai"}


class ResearchRequest(BaseModel):
    topic: str = Field(min_length=2, max_length=240)
    ontology: str = Field(default="UNCLASSIFIED", max_length=60)
    canonical_id: str = Field(default="", max_length=100)


@app.post("/research/{job_id}/step", dependencies=[Depends(authenticated)])
def step(job_id: UUID, body: ResearchRequest):
    config = {"configurable": {"thread_id": str(job_id)}}
    with lock:
        graph = app.state.graph
        snapshot = graph.get_state(config)
        if snapshot.values and snapshot.values.get("topic") != body.topic:
            raise HTTPException(409, "Checkpoint topic mismatch")
        if snapshot.values.get("stage") == "REVIEW_REQUIRED":
            return snapshot.values
        initial = (
            {"job_id": str(job_id), "topic": body.topic, "ontology": body.ontology,"canonical_id":body.canonical_id}
            if not snapshot.values
            else None
        )
        try:
            return graph.invoke(initial, config)
        except (ValueError, OSError) as exc:
            raise HTTPException(422, str(exc)) from exc


class EmbedRequest(BaseModel):
    texts: list[str] = Field(min_length=1, max_length=32)


@lru_cache(maxsize=1)
def embedding_model():
    from fastembed import TextEmbedding

    return TextEmbedding(
        model_name="BAAI/bge-small-en-v1.5",
        cache_dir=os.getenv("HF_HOME", "./data/models"),
        threads=2,
    )


@app.post("/embed", dependencies=[Depends(authenticated)])
def embed(body: EmbedRequest):
    if any(len(t) > 16000 for t in body.texts):
        raise HTTPException(422, "Text exceeds embedding limit")
    try:
        vectors = [v.tolist() for v in embedding_model().embed(body.texts)]
        return {
            "model": "BAAI/bge-small-en-v1.5",
            "dimensions": len(vectors[0]),
            "vectors": vectors,
        }
    except Exception as exc:
        raise HTTPException(
            503, "Embedding model unavailable; no substitute vectors generated"
        ) from exc


class UrlRequest(BaseModel):
    url: str = Field(max_length=2000)


@app.post("/source/check", dependencies=[Depends(authenticated)])
def check(body: UrlRequest):
    try:
        data, url = SafeFetcher().get(body.url)
        return {"state": "AVAILABLE", "url": url, "bytes": len(data)}
    except Exception as exc:
        return {
            "state": "UNCHECKED"
            if "approved" in str(exc) or "robots" in str(exc)
            else "UNAVAILABLE",
            "reason": str(exc)[:200],
        }


@app.get("/visuals/{kind}", dependencies=[Depends(authenticated)])
def visual(kind: str, q: str = Query(min_length=1, max_length=240)):
    provider = {"planet": scientific.planet, "molecule": scientific.molecule}.get(kind)
    if provider is None:
        raise HTTPException(404, "No renderer registered for this data type")
    try:
        return provider(q, int(time.time() // 3600))
    except (ValueError, OSError) as exc:
        raise HTTPException(422, str(exc)[:220]) from exc


@app.get("/entities/resolve", dependencies=[Depends(authenticated)])
def resolve_entities(q: str = Query(min_length=2, max_length=240)):
    return resolve(q.strip(), int(time.time() // 3600))


@app.get("/providers/health", dependencies=[Depends(authenticated)])
def providers_health():
    try:
        return configured_provider().health_check()
    except Exception as exc:
        return {"provider": "groq", "available": False, "fallback": "extractive", "reason": type(exc).__name__}


def encyclopedia_call(provider, *args):
    try:
        return provider(*args)
    except SourceHTTPError as exc:
        raise HTTPException(404 if exc.status == 404 else 503, "Article not found" if exc.status == 404 else "Wikipedia is temporarily unavailable") from exc
    except (ValueError, OSError, KeyError) as exc:
        raise HTTPException(503, "Wikipedia is temporarily unavailable. Please try again shortly.") from exc


@app.get("/encyclopedia/search", dependencies=[Depends(authenticated)])
def encyclopedia_search(q: str = Query(min_length=1, max_length=240), offset: int = Query(default=0, ge=0, le=10000)):
    return encyclopedia_call(encyclopedia.search, q, offset)


@app.get("/encyclopedia/article", dependencies=[Depends(authenticated)])
def encyclopedia_article(title: str = Query(min_length=1, max_length=240)):
    return encyclopedia_call(encyclopedia.article, title)


@app.get("/encyclopedia/topics", dependencies=[Depends(authenticated)])
def encyclopedia_topics(category: str = Query(default=encyclopedia.ROOT_CATEGORY, min_length=1, max_length=240), cursor: str = Query(default="", max_length=2000)):
    try:
        encyclopedia.decode_cursor(cursor)
    except ValueError as exc:
        raise HTTPException(422, "Invalid topic cursor") from exc
    return encyclopedia_call(encyclopedia.topics, category, cursor)
