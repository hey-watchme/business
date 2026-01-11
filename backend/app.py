import os
import uuid
import io
from datetime import datetime
from typing import Optional

import boto3
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client

from services.asr_provider import DeepgramASRService
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
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
API_TOKEN = os.getenv("API_TOKEN", "watchme-b2b-poc-2025")

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
    child_id: str = Form(...),
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
            supabase.table('business_interview_sessions').insert({
                'id': session_id,
                'facility_id': facility_id,
                'child_id': child_id,
                's3_audio_path': s3_path,
                'status': 'completed',  # Changed from 'uploaded' to 'completed'
                'duration_seconds': 0,  # To be calculated later
                'recorded_at': datetime.now().isoformat()
            }).execute()

        return UploadResponse(
            success=True,
            session_id=session_id,
            s3_path=s3_path,
            message="Audio uploaded successfully"
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@app.post("/api/transcribe", response_model=TranscribeResponse)
async def transcribe_audio(
    request: TranscribeRequest,
    x_api_token: str = Header(None, alias="X-API-Token")
):
    # Validate token
    if x_api_token != API_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid API token")

    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")

    try:
        # 1. Get session from DB
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

        # 2. Download audio from S3
        s3_response = s3_client.get_object(Bucket=S3_BUCKET, Key=s3_audio_path)
        audio_content = s3_response['Body'].read()
        audio_file = io.BytesIO(audio_content)

        # 3. Transcribe with Deepgram
        asr_service = DeepgramASRService()
        transcription_result = await asr_service.transcribe_audio(
            audio_file=audio_file,
            filename=s3_audio_path
        )

        # 4. Update DB with transcription
        supabase.table('business_interview_sessions').update({
            'transcription': transcription_result['transcription'],
            'status': 'completed',
            'updated_at': datetime.now().isoformat()
        }).eq('id', request.session_id).execute()

        return TranscribeResponse(
            success=True,
            session_id=request.session_id,
            transcription=transcription_result['transcription'],
            processing_time=transcription_result['processing_time'],
            confidence=transcription_result['confidence'],
            word_count=transcription_result['word_count'],
            message="Transcription completed successfully"
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")

@app.post("/api/analyze", response_model=AnalyzeResponse)
async def analyze_interview(
    request: AnalyzeRequest,
    x_api_token: str = Header(None, alias="X-API-Token")
):
    """
    Analyze interview transcription with LLM (POC: Synchronous)

    Flow:
    1. Get transcription from DB
    2. Generate prompt
    3. Call LLM (OpenAI GPT-4o)
    4. Save result to DB
    """
    # Validate token
    if x_api_token != API_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid API token")

    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")

    try:
        import time
        start_time = time.time()

        print(f"\nAnalyzing interview session: {request.session_id}")

        # 1. Get session from DB
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

        # 2. Generate prompt (POC: Simple summary)
        prompt = f"""Please summarize the following parent interview content.

Interview Content:
{transcription}

Please provide:
1. Brief summary (2-3 sentences)
2. Key points mentioned
3. Child's current situation
"""

        # 3. Update DB status to 'analyzing'
        supabase.table('business_interview_sessions').update({
            'analysis_prompt': prompt,
            'status': 'analyzing',
            'updated_at': datetime.now().isoformat()
        }).eq('id', request.session_id).execute()

        # 4. Call LLM
        llm = get_current_llm()
        print(f"Calling LLM: {llm.model_name}")

        llm_response = llm.generate(prompt)

        # 5. Update DB with result
        supabase.table('business_interview_sessions').update({
            'analysis_result': {'summary': llm_response},
            'status': 'completed',
            'updated_at': datetime.now().isoformat()
        }).eq('id', request.session_id).execute()

        processing_time = time.time() - start_time
        print(f"Analysis completed in {processing_time:.2f}s")

        return AnalyzeResponse(
            success=True,
            session_id=request.session_id,
            summary=llm_response,
            processing_time=processing_time,
            model=llm.model_name,
            message="Analysis completed successfully"
        )

    except HTTPException:
        raise
    except Exception as e:
        # Update DB with error
        if supabase:
            supabase.table('business_interview_sessions').update({
                'status': 'failed',
                'error_message': str(e),
                'updated_at': datetime.now().isoformat()
            }).eq('id', request.session_id).execute()

        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

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

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8052))
    uvicorn.run(app, host="0.0.0.0", port=port)