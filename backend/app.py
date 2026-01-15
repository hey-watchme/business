import os
import uuid
import io
import threading
from datetime import datetime
from typing import Optional

import boto3
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Header, Response
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

from services.llm_providers import get_current_llm, CURRENT_PROVIDER, CURRENT_MODEL

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

class AnalyzeResponse(BaseModel):
    success: bool
    session_id: str
    summary: str
    processing_time: float
    model: str
    message: str

# Support Plans models
class SupportPlanCreate(BaseModel):
    title: str
    plan_number: Optional[str] = None
    status: str = "draft"

class SupportPlanUpdate(BaseModel):
    title: Optional[str] = None
    plan_number: Optional[str] = None
    status: Optional[str] = None
    subject_id: Optional[str] = None

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
    facility_id: str
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
    child_id: str = Form(...),  # Keep as child_id in API for frontend compatibility
    support_plan_id: Optional[str] = Form(None),
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
        s3_path = f"recordings/{facility_id}/{child_id}/{timestamp}/{session_id}.webm"

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
                'subject_id': child_id,  # Column name is subject_id, but we use child_id from API
                's3_audio_path': s3_path,
                'status': 'uploaded',
                'duration_seconds': 0,  # To be calculated later
                'recorded_at': datetime.now().isoformat()
            }

            # Add support_plan_id if provided
            if support_plan_id:
                session_data['support_plan_id'] = support_plan_id

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
        from services.llm_providers import get_current_llm

        llm_service = get_current_llm()

        thread = threading.Thread(
            target=analyze_background,
            args=(
                request.session_id,
                supabase,
                llm_service,
                SQS_ANALYSIS_QUEUE_URL
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
        raise HTTPException(status_code=500, detail=f"Failed to start analysis: {str(e)}")

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

        # Insert into database
        result = supabase.table('business_support_plans').insert({
            'id': plan_id,
            'facility_id': facility_id,
            'subject_id': None,
            'title': plan.title,
            'plan_number': plan.plan_number,
            'status': plan.status,
            'created_by': created_by
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
        query = supabase.table('business_support_plans').select('*')

        if facility_id:
            query = query.eq('facility_id', facility_id)

        if status:
            query = query.eq('status', status)

        result = query.order('created_at', desc=True).limit(limit).execute()

        # Add session count for each plan
        plans_with_counts = []
        for plan in result.data:
            session_count_result = supabase.table('business_interview_sessions')\
                .select('id', count='exact')\
                .eq('support_plan_id', plan['id'])\
                .execute()

            plans_with_counts.append({
                **plan,
                'session_count': session_count_result.count if session_count_result.count else 0
            })

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
        # Get support plan
        plan_result = supabase.table('business_support_plans')\
            .select('*')\
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
        # Build update data
        update_data = {}
        if plan.title is not None:
            update_data['title'] = plan.title
        if plan.plan_number is not None:
            update_data['plan_number'] = plan.plan_number
        if plan.status is not None:
            update_data['status'] = plan.status
        if plan.subject_id is not None:
            update_data['subject_id'] = plan.subject_id

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
        # Query subjects
        query = supabase.table('business_subjects').select('*')

        # Filter by facility_id if provided
        if facility_id:
            query = query.eq('facility_id', facility_id)

        result = query.order('name', desc=False).limit(limit).execute()

        subjects = []
        for subject in result.data:
            subjects.append({
                "id": subject.get('id'),
                "facility_id": subject.get('facility_id'),
                "name": subject.get('name'),
                "age": subject.get('age'),
                "gender": subject.get('gender'),
                "avatar_url": subject.get('avatar_url'),
                "notes": subject.get('notes'),
                "prefecture": subject.get('prefecture'),
                "city": subject.get('city'),
                "cognitive_type": subject.get('cognitive_type'),
                "created_at": subject.get('created_at'),
                "updated_at": subject.get('updated_at')
            })

        # Calculate analytics
        total_count = len(subjects)
        male_count = sum(1 for s in subjects if s.get('gender') == 'male')
        female_count = sum(1 for s in subjects if s.get('gender') == 'female')
        other_count = sum(1 for s in subjects if s.get('gender') == 'other')
        unknown_count = total_count - male_count - female_count - other_count

        age_groups = {
            "0-3": 0,
            "4-6": 0,
            "7-9": 0,
            "10+": 0,
            "unknown": 0
        }

        for subject in subjects:
            age = subject.get('age')
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
                    "other": other_count,
                    "unknown": unknown_count
                },
                "age_groups": age_groups
            }
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch subjects: {str(e)}")

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
        # Get subject details
        result = supabase.table('business_subjects')\
            .select('*')\
            .eq('id', subject_id)\
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
                id=subject.get('id'),
                facility_id=subject.get('facility_id'),
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
        raise HTTPException(status_code=500, detail=f"Failed to fetch subject: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8052))
    uvicorn.run(app, host="0.0.0.0", port=port)