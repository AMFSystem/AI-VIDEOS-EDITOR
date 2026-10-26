import json
import shutil
import uuid
from typing import Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.voices import get_owned_voice, voice_audio_path
from app.auth import get_current_user
from app.config import Settings, get_settings
from app.db import User, get_db
from app.deps import get_clone_queue
from app.services.clone_jobs import CloneJob, CloneJobQueue, JobStatus, QueueFull, RefTextSource
from app.services.voice_clone import InvalidReference, load_reference
from app.uploads import saved_upload

router = APIRouter(prefix="/clone", tags=["voice-cloning"])

CONSENT_REQUIRED = ("Voice cloning requires consent: only clone your own voice "
                    "or a voice you have explicit permission to use.")


class CloneJobOut(BaseModel):
    job_id: str
    status: JobStatus
    progress: int = 0
    stage: str | None = None
    queue_position: int | None = None
    error: str | None = None
    voice_id: str | None = None
    reference_text: str | None = None
    reference_text_source: RefTextSource
    duration: float | None = None
    status_url: str
    audio_url: str | None = None


def _job_out(job: CloneJob, queue: CloneJobQueue, request: Request) -> CloneJobOut:
    return CloneJobOut(
        job_id=job.id,
        status=job.status,
        progress=getattr(job, "progress", 0) or 0,
        stage=getattr(job, "stage", None),
        queue_position=queue.position(job),
        error=job.error,
        voice_id=job.voice_id,
        reference_text=job.ref_text,
        reference_text_source=job.ref_text_source,
        duration=job.duration,
        status_url=str(request.url_for("clone_job_status", job_id=job.id)),
        audio_url=str(request.url_for("clone_job_audio", job_id=job.id)) if job.status == "done" else None,
    )


def _owned_job(job_id: str, user: User, queue: CloneJobQueue) -> CloneJob:
    job = queue.get(job_id)
    if job is None:
        raise HTTPException(404, "Job not found (it may have expired)")
    return job


@router.post("", status_code=202, response_model=CloneJobOut)
async def create_clone_job(
    request: Request,
    text: str = Form(..., min_length=1, description="What the cloned voice should say"),
    voice_id: str | None = Form(None, description="A saved voice or trained model ID to use instead of uploading audio"),
    reference_audio: UploadFile | None = File(None, description="3-30 s of the voice to clone, if not using voice_id"),
    consent: bool = Form(False, description="Required with reference_audio: the voice is yours or you have permission"),
    reference_text: str | None = Form(None, description="Transcript of reference_audio; transcribed automatically if omitted"),
    lang: Literal["auto", "km", "en"] = Form("auto"),
    speed: float = Form(1.0, ge=0.5, le=2.0),
    model: str = Form("voxcpm2"),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    queue: CloneJobQueue = Depends(get_clone_queue),
) -> CloneJobOut:
    """Queue a cloning job using either a saved `voice_id` or an uploaded `reference_audio`.

    Poll `status_url` until `status` is `done`, then download `audio_url`.
    """
    if (voice_id is None) == (reference_audio is None):
        raise HTTPException(422, "Provide exactly one of voice_id or reference_audio")
    if len(text) > settings.clone_max_chars:
        raise HTTPException(413, f"Text exceeds {settings.clone_max_chars} characters")

    # Strict model engine normalization
    target_engine = (model or "voxcpm2").strip().lower()
    if target_engine not in ("voxcpm2", "voxcpm", "omnivoice", "f5_tts", "f5tts"):
        raise HTTPException(
            400,
            f"Unsupported clone model: '{model}'. Strictly supported engines are 'voxcpm2' (OpenBMB 48kHz) and 'omnivoice' (F5-TTS 24kHz)."
        )

    job_id = uuid.uuid4().hex
    common = dict(id=job_id, user_id=str(user.id), text=text.strip(), lang=lang, speed=speed, model_engine=target_engine)

    if voice_id is not None and str(voice_id).strip():
        voice_str = str(voice_id).strip()
        if voice_str.startswith("trained_"):
            trained_dir = settings.model_dir / "trained_voices"
            target_manifest = None
            target_ref_audio = None
            if trained_dir.exists():
                for td in trained_dir.iterdir():
                    if td.is_dir():
                        mf = td / "model_manifest.json"
                        if mf.exists():
                            try:
                                with open(mf, "r", encoding="utf-8") as f:
                                    mdata = json.load(f)
                                    if mdata.get("id") == voice_str:
                                        target_manifest = mdata
                                        target_ref_audio = td / "reference_speaker.wav"
                                        break
                            except Exception:
                                pass
            if not target_ref_audio or not target_ref_audio.exists():
                raise HTTPException(404, f"Trained voice model {voice_str} not found or reference audio missing")
            ref_txt = (target_manifest.get("description") or target_manifest.get("name") or "គំរូសំឡេងបានបង្វឹក")
            job = CloneJob(**common, work_dir=queue.new_work_dir(job_id), voice_id=voice_str,
                           reference_path=target_ref_audio, delete_reference=False,
                           ref_text=ref_txt, ref_text_source="saved_voice")
        else:
            try:
                v_uuid = uuid.UUID(voice_str)
            except ValueError:
                raise HTTPException(400, f"Invalid voice_id format: {voice_str}")
            voice = await get_owned_voice(v_uuid, user, session)
            job = CloneJob(**common, work_dir=queue.new_work_dir(job_id), voice_id=str(voice.id),
                           reference_path=voice_audio_path(voice, settings), delete_reference=False,
                           ref_text=voice.reference_text, ref_text_source="saved_voice")
    else:
        if not consent:
            raise HTTPException(403, CONSENT_REQUIRED)
        work_dir = queue.new_work_dir(job_id)
        job = CloneJob(**common, work_dir=work_dir, reference_path=work_dir / "reference.wav",
                       ref_text=(reference_text or "").strip() or None)
        try:
            async with saved_upload(reference_audio, settings.tmp_dir, settings.max_upload_mb) as path:
                await run_in_threadpool(load_reference, path, job.reference_path,
                                        settings.clone_ref_min_s, settings.clone_ref_max_s)
        except InvalidReference as exc:
            shutil.rmtree(work_dir, ignore_errors=True)
            raise HTTPException(422, str(exc)) from exc
        except BaseException:
            shutil.rmtree(work_dir, ignore_errors=True)
            raise

    try:
        await run_in_threadpool(queue.submit, job)
    except QueueFull as exc:
        shutil.rmtree(job.work_dir, ignore_errors=True)
        raise HTTPException(503, str(exc), headers={"Retry-After": "30"}) from exc
    return _job_out(job, queue, request)


@router.get("/jobs/{job_id}", response_model=CloneJobOut, name="clone_job_status")
def clone_job_status(job_id: str, request: Request, user: User = Depends(get_current_user),
                     queue: CloneJobQueue = Depends(get_clone_queue)) -> CloneJobOut:
    return _job_out(_owned_job(job_id, user, queue), queue, request)


@router.get("/jobs/{job_id}/audio", response_class=FileResponse, name="clone_job_audio",
            responses={200: {"content": {"audio/wav": {}}}})
def clone_job_audio(job_id: str, user: User = Depends(get_current_user),
                    queue: CloneJobQueue = Depends(get_clone_queue)) -> FileResponse:
    job = _owned_job(job_id, user, queue)
    if job.status != "done":
        raise HTTPException(409, f"Job is {job.status}; audio is not available")
    return FileResponse(job.output_path, media_type="audio/wav", filename="cloned.wav")
