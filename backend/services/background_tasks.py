import os
import json
import io
import time
import asyncio
from datetime import datetime
import boto3
from supabase import Client


def transcribe_background(
    session_id: str,
    s3_audio_path: str,
    s3_client: boto3.client,
    s3_bucket: str,
    supabase: Client,
    asr_service,
    sqs_queue_url: str
):
    """
    Background task for audio transcription

    Args:
        session_id: Session ID
        s3_audio_path: S3 path to audio file
        s3_client: boto3 S3 client
        s3_bucket: S3 bucket name
        supabase: Supabase client
        asr_service: ASR service instance
        sqs_queue_url: SQS queue URL for completion notification
    """
    try:
        print(f"[Background] Starting transcription for session: {session_id}")
        start_time = time.time()

        # Update status to 'transcribing'
        supabase.table('business_interview_sessions').update({
            'status': 'transcribing',
            'updated_at': datetime.now().isoformat()
        }).eq('id', session_id).execute()

        # Download audio from S3
        s3_response = s3_client.get_object(Bucket=s3_bucket, Key=s3_audio_path)
        audio_content = s3_response['Body'].read()
        audio_file = io.BytesIO(audio_content)

        # Transcribe with ASR provider (async function)
        transcription_result = asyncio.run(
            asr_service.transcribe_audio(
                audio_file=audio_file,
                filename=s3_audio_path
            )
        )

        # Calculate audio duration from transcription result
        duration_seconds = 0
        utterances = transcription_result.get('utterances', [])
        if utterances and len(utterances) > 0:
            # Get the end time of the last utterance
            last_utterance = utterances[-1]
            duration_seconds = int(last_utterance.get('end', 0))

        # Update DB with transcription
        supabase.table('business_interview_sessions').update({
            'transcription': transcription_result['transcription'],
            'transcription_metadata': {
                'utterances': transcription_result.get('utterances', []),
                'paragraphs': transcription_result.get('paragraphs', []),
                'speaker_count': transcription_result.get('speaker_count', 0),
                'confidence': transcription_result.get('confidence', 0.0),
                'word_count': transcription_result.get('word_count', 0),
                'model': transcription_result.get('model', 'unknown'),
                'processing_time': transcription_result.get('processing_time', 0.0),
            },
            'duration_seconds': duration_seconds,
            'status': 'transcribed',
            'updated_at': datetime.now().isoformat()
        }).eq('id', session_id).execute()

        processing_time = time.time() - start_time
        print(f"[Background] Transcription completed in {processing_time:.2f}s for session: {session_id}")

        # Send SQS message for next step (analysis)
        sqs_client = boto3.client('sqs', region_name=os.getenv('AWS_REGION', 'ap-southeast-2'))
        sqs_client.send_message(
            QueueUrl=sqs_queue_url,
            MessageBody=json.dumps({'session_id': session_id}),
            MessageGroupId=session_id,
            MessageDeduplicationId=f"{session_id}-{int(time.time())}"
        )
        print(f"[Background] SQS message sent for session: {session_id}")

    except Exception as e:
        print(f"[Background] ERROR in transcription: {str(e)}")
        # Update DB with error
        if supabase:
            supabase.table('business_interview_sessions').update({
                'status': 'failed',
                'error_message': f"Transcription failed: {str(e)}",
                'updated_at': datetime.now().isoformat()
            }).eq('id', session_id).execute()


def analyze_background(
    session_id: str,
    supabase: Client,
    llm_service,
    sqs_queue_url: str = None
):
    """
    Background task for interview analysis

    Args:
        session_id: Session ID
        supabase: Supabase client
        llm_service: LLM service instance
        sqs_queue_url: SQS queue URL for completion notification (optional)
    """
    try:
        print(f"[Background] Starting analysis for session: {session_id}")
        start_time = time.time()

        # Get session from DB
        result = supabase.table('business_interview_sessions')\
            .select('*')\
            .eq('id', session_id)\
            .single()\
            .execute()

        if not result.data:
            raise Exception(f"Session not found: {session_id}")

        session = result.data
        transcription = session.get('transcription')

        if not transcription:
            raise Exception("Transcription not found")

        # Update status to 'analyzing'
        supabase.table('business_interview_sessions').update({
            'status': 'analyzing',
            'updated_at': datetime.now().isoformat()
        }).eq('id', session_id).execute()

        # Generate prompt
        prompt = f"""以下の保護者ヒアリング内容を要約してください。

ヒアリング内容:
{transcription}

以下の項目について、日本語で回答してください:
1. 概要（2-3文）
2. 主なポイント
3. お子さまの現在の状況
"""

        # Call LLM
        llm_response = llm_service.generate(prompt)

        # Update DB with result
        supabase.table('business_interview_sessions').update({
            'analysis_prompt': prompt,
            'analysis_result': {'summary': llm_response},
            'status': 'completed',
            'updated_at': datetime.now().isoformat()
        }).eq('id', session_id).execute()

        processing_time = time.time() - start_time
        print(f"[Background] Analysis completed in {processing_time:.2f}s for session: {session_id}")

        # Send SQS message for next step (optional)
        if sqs_queue_url:
            sqs_client = boto3.client('sqs', region_name=os.getenv('AWS_REGION', 'ap-southeast-2'))
            sqs_client.send_message(
                QueueUrl=sqs_queue_url,
                MessageBody=json.dumps({'session_id': session_id}),
                MessageGroupId=session_id,
                MessageDeduplicationId=f"{session_id}-{int(time.time())}"
            )
            print(f"[Background] SQS message sent for session: {session_id}")

    except Exception as e:
        print(f"[Background] ERROR in analysis: {str(e)}")
        # Update DB with error
        if supabase:
            supabase.table('business_interview_sessions').update({
                'status': 'failed',
                'error_message': f"Analysis failed: {str(e)}",
                'updated_at': datetime.now().isoformat()
            }).eq('id', session_id).execute()
