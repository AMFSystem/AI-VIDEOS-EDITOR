"""Deep Voice Training Router for AI Studio.

Provides endpoints to:
1. Slices training audio, detects speech intervals, transcribes with Whisper.
2. Initiates neural fine-tuning loop (Epochs, Loss, Optimizer, Model Export).
3. Polls training progress.
4. Lists all permanently trained models.
"""

import json
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel

from app.config import Settings, get_settings
from app.deps import get_training_service
from app.services.training import VoiceTrainingService
from app.uploads import saved_upload

router = APIRouter(prefix="/training", tags=["voice-training"])


class PrepareDatasetOut(BaseModel):
    dataset_id: str
    dataset_path: str
    model_name: str
    total_segments: int
    total_duration: float
    segments: List[Dict[str, Any]]


class StartTrainingIn(BaseModel):
    dataset_path: str
    model_name: str
    language: str = "km"
    epochs: int = 15
    batch_size: int = 4
    learning_rate: float = 0.0001


class TrainingJobOut(BaseModel):
    job_id: str
    model_name: str
    language: str
    epochs: int
    current_epoch: int
    current_loss: float
    progress: int
    status: str
    stage: str
    error: Optional[str] = None
    created_at: str
    completed_at: Optional[str] = None
    metadata: Dict[str, Any] = {}


@router.post("/prepare", response_model=PrepareDatasetOut)
async def prepare_training_dataset(
    audio_file: UploadFile = File(..., description="1 to 15 minutes of speech audio"),
    model_name: str = Form(..., description="Name for the custom voice model"),
    language: str = Form("km", description="Language of the voice"),
    settings: Settings = Depends(get_settings),
    training_svc: VoiceTrainingService = Depends(get_training_service),
) -> PrepareDatasetOut:
    """Uploads long audio, segments it into training chunks, and prepares dataset."""
    try:
        async with saved_upload(audio_file, settings.tmp_dir, max_mb=100) as uploaded_path:
            result = await run_in_threadpool(
                training_svc.prepare_dataset, uploaded_path, model_name, language
            )
            return PrepareDatasetOut(**result)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to prepare training dataset: {exc}")


@router.post("/start", response_model=TrainingJobOut)
async def start_voice_training(
    payload: StartTrainingIn,
    training_svc: VoiceTrainingService = Depends(get_training_service),
) -> TrainingJobOut:
    """Begins deep learning fine-tuning loop."""
    job = training_svc.start_training(
        dataset_path=payload.dataset_path,
        model_name=payload.model_name,
        language=payload.language,
        epochs=payload.epochs,
        batch_size=payload.batch_size,
        learning_rate=payload.learning_rate,
    )
    return TrainingJobOut(
        job_id=job.id,
        model_name=job.model_name,
        language=job.language,
        epochs=job.epochs,
        current_epoch=job.current_epoch,
        current_loss=job.current_loss,
        progress=job.progress,
        status=job.status,
        stage=job.stage,
        error=job.error,
        created_at=job.created_at,
        completed_at=job.completed_at,
        metadata=job.metadata,
    )


@router.get("/jobs/{job_id}", response_model=TrainingJobOut)
async def get_training_job_status(
    job_id: str,
    training_svc: VoiceTrainingService = Depends(get_training_service),
) -> TrainingJobOut:
    """Polls progress of a training job."""
    job = training_svc.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Training job not found")
    return TrainingJobOut(
        job_id=job.id,
        model_name=job.model_name,
        language=job.language,
        epochs=job.epochs,
        current_epoch=job.current_epoch,
        current_loss=job.current_loss,
        progress=job.progress,
        status=job.status,
        stage=job.stage,
        error=job.error,
        created_at=job.created_at,
        completed_at=job.completed_at,
        metadata=job.metadata,
    )


@router.get("/models", response_model=List[Dict[str, Any]])
async def list_trained_models(
    training_svc: VoiceTrainingService = Depends(get_training_service),
) -> List[Dict[str, Any]]:
    """Lists all permanently saved fine-tuned voice models."""
    return training_svc.list_trained_models()


@router.delete("/models/{model_id}")
async def delete_trained_model(
    model_id: str,
    training_svc: VoiceTrainingService = Depends(get_training_service),
) -> Dict[str, Any]:
    """Deletes a permanently saved trained voice model directory."""
    deleted = training_svc.delete_trained_model(model_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Trained model not found")
    return {"status": "success", "deleted": True, "id": model_id}


@router.get("/models/{model_id}/audio", response_class=FileResponse)
async def get_trained_model_audio(
    model_id: str,
    settings: Settings = Depends(get_settings),
) -> FileResponse:
    """Returns the authentic reference audio of a trained voice model."""
    trained_dir = settings.model_dir / "trained_voices"
    if trained_dir.exists():
        for td in trained_dir.iterdir():
            if td.is_dir():
                mf = td / "model_manifest.json"
                if mf.exists():
                    try:
                        with open(mf, "r", encoding="utf-8") as f:
                            mdata = json.load(f)
                            if mdata.get("id") == model_id or td.name == model_id or model_id in td.name:
                                ref_path = td / "reference_speaker.wav"
                                if ref_path.exists():
                                    return FileResponse(ref_path, media_type="audio/wav", filename=f"{mdata.get('name', 'voice')}.wav")
                    except Exception:
                        pass
    raise HTTPException(status_code=404, detail=f"Trained model audio not found for ID: {model_id}")

