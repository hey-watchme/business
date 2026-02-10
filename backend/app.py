import os
import uuid
import io
import threading
from datetime import datetime
from typing import Optional

import boto3
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Header, Response, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client

# ASR provider selection (environment variable)
def get_asr_provider():
    """Get ASR provider based on environment variable

    Supported providers:
    - speechmatics (default): High accuracy speaker diarization
    - deepgram: Fast processing
    """
    provider_name = os.getenv("ASR_PROVIDER", "speechmatics").lower()

    if provider_name == "deepgram":
        from services.asr_provider import DeepgramASRService
        return DeepgramASRService()
    elif provider_name == "speechmatics":
        from services.asr_providers.speechmatics_provider import SpeechmaticsASRService
        return SpeechmaticsASRService()
    else:
        raise ValueError(f"Unknown ASR provider: {provider_name}. Supported: deepgram, speechmatics")

from services.llm_providers import get_current_llm, LLMFactory, CURRENT_PROVIDER, CURRENT_MODEL

# Load environment variables
load_dotenv()

# Initialize FastAPI
app = FastAPI(title="WatchMe Business API", version="1.0.0")

# CORS settings
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5176",
        "https://business.hey-watch.me",
        "https://business-hey-watchme.vercel.app"  # Add specific Vercel preview URL if needed
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Environment variables
AWS_REGION = os.getenv("AWS_REGION", "ap-southeast-2")
S3_BUCKET = os.getenv("S3_BUCKET", "watchme-business")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")  # Use service_role key for backend
API_TOKEN = os.getenv("API_TOKEN", "watchme-b2b-poc-2025")
SQS_TRANSCRIPTION_QUEUE_URL = os.getenv(
    "SQS_TRANSCRIPTION_QUEUE_URL",
    "https://sqs.ap-southeast-2.amazonaws.com/754724220380/business-transcription-completed-queue.fifo"
)
SQS_ANALYSIS_QUEUE_URL = os.getenv(
    "SQS_ANALYSIS_QUEUE_URL",
    "https://sqs.ap-southeast-2.amazonaws.com/754724220380/business-analysis-completed-queue.fifo"
)

# Initialize services
s3_client = boto3.client('s3', region_name=AWS_REGION)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None

# Pydantic models
class UploadResponse(BaseModel):
    success: bool
    session_id: str
    s3_path: str
    message: str

class TranscribeRequest(BaseModel):
    session_id: str

class TranscribeResponse(BaseModel):
    success: bool
    session_id: str
    transcription: str
    processing_time: float
    confidence: float
    word_count: int
    utterances: list
    paragraphs: list
    speaker_count: int
    model: str
    message: str

class AnalyzeRequest(BaseModel):
    session_id: str
    use_custom_prompt: bool = False
    provider: Optional[str] = None   # LLM provider ("openai", "gemini")
    model: Optional[str] = None      # Model name (e.g., "gpt-4o", "gpt-5.2-2025-12-11")


class PromptUpdate(BaseModel):
    phase: str  # "phase1" | "phase2" | "phase3"
    prompt: str


class AnalyzeResponse(BaseModel):
    success: bool
    session_id: str
    summary: str
    processing_time: float
    model: str
    message: str

# Support Plans models
class SupportPlanCreate(BaseModel):
    subject_id: str
    title: str
    plan_number: Optional[str] = None
    status: str = "draft"

class SupportPlanUpdate(BaseModel):
    title: Optional[str] = None
    plan_number: Optional[str] = None
    status: Optional[str] = None
    subject_id: Optional[str] = None
    # Header information
    facility_name: Optional[str] = None
    manager_name: Optional[str] = None
    monitoring_start: Optional[str] = None  # DATE as string
    monitoring_end: Optional[str] = None
    # Child information
    child_birth_date: Optional[str] = None
    guardian_name: Optional[str] = None
    # Intentions
    child_intention: Optional[str] = None
    family_intention: Optional[str] = None
    # Service schedule
    service_schedule: Optional[str] = None
    # Notes
    notes: Optional[str] = None
    # General policy
    general_policy: Optional[str] = None
    # Goals
    long_term_goal: Optional[str] = None
    long_term_period: Optional[str] = None
    short_term_goal: Optional[str] = None
    short_term_period: Optional[str] = None
    # Support items (7-column table data)
    support_items: Optional[list] = None
    # Consent information
    explainer_name: Optional[str] = None
    consent_date: Optional[str] = None
    guardian_signature: Optional[str] = None


class SupportPlanResponse(BaseModel):
    id: str
    facility_id: str
    subject_id: Optional[str]
    title: str
    plan_number: Optional[str]
    status: str
    created_by: Optional[str]
    created_at: str
    updated_at: str
    session_count: Optional[int] = 0

class SubjectResponse(BaseModel):
    id: str
    facility_id: Optional[str]  # Not in subjects table (use subject_relations)
    name: str
    age: Optional[int]
    gender: Optional[str]
    avatar_url: Optional[str]
    notes: Optional[str]
    prefecture: Optional[str]
    city: Optional[str]
    cognitive_type: Optional[str]
    created_at: str
    updated_at: str

class SubjectCreate(BaseModel):
    facility_id: str
    name: str
    age: Optional[int] = None
    gender: Optional[str] = None
    notes: Optional[str] = None
    birth_date: Optional[str] = None

class SubjectLinkRequest(BaseModel):
    facility_id: str

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "watchme-business-api",
        "s3_bucket": S3_BUCKET,
        "supabase_connected": supabase is not None
    }

@app.post("/api/upload", response_model=UploadResponse)
async def upload_audio(
    audio: UploadFile = File(...),
    facility_id: str = Form(...),
    subject_id: str = Form(...),
    support_plan_id: Optional[str] = Form(None),
    staff_id: Optional[str] = Form(None),
    x_api_token: str = Header(None, alias="X-API-Token")
):
    # Validate token
    if x_api_token != API_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid API token")

    # Validate file type
    if not audio.content_type.startswith('audio/'):
        raise HTTPException(status_code=400, detail="File must be audio format")

    try:
        # Generate session ID and S3 path
        session_id = str(uuid.uuid4())
        timestamp = datetime.now().strftime('%Y-%m-%d')
        s3_path = f"recordings/{facility_id}/{subject_id}/{timestamp}/{session_id}.webm"

        # Read file content
        file_content = await audio.read()

        # Upload to S3
        s3_client.put_object(
            Bucket=S3_BUCKET,
            Key=s3_path,
            Body=file_content,
            ContentType=audio.content_type
        )

        # Save to database
        if supabase:
            session_data = {
                'id': session_id,
                'facility_id': facility_id,
                'subject_id': subject_id,
                's3_audio_path': s3_path,
                'status': 'uploaded',
                'duration_seconds': 0,
                'recorded_at': datetime.now().isoformat()
            }

            # Add support_plan_id if provided
            if support_plan_id:
                session_data['support_plan_id'] = support_plan_id

            # Add staff_id if provided (from authenticated user)
            if staff_id:
                session_data['staff_id'] = staff_id

            supabase.table('business_interview_sessions').insert(session_data).execute()

        return UploadResponse(
            success=True,
            session_id=session_id,
            s3_path=s3_path,
            message="Audio uploaded successfully"
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@app.post("/api/transcribe")
async def transcribe_audio(
    request: TranscribeRequest,
    x_api_token: str = Header(None, alias="X-API-Token")
):
    """
    Asynchronous transcription endpoint (returns 202 Accepted)

    Flow:
    1. Validate request
    2. Update DB status to 'transcribing'
    3. Start background task
    4. Return 202 Accepted immediately
    """
    # Validate token
    if x_api_token != API_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid API token")

    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")

    if not SQS_TRANSCRIPTION_QUEUE_URL:
        raise HTTPException(status_code=500, detail="SQS queue not configured")

    try:
        # Get session from DB
        result = supabase.table('business_interview_sessions')\
            .select('*')\
            .eq('id', request.session_id)\
            .single()\
            .execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Session not found")

        session = result.data
        s3_audio_path = session.get('s3_audio_path')

        if not s3_audio_path:
            raise HTTPException(status_code=400, detail="No audio file path found")

        # Start background task
        from services.background_tasks import transcribe_background

        asr_service = get_asr_provider()

        thread = threading.Thread(
            target=transcribe_background,
            args=(
                request.session_id,
                s3_audio_path,
                s3_client,
                S3_BUCKET,
                supabase,
                asr_service,
                SQS_TRANSCRIPTION_QUEUE_URL
            )
        )
        thread.daemon = True
        thread.start()

        print(f"Started background transcription for session: {request.session_id}")

        return Response(
            status_code=202,
            content='{"status": "processing", "message": "Transcription started"}',
            media_type="application/json"
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start transcription: {str(e)}")

@app.post("/api/analyze")
async def analyze_interview(
    request: AnalyzeRequest,
    x_api_token: str = Header(None, alias="X-API-Token")
):
    """
    Asynchronous analysis endpoint (returns 202 Accepted)

    Flow:
    1. Validate request
    2. Update DB status to 'analyzing'
    3. Start background task
    4. Return 202 Accepted immediately
    """
    # Validate token
    if x_api_token != API_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid API token")

    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")

    try:
        # Get session from DB
        result = supabase.table('business_interview_sessions')\
            .select('*')\
            .eq('id', request.session_id)\
            .single()\
            .execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Session not found")

        session = result.data
        transcription = session.get('transcription')

        if not transcription:
            raise HTTPException(status_code=400, detail="Transcription not found. Please run /api/transcribe first.")

        # Start background task
        from services.background_tasks import analyze_background

        # Use specified provider/model or default
        if request.provider or request.model:
            provider = request.provider or CURRENT_PROVIDER
            model = request.model or CURRENT_MODEL
            llm_service = LLMFactory.create(provider, model)
            print(f"Using custom LLM: {llm_service.model_name}")
        else:
            llm_service = get_current_llm()

        thread = threading.Thread(
            target=analyze_background,
            args=(
                request.session_id,
                supabase,
                llm_service,
                SQS_ANALYSIS_QUEUE_URL,
                request.use_custom_prompt
            )
        )
        thread.daemon = True
        thread.start()

        print(f"Started background analysis for session: {request.session_id}")

        return Response(
            status_code=202,
            content='{"status": "processing", "message": "Analysis started"}',
            media_type="application/json"
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in analyze endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/structure-facts")
async def structure_facts(
    request: AnalyzeRequest,
    x_api_token: str = Header(None, alias="X-API-Token")
):
    """
    Phase 2: Fact Structuring (Asynchronous)

    Converts extraction_v1 into fact_clusters_v1
    - NO interpretation or inference
    - Only reorganize facts into neutral clusters

    Flow:
    1. Validate request
    2. Start background task
    3. Return 202 Accepted immediately
    """
    # Validate token
    if x_api_token != API_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid API token")

    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")

    try:
        # Get session from DB
        result = supabase.table('business_interview_sessions')\
            .select('fact_extraction_result_v1')\
            .eq('id', request.session_id)\
            .single()\
            .execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Session not found")

        extraction_result = result.data.get('fact_extraction_result_v1')

        if not extraction_result:
            raise HTTPException(
                status_code=400,
                detail="fact_extraction_result_v1 not found. Please run /api/analyze first."
            )

        # Handle different data structures (same logic as in background_tasks.py)
        has_valid_data = False

        # Case 1: Direct structure {"extraction_v1": {...}}
        if isinstance(extraction_result, dict) and 'extraction_v1' in extraction_result:
            has_valid_data = True

        # Case 2: Wrapped in summary {"summary": "```json\n{...}\n```"}
        elif isinstance(extraction_result, dict) and 'summary' in extraction_result:
            # Just check that summary exists and contains JSON
            summary_text = extraction_result.get('summary', '')
            if '```json' in summary_text and 'extraction_v1' in summary_text:
                has_valid_data = True

        if not has_valid_data:
            raise HTTPException(
                status_code=400,
                detail="fact_extraction_result_v1 is invalid. Please run /api/analyze first."
            )

        # Start background task
        from services.background_tasks import structure_facts_background

        # Use specified provider/model or default
        if request.provider or request.model:
            provider = request.provider or CURRENT_PROVIDER
            model = request.model or CURRENT_MODEL
            llm_service = LLMFactory.create(provider, model)
            print(f"Using custom LLM: {llm_service.model_name}")
        else:
            llm_service = get_current_llm()

        thread = threading.Thread(
            target=structure_facts_background,
            args=(
                request.session_id,
                supabase,
                llm_service,
                request.use_custom_prompt
            )
        )
        thread.daemon = True
        thread.start()

        print(f"Started background fact structuring for session: {request.session_id}")

        return Response(
            status_code=202,
            content='{"status": "processing", "message": "Fact structuring started"}',
            media_type="application/json"
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start fact structuring: {str(e)}")

@app.post("/api/assess")
async def assess(
    request: AnalyzeRequest,
    x_api_token: str = Header(None, alias="X-API-Token")
):
    """
    Phase 3: Assessment (Asynchronous)

    Generates individual support plan from fact_clusters_v1
    - Professional judgment and interpretation
    - Support policy, goals, and support items

    Flow:
    1. Validate request
    2. Start background task
    3. Return 202 Accepted immediately
    """
    # Validate token
    if x_api_token != API_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid API token")

    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")

    try:
        # Get session from DB
        result = supabase.table('business_interview_sessions')\
            .select('fact_structuring_result_v1')\
            .eq('id', request.session_id)\
            .single()\
            .execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Session not found")

        structuring_result = result.data.get('fact_structuring_result_v1')

        if not structuring_result:
            raise HTTPException(
                status_code=400,
                detail="fact_structuring_result_v1 not found. Please run /api/structure-facts first."
            )

        # Validate fact_clusters_v1 exists
        from services.llm_pipeline import validate_previous_phase_result

        has_valid_data = validate_previous_phase_result(structuring_result, 'fact_clusters_v1')

        if not has_valid_data:
            raise HTTPException(
                status_code=400,
                detail="fact_clusters_v1 is invalid. Please run /api/structure-facts first."
            )

        # Start background task
        from services.background_tasks import assess_background

        # Use specified provider/model or default
        if request.provider or request.model:
            provider = request.provider or CURRENT_PROVIDER
            model = request.model or CURRENT_MODEL
            llm_service = LLMFactory.create(provider, model)
            print(f"Using custom LLM: {llm_service.model_name}")
        else:
            llm_service = get_current_llm()

        thread = threading.Thread(
            target=assess_background,
            args=(
                request.session_id,
                supabase,
                llm_service,
                request.use_custom_prompt
            )
        )
        thread.daemon = True
        thread.start()

        print(f"Started background assessment for session: {request.session_id}")

        return Response(
            status_code=202,
            content='{"status": "processing", "message": "Assessment started"}',
            media_type="application/json"
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start assessment: {str(e)}")

@app.get("/api/sessions")
async def get_sessions(
    x_api_token: str = Header(None, alias="X-API-Token"),
    support_plan_id: Optional[str] = None,
    limit: Optional[int] = 50
):
    # Validate token
    if x_api_token != API_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid API token")

    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")

    try:
        query = supabase.table('business_interview_sessions').select('*')

        # Filter by support_plan_id if provided
        if support_plan_id:
            query = query.eq('support_plan_id', support_plan_id)

        result = query.order('recorded_at', desc=True).limit(limit).execute()

        return {"sessions": result.data, "count": len(result.data)}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch sessions: {str(e)}")

@app.get("/api/sessions/{session_id}")
async def get_session(
    session_id: str,
    x_api_token: str = Header(None, alias="X-API-Token")
):
    # Validate token
    if x_api_token != API_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid API token")

    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")

    try:
        result = supabase.table('business_interview_sessions')\
            .select('*')\
            .eq('id', session_id)\
            .single()\
            .execute()

        return result.data

    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Session not found: {str(e)}")

class SessionUpdate(BaseModel):
    support_plan_id: Optional[str] = None
    status: Optional[str] = None
    subject_id: Optional[str] = None

class TranscriptionUpdate(BaseModel):
    transcription: str

@app.put("/api/sessions/{session_id}")
async def update_session(
    session_id: str,
    update: SessionUpdate,
    x_api_token: str = Header(None, alias="X-API-Token")
):
    # Validate token
    if x_api_token != API_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid API token")

    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")

    try:
        update_data = {}
        if update.support_plan_id is not None:
            update_data['support_plan_id'] = update.support_plan_id
        if update.status is not None:
            update_data['status'] = update.status
        if update.subject_id is not None:
            update_data['subject_id'] = update.subject_id

        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")

        update_data['updated_at'] = datetime.now().isoformat()

        result = supabase.table('business_interview_sessions')\
            .update(update_data)\
            .eq('id', session_id)\
            .execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Session not found")

        return result.data[0]

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update session: {str(e)}")

@app.put("/api/sessions/{session_id}/transcription")
async def update_transcription(
    session_id: str,
    update: TranscriptionUpdate,
    x_api_token: str = Header(None, alias="X-API-Token")
):
    """
    Update transcription text for a session
    
    This allows manual editing of transcriptions (e.g., removing noise, casual conversations)
    before re-running AI analysis phases.
    """
    # Validate token
    if x_api_token != API_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid API token")

    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")

    try:
        # Validate transcription is not empty
        if not update.transcription or not update.transcription.strip():
            raise HTTPException(status_code=400, detail="Transcription cannot be empty")

        # Update transcription in database
        result = supabase.table('business_interview_sessions')\
            .update({
                'transcription': update.transcription.strip(),
                'updated_at': datetime.now().isoformat()
            })\
            .eq('id', session_id)\
            .execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Session not found")

        return {
            "success": True,
            "session_id": session_id,
            "message": "Transcription updated successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update transcription: {str(e)}")


@app.put("/api/sessions/{session_id}/prompt")
async def update_prompt(
    session_id: str,
    update: PromptUpdate,
    x_api_token: str = Header(None, alias="X-API-Token")
):
    """
    Update LLM prompt for a specific phase

    Allows manual editing of prompts before re-running analysis phases.

    Args:
        session_id: Session ID
        update: PromptUpdate with phase ("phase1"|"phase2"|"phase3") and prompt text
    """
    if x_api_token != API_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid API token")

    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")

    # Map phase to DB column
    phase_column_map = {
        "phase1": "fact_extraction_prompt_v1",
        "phase2": "fact_structuring_prompt_v1",
        "phase3": "assessment_prompt_v1",
    }

    column = phase_column_map.get(update.phase)
    if not column:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid phase: {update.phase}. Must be phase1, phase2, or phase3"
        )

    if not update.prompt or not update.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")

    try:
        result = supabase.table('business_interview_sessions')\
            .update({
                column: update.prompt.strip(),
                'updated_at': datetime.now().isoformat()
            })\
            .eq('id', session_id)\
            .execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Session not found")

        return {
            "success": True,
            "session_id": session_id,
            "phase": update.phase,
            "message": f"Prompt for {update.phase} updated successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update prompt: {str(e)}")


class ManualSessionCreate(BaseModel):
    facility_id: str
    subject_id: str
    support_plan_id: Optional[str] = None
    transcription: Optional[str] = None

@app.post("/api/sessions/manual")
async def create_manual_session(
    request: ManualSessionCreate,
    x_api_token: str = Header(None, alias="X-API-Token")
):
    """
    Create a session without audio upload for manual transcription input.
    Allows starting the analysis pipeline (Phase 1-2-3) from manually entered text.
    """
    if x_api_token != API_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid API token")

    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")

    try:
        session_id = str(uuid.uuid4())
        transcription = request.transcription.strip() if request.transcription else None
        status = 'transcribed' if transcription else 'uploaded'

        session_data = {
            'id': session_id,
            'facility_id': request.facility_id,
            'subject_id': request.subject_id,
            'status': status,
            'recorded_at': datetime.now().isoformat(),
        }
        if request.support_plan_id:
            session_data['support_plan_id'] = request.support_plan_id
        if transcription:
            session_data['transcription'] = transcription

        result = supabase.table('business_interview_sessions')\
            .insert(session_data)\
            .execute()

        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create session")

        return {
            "success": True,
            "session_id": session_id,
            "message": "Manual session created successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create manual session: {str(e)}")

# Support Plans endpoints
@app.post("/api/support-plans", response_model=SupportPlanResponse)
async def create_support_plan(
    plan: SupportPlanCreate,
    x_api_token: str = Header(None, alias="X-API-Token")
):
    # Validate token
    if x_api_token != API_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid API token")

    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")

    try:
        # Generate UUID for new plan
        plan_id = str(uuid.uuid4())

        # Use dummy facility_id and created_by (will be replaced with auth later)
        facility_id = "00000000-0000-0000-0000-000000000001"  # Test facility
        created_by = None  # Will be set by auth later

        # Calculate monitoring period (6 months from creation date)
        from datetime import datetime, timedelta
        monitoring_start = datetime.now().date()
        monitoring_end = (monitoring_start + timedelta(days=180))  # 6 months (~180 days)

        # Insert into database
        result = supabase.table('business_support_plans').insert({
            'id': plan_id,
            'facility_id': facility_id,
            'subject_id': plan.subject_id,
            'title': plan.title,
            'plan_number': plan.plan_number,
            'status': plan.status,
            'created_by': created_by,
            'monitoring_start': monitoring_start.isoformat(),
            'monitoring_end': monitoring_end.isoformat()
        }).execute()

        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create support plan")

        created_plan = result.data[0]

        return SupportPlanResponse(
            id=created_plan['id'],
            facility_id=created_plan['facility_id'],
            subject_id=created_plan.get('subject_id'),
            title=created_plan['title'],
            plan_number=created_plan.get('plan_number'),
            status=created_plan['status'],
            created_by=created_plan.get('created_by'),
            created_at=created_plan['created_at'],
            updated_at=created_plan['updated_at'],
            session_count=0
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create support plan: {str(e)}")

@app.get("/api/support-plans")
async def get_support_plans(
    x_api_token: str = Header(None, alias="X-API-Token"),
    facility_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: Optional[int] = 50
):
    # Validate token
    if x_api_token != API_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid API token")

    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")

    try:
        # Build query
        query = supabase.table('business_support_plans').select('*, subjects!inner(name, age, birth_date)')





        if facility_id:
            query = query.eq('facility_id', facility_id)

        if status:
            query = query.eq('status', status)

        result = query.order('created_at', desc=True).limit(limit).execute()

        # Optimization: Fetch all session counts in one query instead of N queries
        if result.data:
            plan_ids = [plan['id'] for plan in result.data]

            # Get all sessions for these plans in one query
            sessions_result = supabase.table('business_interview_sessions')\
                .select('support_plan_id')\
                .in_('support_plan_id', plan_ids)\
                .execute()

            # Count sessions per plan
            session_counts = {}
            for session in sessions_result.data:
                plan_id = session['support_plan_id']
                session_counts[plan_id] = session_counts.get(plan_id, 0) + 1

            # Add session count to each plan
            plans_with_counts = []
            for plan in result.data:
                plans_with_counts.append({
                    **plan,
                    'session_count': session_counts.get(plan['id'], 0)
                })
        else:
            plans_with_counts = []

        return {"plans": plans_with_counts, "count": len(plans_with_counts)}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch support plans: {str(e)}")

@app.get("/api/support-plans/{plan_id}")
async def get_support_plan(
    plan_id: str,
    x_api_token: str = Header(None, alias="X-API-Token")
):
    # Validate token
    if x_api_token != API_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid API token")

    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")

    try:
        # Get support plan with subject info
        plan_result = supabase.table('business_support_plans')\
            .select('*, subjects!inner(name, age, birth_date)')\
            .eq('id', plan_id)\
            .single()\
            .execute()





        if not plan_result.data:
            raise HTTPException(status_code=404, detail="Support plan not found")

        # Get associated sessions
        sessions_result = supabase.table('business_interview_sessions')\
            .select('*')\
            .eq('support_plan_id', plan_id)\
            .order('recorded_at', desc=True)\
            .execute()

        return {
            **plan_result.data,
            'sessions': sessions_result.data,
            'session_count': len(sessions_result.data)
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch support plan: {str(e)}")

@app.put("/api/support-plans/{plan_id}")
async def update_support_plan(
    plan_id: str,
    plan: SupportPlanUpdate,
    x_api_token: str = Header(None, alias="X-API-Token")
):
    # Validate token
    if x_api_token != API_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid API token")

    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")

    try:
        # Build update data from all possible fields
        update_data = {}
        
        # Basic fields
        if plan.title is not None:
            update_data['title'] = plan.title
        if plan.plan_number is not None:
            update_data['plan_number'] = plan.plan_number
        if plan.status is not None:
            update_data['status'] = plan.status
        if plan.subject_id is not None:
            update_data['subject_id'] = plan.subject_id
        
        # Header information
        if plan.facility_name is not None:
            update_data['facility_name'] = plan.facility_name
        if plan.manager_name is not None:
            update_data['manager_name'] = plan.manager_name
        if plan.monitoring_start is not None:
            update_data['monitoring_start'] = plan.monitoring_start
        if plan.monitoring_end is not None:
            update_data['monitoring_end'] = plan.monitoring_end
        
        # Child information
        if plan.child_birth_date is not None:
            update_data['child_birth_date'] = plan.child_birth_date
        if plan.guardian_name is not None:
            update_data['guardian_name'] = plan.guardian_name
        
        # Intentions
        if plan.child_intention is not None:
            update_data['child_intention'] = plan.child_intention
        if plan.family_intention is not None:
            update_data['family_intention'] = plan.family_intention
        
        # Service schedule
        if plan.service_schedule is not None:
            update_data['service_schedule'] = plan.service_schedule
        
        # Notes
        if plan.notes is not None:
            update_data['notes'] = plan.notes
        
        # General policy
        if plan.general_policy is not None:
            update_data['general_policy'] = plan.general_policy
        
        # Goals
        if plan.long_term_goal is not None:
            update_data['long_term_goal'] = plan.long_term_goal
        if plan.long_term_period is not None:
            update_data['long_term_period'] = plan.long_term_period
        if plan.short_term_goal is not None:
            update_data['short_term_goal'] = plan.short_term_goal
        if plan.short_term_period is not None:
            update_data['short_term_period'] = plan.short_term_period
        
        # Support items (JSONB)
        if plan.support_items is not None:
            update_data['support_items'] = plan.support_items
        
        # Consent information
        if plan.explainer_name is not None:
            update_data['explainer_name'] = plan.explainer_name
        if plan.consent_date is not None:
            update_data['consent_date'] = plan.consent_date
        if plan.guardian_signature is not None:
            update_data['guardian_signature'] = plan.guardian_signature

        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")

        # Update database
        result = supabase.table('business_support_plans')\
            .update(update_data)\
            .eq('id', plan_id)\
            .execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Support plan not found")

        return result.data[0]

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update support plan: {str(e)}")


@app.delete("/api/support-plans/{plan_id}")
async def delete_support_plan(
    plan_id: str,
    x_api_token: str = Header(None, alias="X-API-Token")
):
    # Validate token
    if x_api_token != API_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid API token")

    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")

    try:
        # Check if plan has sessions
        sessions_result = supabase.table('business_interview_sessions')\
            .select('id', count='exact')\
            .eq('support_plan_id', plan_id)\
            .execute()

        session_count = sessions_result.count if sessions_result.count else 0

        # Delete support plan (cascade will delete sessions if configured)
        result = supabase.table('business_support_plans')\
            .delete()\
            .eq('id', plan_id)\
            .execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Support plan not found")

        return {
            "success": True,
            "message": f"Support plan deleted (with {session_count} sessions)"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete support plan: {str(e)}")


class SyncFromAssessmentResponse(BaseModel):
    success: bool
    plan_id: str
    synced_fields: list
    message: str


@app.post("/api/support-plans/{plan_id}/sync-from-assessment", response_model=SyncFromAssessmentResponse)
async def sync_from_assessment(
    plan_id: str,
    x_api_token: str = Header(None, alias="X-API-Token")
):
    """
    Sync assessment_v1 data to business_support_plans xxx_ai_generated columns

    This endpoint transfers AI-generated data from the session's assessment_result_v1
    to the support plan's xxx_ai_generated columns for Human-in-the-Loop editing.

    Args:
        plan_id: Support plan ID
        x_api_token: API token

    Returns:
        SyncFromAssessmentResponse with synced field names
    """
    # Validate token
    if x_api_token != API_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid API token")

    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")

    try:
        # 1. Get support plan with linked sessions
        plan_result = supabase.table('business_support_plans')\
            .select('id')\
            .eq('id', plan_id)\
            .single()\
            .execute()

        if not plan_result.data:
            raise HTTPException(status_code=404, detail="Support plan not found")

        # 2. Get sessions linked to this plan
        sessions_result = supabase.table('business_interview_sessions')\
            .select('id, assessment_result_v1')\
            .eq('support_plan_id', plan_id)\
            .order('recorded_at', desc=True)\
            .limit(1)\
            .execute()

        if not sessions_result.data:
            raise HTTPException(status_code=400, detail="No session linked to this plan")

        session = sessions_result.data[0]
        assessment_result = session.get('assessment_result_v1')

        if not assessment_result:
            raise HTTPException(status_code=400, detail="No assessment_v1 found in session")

        # 3. Extract assessment_v1 from various formats
        from services.excel_generator import extract_assessment_v1
        assessment_v1 = extract_assessment_v1(assessment_result)

        if not assessment_v1:
            raise HTTPException(status_code=400, detail="Failed to extract assessment_v1")

        # 4. Build update data according to mapping
        update_data = {}
        synced_fields = []

        # family_child_intentions -> child_intention, family_intention
        if assessment_v1.get('family_child_intentions'):
            intentions = assessment_v1['family_child_intentions']
            if intentions.get('child'):
                update_data['child_intention_ai_generated'] = intentions['child']
                synced_fields.append('child_intention')
            if intentions.get('parents'):
                update_data['family_intention_ai_generated'] = intentions['parents']
                synced_fields.append('family_intention')

        # support_policy -> general_policy, key_approaches, collaboration_notes
        if assessment_v1.get('support_policy'):
            policy = assessment_v1['support_policy']
            if policy.get('child_understanding'):
                update_data['general_policy_ai_generated'] = policy['child_understanding']
                synced_fields.append('general_policy')
            if policy.get('key_approaches'):
                update_data['key_approaches_ai_generated'] = policy['key_approaches']
                synced_fields.append('key_approaches')
            if policy.get('collaboration_notes'):
                update_data['collaboration_notes_ai_generated'] = policy['collaboration_notes']
                synced_fields.append('collaboration_notes')

        # long_term_goal
        if assessment_v1.get('long_term_goal'):
            ltg = assessment_v1['long_term_goal']
            if ltg.get('goal'):
                update_data['long_term_goal_ai_generated'] = ltg['goal']
                synced_fields.append('long_term_goal')
            if ltg.get('timeline'):
                update_data['long_term_period_ai_generated'] = ltg['timeline']
                synced_fields.append('long_term_period')
            if ltg.get('rationale'):
                update_data['long_term_rationale_ai_generated'] = ltg['rationale']
                synced_fields.append('long_term_rationale')

        # short_term_goals (JSONB array)
        if assessment_v1.get('short_term_goals'):
            update_data['short_term_goals_ai_generated'] = assessment_v1['short_term_goals']
            synced_fields.append('short_term_goals')

        # support_items (JSONB array)
        if assessment_v1.get('support_items'):
            update_data['support_items_ai_generated'] = assessment_v1['support_items']
            synced_fields.append('support_items')

        # family_support (JSONB)
        if assessment_v1.get('family_support'):
            update_data['family_support_ai_generated'] = assessment_v1['family_support']
            synced_fields.append('family_support')

        # transition_support (JSONB)
        if assessment_v1.get('transition_support'):
            update_data['transition_support_ai_generated'] = assessment_v1['transition_support']
            synced_fields.append('transition_support')

        if not update_data:
            raise HTTPException(status_code=400, detail="No data to sync from assessment_v1")

        # 5. Update business_support_plans
        supabase.table('business_support_plans')\
            .update(update_data)\
            .eq('id', plan_id)\
            .execute()

        return SyncFromAssessmentResponse(
            success=True,
            plan_id=plan_id,
            synced_fields=synced_fields,
            message=f"Synced {len(synced_fields)} fields from assessment_v1"
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error syncing from assessment: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to sync: {str(e)}")

@app.get("/api/me")
async def get_current_user_profile(
    user_id: str,
    x_api_token: str = Header(None, alias="X-API-Token")
):
    # Validate token
    if x_api_token != API_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid API token")

    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")

    try:
        # Fetch user profile using service role (bypassing RLS)
        res = supabase.table('users').select('*').eq('user_id', user_id).single().execute()
        
        if not res.data:
            raise HTTPException(status_code=404, detail="User profile not found")
        
        user_data = res.data
        
        # Fetch facility/org info if exists
        facility_name = None
        organization_name = None
        
        if user_data.get('facility_id'):
            f_res = supabase.table('business_facilities').select('name, organization_id').eq('id', user_data['facility_id']).single().execute()
            if f_res.data:
                facility_name = f_res.data['name']
                if f_res.data.get('organization_id'):
                    o_res = supabase.table('business_organizations').select('name').eq('id', f_res.data['organization_id']).single().execute()
                    if o_res.data:
                        organization_name = o_res.data['name']

        return {
            **user_data,
            "facility_name": facility_name,
            "organization_name": organization_name
        }

    except Exception as e:
        print(f"Error fetching profile: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/subjects")
async def get_subjects(
    x_api_token: str = Header(None, alias="X-API-Token"),
    facility_id: Optional[str] = None,
    limit: Optional[int] = 100
):
    # Validate token
    if x_api_token != API_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid API token")

    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")

    try:
        # Query subjects using business_facility_subjects for filtering if facility_id is provided
        if facility_id:
            # We use business_facility_subjects!inner to only return subjects linked to this facility
            query = supabase.table('subjects').select('subject_id, name, age, gender, avatar_url, notes, prefecture, city, cognitive_type, birth_date, diagnosis, school_name, school_type, created_at, updated_at, business_facility_subjects!inner(facility_id)')

            query = query.eq('business_facility_subjects.facility_id', facility_id)
        else:
            # If no facility_id is provided, we return an empty list for safety
            # (unless the user is a super-admin, which we haven't implemented yet)
            return {
                "subjects": [],
                "analytics": {
                    "total_count": 0,
                    "gender_distribution": {"male": 0, "female": 0, "other": 0, "unknown": 0},
                    "age_groups": {"0-3": 0, "4-6": 0, "7-9": 0, "10+": 0, "unknown": 0}
                }
            }

        result = query.order('name', desc=False).limit(limit).execute()
        
        if result.data and len(result.data) > 0:
            print(f"DEBUG: Raw first subject from DB: {result.data[0]}")

        subjects = []

        subjects = []
        for subject in result.data:
            # Create a copy and map subject_id to id for the frontend
            s_data = subject.copy()
            s_data['id'] = s_data.get('subject_id')
            # Remove the join internal data
            if 'business_facility_subjects' in s_data:
                del s_data['business_facility_subjects']
            subjects.append(s_data)



        # Calculate analytics from actual data
        total_count = len(subjects)
        male_count = sum(1 for s in subjects if s.get('gender') in ['男性', 'male'])
        female_count = sum(1 for s in subjects if s.get('gender') in ['女性', 'female'])

        # Calculate age groups
        age_groups = {"0-3": 0, "4-6": 0, "7-9": 0, "10+": 0, "unknown": 0}
        for s in subjects:
            age = s.get('age')
            if age is None:
                age_groups["unknown"] += 1
            elif age <= 3:
                age_groups["0-3"] += 1
            elif age <= 6:
                age_groups["4-6"] += 1
            elif age <= 9:
                age_groups["7-9"] += 1
            else:
                age_groups["10+"] += 1

        return {
            "subjects": subjects,
            "analytics": {
                "total_count": total_count,
                "gender_distribution": {
                    "male": male_count,
                    "female": female_count,
                    "other": 0,
                    "unknown": total_count - male_count - female_count
                },
                "age_groups": age_groups
            }
        }

    except Exception as e:
        print(f"Error in get_subjects: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch children: {str(e)}")


@app.post("/api/subjects", response_model=SubjectResponse)
async def create_subject(
    subject: SubjectCreate,
    x_api_token: str = Header(None, alias="X-API-Token")
):
    # Validate token
    if x_api_token != API_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid API token")

    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")

    try:
        # 1. Create subject
        subject_id = str(uuid.uuid4())
        subject_data = {
            'subject_id': subject_id,
            'name': subject.name,
            'age': subject.age,
            'gender': subject.gender,
            'notes': subject.notes,
            'birth_date': subject.birth_date
        }
        
        sub_res = supabase.table('subjects').insert(subject_data).execute()
        if not sub_res.data:
            raise HTTPException(status_code=500, detail="Failed to create subject")

        # 2. Create relation in business_facility_subjects
        rel_data = {
            'subject_id': subject_id,
            'facility_id': subject.facility_id,
            'status': 'active'
        }
        supabase.table('business_facility_subjects').insert(rel_data).execute()

        new_subject = sub_res.data[0]
        return SubjectResponse(
            id=new_subject.get('subject_id'),
            facility_id=subject.facility_id,
            name=new_subject.get('name'),
            age=new_subject.get('age'),
            gender=new_subject.get('gender'),
            avatar_url=new_subject.get('avatar_url'),
            notes=new_subject.get('notes'),
            prefecture=new_subject.get('prefecture'),
            city=new_subject.get('city'),
            cognitive_type=new_subject.get('cognitive_type'),
            created_at=new_subject.get('created_at'),
            updated_at=new_subject.get('updated_at')
        )

    except Exception as e:
        print(f"Error creating subject: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/subjects/{subject_id}/link")
async def link_subject_to_facility(
    subject_id: str,
    link_request: SubjectLinkRequest,
    x_api_token: str = Header(None, alias="X-API-Token")
):
    # Validate token
    if x_api_token != API_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid API token")

    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")

    try:
        # Create relation in business_facility_subjects
        rel_data = {
            'subject_id': subject_id,
            'facility_id': link_request.facility_id,
            'status': 'active'
        }
        
        # Use upsert to handle cases where relation might already exist
        result = supabase.table('business_facility_subjects').upsert(
            rel_data, 
            on_conflict='subject_id, facility_id'
        ).execute()
        
        return {"success": True, "message": "Subject linked to facility successfully"}

    except Exception as e:
        print(f"Error linking subject: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/subjects/{subject_id}")
async def get_subject(
    subject_id: str,
    x_api_token: str = Header(None, alias="X-API-Token")
):
    # Validate token
    if x_api_token != API_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid API token")

    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")

    try:
        # Get subject details (integrated architecture)
        result = supabase.table('subjects')\
            .select('*')\
            .eq('subject_id', subject_id)\
            .single()\
            .execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Subject not found")

        subject = result.data

        # Get related sessions count
        sessions_result = supabase.table('business_interview_sessions')\
            .select('id', count='exact')\
            .eq('subject_id', subject_id)\
            .execute()

        session_count = sessions_result.count if sessions_result.count else 0

        # Get related support plans
        plans_result = supabase.table('business_support_plans')\
            .select('*')\
            .eq('subject_id', subject_id)\
            .order('created_at', desc=True)\
            .execute()

        return {
            "subject": SubjectResponse(
                id=subject.get('subject_id'),
                facility_id=None,  # Not in subjects table (use subject_relations)
                name=subject.get('name'),
                age=subject.get('age'),
                gender=subject.get('gender'),
                avatar_url=subject.get('avatar_url'),
                notes=subject.get('notes'),
                prefecture=subject.get('prefecture'),
                city=subject.get('city'),
                cognitive_type=subject.get('cognitive_type'),
                created_at=subject.get('created_at'),
                updated_at=subject.get('updated_at')
            ),
            "session_count": session_count,
            "support_plans": plans_result.data if plans_result.data else []
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch child: {str(e)}")

@app.get("/api/sessions/{session_id}/download-excel")
async def download_support_plan_excel(
    session_id: str,
    plan_id: Optional[str] = Query(None, description="Optional support plan ID for user-edited data"),
    x_api_token: str = Header(None, alias="X-API-Token")
):
    """
    Download Individual Support Plan as Excel file

    Args:
        session_id: Session ID
        plan_id: Optional business_support_plans ID for user-edited data
        x_api_token: API token

    Returns:
        Excel file (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)

    Data Source Priority:
        1. If plan_id provided -> business_support_plans (with user edits)
        2. If plan_id not provided -> assessment_v1 (AI-generated only)
    """
    # Validate token
    if x_api_token != API_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid API token")

    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")

    try:
        # Get session data
        result = supabase.table('business_interview_sessions')\
            .select('*')\
            .eq('id', session_id)\
            .single()\
            .execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Session not found")

        session_data = result.data

        # Check if assessment_result_v1 exists
        if not session_data.get('assessment_result_v1'):
            raise HTTPException(
                status_code=400,
                detail="Assessment result not found. Please run /api/assess first."
            )

        # If plan_id not provided, try to get from session
        if not plan_id:
            plan_id = session_data.get('support_plan_id')

        # Get subject (child) information
        subject_id = session_data.get('subject_id')
        if subject_id:
            try:
                subject_result = supabase.table('subjects')\
                    .select('subject_id, name, age')\
                    .eq('subject_id', subject_id)\
                    .single()\
                    .execute()

                if subject_result.data:
                    # Add subject info to session_data
                    session_data['subject_name'] = subject_result.data.get('name')
                    session_data['subject_age'] = subject_result.data.get('age')
            except Exception as e:
                print(f"Failed to fetch subject info: {str(e)}")
                # Continue without subject info

        # Generate Excel with plan_id
        from services.excel_generator import generate_support_plan_excel

        excel_bytes = generate_support_plan_excel(session_data, plan_id=plan_id)

        # Return Excel file
        return Response(
            content=excel_bytes.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f"attachment; filename=individual_support_plan_{session_id[:8]}.xlsx"
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error generating Excel: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate Excel: {str(e)}")


@app.get("/api/support-plans/{plan_id}/download-excel")
async def download_support_plan_excel_by_plan(
    plan_id: str,
    x_api_token: str = Header(None, alias="X-API-Token")
):
    """
    Download Individual Support Plan as Excel file by plan_id only (session not required)

    Args:
        plan_id: Support plan ID
        x_api_token: API token

    Returns:
        Excel file (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)

    Note:
        This endpoint generates Excel from business_support_plans data directly,
        without requiring a session. Use this for manually created plans.
    """
    # Validate token
    if x_api_token != API_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid API token")

    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")

    try:
        # Get plan data
        plan_result = supabase.table('business_support_plans')\
            .select('*')\
            .eq('id', plan_id)\
            .single()\
            .execute()

        if not plan_result.data:
            raise HTTPException(status_code=404, detail="Plan not found")

        plan_data = plan_result.data

        # Get subject (child) information if available
        subject_data = None
        subject_id = plan_data.get('subject_id')
        if subject_id:
            try:
                subject_result = supabase.table('subjects')\
                    .select('subject_id, name, age, gender, birth_date')\
                    .eq('subject_id', subject_id)\
                    .single()\
                    .execute()

                if subject_result.data:
                    subject_data = subject_result.data
            except Exception as e:
                print(f"Failed to fetch subject info: {str(e)}")
                # Continue without subject info

        # Generate Excel from plan_data only
        from services.excel_generator import generate_support_plan_excel_from_plan

        excel_bytes = generate_support_plan_excel_from_plan(
            plan_data=plan_data,
            subject_data=subject_data
        )

        # Build filename (ASCII only for compatibility)
        filename = f"support_plan_{plan_id[:8]}.xlsx"

        # Return Excel file
        return Response(
            content=excel_bytes.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error generating Excel from plan: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate Excel: {str(e)}")


# ==================== USERS API ====================

@app.get("/api/users")
async def get_users(
    x_api_token: str = Header(None, alias="X-API-Token"),
    facility_id: Optional[str] = None,
    limit: Optional[int] = 100
):
    # Validate token
    if x_api_token != API_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid API token")

    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")

    try:
        # Query users from public.users table
        query = supabase.table('users').select('*')

        if facility_id:
            query = query.eq('facility_id', facility_id)
        else:
            # If no facility_id is provided, return empty for safety in B2B context
            return {
                "users": [],
                "analytics": {
                    "total_count": 0,
                    "role_distribution": {}
                }
            }

        result = query.order('name', desc=False).limit(limit).execute()

        users = []
        for user in result.data:
            users.append({
                "id": user.get('user_id'),
                "email": user.get('email'),
                "display_name": user.get('name'),
                "avatar_url": user.get('avatar_url'),
                "role": user.get('role'),
                "facility_id": user.get('facility_id'),
                "created_at": user.get('created_at'),
                "updated_at": user.get('updated_at')
            })

        # Calculate analytics from actual data
        total_count = len(users)

        # Calculate role distribution
        role_counts = {}
        for u in users:
            role = u.get('role') or 'unknown'
            role_counts[role] = role_counts.get(role, 0) + 1

        return {
            "users": users,
            "analytics": {
                "total_count": total_count,
                "role_distribution": role_counts
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch users: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8052))
    uvicorn.run(app, host="0.0.0.0", port=port)