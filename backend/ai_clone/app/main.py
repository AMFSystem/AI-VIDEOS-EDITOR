import logging
from contextlib import asynccontextmanager

import redis
import redis.asyncio
from fastapi import FastAPI
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import auth, clone, health, stt, text, training, transcriptions, tts, voices
from app.config import get_settings
from app.db import create_engine, create_sessionmaker
from app.deps import get_clone_service, get_stt_service, get_tts_service
from app.services.clone_jobs import CloneJobQueue
from app.services.in_memory_redis import AsyncInMemoryRedis, InMemoryRedis

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Optimize CPU compute for fast, smooth speech synthesis & cloning
    try:
        import os
        import torch
        num_cores = os.cpu_count() or 4
        # Allocate optimal thread pool (up to 8 threads) to keep UI and background smooth
        target_threads = min(8, max(2, num_cores - 2 if num_cores > 4 else num_cores))
        torch.set_num_threads(target_threads)
        if hasattr(torch, "set_num_interop_threads"):
            try:
                torch.set_num_interop_threads(2)
            except Exception:
                pass
        logging.info("PyTorch CPU Threads configured: %d (System cores: %d)", target_threads, num_cores)
    except Exception as exc:
        logging.warning("Could not tune torch CPU threads: %s", exc)

    settings = get_settings()

    try:
        engine = create_engine(settings.database_url)
        app.state.sessionmaker = create_sessionmaker(engine)
    except Exception as exc:
        logging.warning("Database initialization failed (%s); operating in stateless/local mode.", exc)
        app.state.sessionmaker = None

    try:
        sync_redis = redis.Redis.from_url(settings.redis_url, decode_responses=True, socket_connect_timeout=1)
        sync_redis.ping()
        app.state.redis = redis.asyncio.Redis.from_url(settings.redis_url, decode_responses=True)
    except Exception as exc:
        logging.warning("Redis is offline (%s); using in-memory queue fallback.", exc)
        sync_redis = InMemoryRedis()
        app.state.redis = AsyncInMemoryRedis(sync_redis)

    app.state.clone_queue = CloneJobQueue(
        sync_redis, get_clone_service().run, settings.data_dir / "clone_jobs",
        max_pending=settings.clone_max_queue, ttl_s=settings.clone_result_ttl_s,
    )

    if settings.stt_preload:
        await run_in_threadpool(get_stt_service().load)
    if settings.tts_preload:
        for lang in ("km", "en"):
            await run_in_threadpool(get_tts_service().load, lang)
    if settings.clone_preload:
        await run_in_threadpool(get_clone_service().load)
    if settings.clone_worker_enabled:
        app.state.clone_queue.start_worker()

    yield

    app.state.clone_queue.stop_worker()
    sync_redis.close()
    await app.state.redis.aclose()
    await engine.dispose()


def create_app() -> FastAPI:
    settings = get_settings()
    settings.tmp_dir.mkdir(parents=True, exist_ok=True)
    settings.data_dir.mkdir(parents=True, exist_ok=True)

    app = FastAPI(title=settings.app_name, version=settings.version, lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    for router in (health, auth, text, stt, transcriptions, tts, voices, clone, training):
        app.include_router(router.router, prefix="/api/v1")
    return app


app = create_app()
