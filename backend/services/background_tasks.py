import os
import json
import io
import time
import asyncio
from datetime import datetime
import boto3
from supabase import Client
from services.prompts import build_fact_structuring_prompt


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

        # Get session and related data from DB (single query with joins)
        result = supabase.table('business_interview_sessions')\
            .select('*, support_plan:support_plan_id(*, subject:subject_id(*))')\
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

        # Initialize variables with default values
        subject = None
        attendees = session.get('attendees', {})
        age_text = "不明"

        # Extract subject info if available
        if session.get('support_plan') and session['support_plan'].get('subject'):
            subject = session['support_plan']['subject']

            # Calculate age from birth_date if available
            if subject.get('birth_date'):
                try:
                    birth_date = datetime.fromisoformat(subject['birth_date'].replace('Z', '+00:00'))
                    age = (datetime.now() - birth_date).days // 365
                    age_text = f"{age}歳"
                except (ValueError, TypeError, KeyError) as e:
                    print(f"[Warning] Failed to calculate age: {e}")
                    age_text = "不明"

        # Generate extraction_v1 prompt with pre-filled information
        prompt = f"""あなたは児童発達支援のヒアリング記録を整理するアシスタントです。

【事前情報】
■ 支援対象児
- 氏名: {subject.get('name', '不明') if subject else '不明'}
- 年齢: {age_text}
- 性別: {subject.get('gender', '不明') if subject else '不明'}
- 診断: {', '.join(subject.get('diagnosis', [])) if subject and subject.get('diagnosis') else '不明'}
- 通園先: {subject.get('school_name', '不明') if subject and subject.get('school_name') else '不明'}

■ 参加者
- 保護者: {("父" if attendees.get('father') else "") + ("・母" if attendees.get('mother') else "") or "不明"}

■ インタビュアー
- 氏名: 山田太郎（児発管）

■ 実施情報
- 日時: {session.get('recorded_at', '不明')}

【重要なルール】
- 判断・評価・目標設定・支援計画の作成は絶対にしないでください
- 事実・発言・観察内容のみを抽出してください
- 原文の引用は不要です（要約のみ）
- 推測や補完は禁止です
- 曖昧な場合は confidence を "low" にしてください

【出力形式】
以下のJSON形式で出力してください。
原文引用（source）は含めないでください。

{{
  "extraction_v1": {{
    "basic_info": [
      {{
        "field": "項目名",
        "value": "値",
        "confidence": "high/medium/low"
      }}
    ],
    "current_state": [
      {{
        "summary": "現在の状況の要約",
        "confidence": "high/medium/low"
      }}
    ],
    "strengths": [
      {{
        "summary": "強みの要約",
        "confidence": "high/medium/low"
      }}
    ],
    "challenges": [
      {{
        "summary": "課題の要約",
        "confidence": "high/medium/low"
      }}
    ],
    "physical_sensory": [
      {{
        "summary": "身体・感覚の要約",
        "confidence": "high/medium/low"
      }}
    ],
    "medical_development": [
      {{
        "summary": "医療・発達の要約",
        "confidence": "high/medium/low"
      }}
    ],
    "family_environment": [
      {{
        "summary": "家族・環境の要約",
        "confidence": "high/medium/low"
      }}
    ],
    "parent_intentions": [
      {{
        "summary": "保護者の希望",
        "priority": 1,
        "confidence": "high/medium/low"
      }}
    ],
    "staff_notes": [
      {{
        "summary": "スタッフの観察・メモ",
        "confidence": "high/medium/low"
      }}
    ],
    "administrative_notes": [
      {{
        "summary": "事務的な内容",
        "confidence": "high/medium/low"
      }}
    ],
    "unresolved_items": [
      {{
        "summary": "未解決・保留事項",
        "reason": "理由"
      }}
    ]
  }}
}}

【ヒアリングのトランスクリプション】
{transcription}
"""

        # Call LLM with error handling
        try:
            llm_response = llm_service.generate(prompt)
            if not llm_response:
                raise Exception("LLM returned empty response")
        except Exception as e:
            raise Exception(f"LLM generation failed: {str(e)}")

        # Parse LLM response (handle both JSON string and plain text)
        try:
            if llm_response.strip().startswith('{'):
                analysis_data = json.loads(llm_response)
            else:
                # If not JSON, wrap in summary structure
                analysis_data = {'summary': llm_response}
        except json.JSONDecodeError:
            # Fallback: treat as plain text
            analysis_data = {'summary': llm_response}

        # Update DB with result
        supabase.table('business_interview_sessions').update({
            'fact_extraction_prompt_v1': prompt,
            'fact_extraction_result_v1': analysis_data,
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


def structure_facts_background(
    session_id: str,
    supabase: Client,
    openai_client
):
    """
    Phase 2: Fact Structuring (Background Task)

    Converts extraction_v1 into fact_clusters_v1
    - NO interpretation or inference
    - Only reorganize facts into neutral domain clusters

    Args:
        session_id: Session ID
        supabase: Supabase client
        openai_client: OpenAI client
    """
    start_time = time.time()
    print(f"[Background] Starting fact structuring for session: {session_id}")

    try:
        # 1. Get extraction_v1 from DB
        response = supabase.table('business_interview_sessions') \
            .select('fact_extraction_result_v1') \
            .eq('id', session_id) \
            .single() \
            .execute()

        if not response.data:
            raise ValueError(f"Session not found: {session_id}")

        fact_extraction_data = response.data.get('fact_extraction_result_v1')

        if not fact_extraction_data:
            raise ValueError(f"fact_extraction_result_v1 not found for session: {session_id}")

        # Handle different data structures
        extraction_v1 = None

        # Case 1: Direct structure {"extraction_v1": {...}}
        if isinstance(fact_extraction_data, dict) and 'extraction_v1' in fact_extraction_data:
            extraction_v1 = fact_extraction_data['extraction_v1']

        # Case 2: Wrapped in summary {"summary": "```json\n{...}\n```"}
        elif isinstance(fact_extraction_data, dict) and 'summary' in fact_extraction_data:
            summary_text = fact_extraction_data['summary']
            # Extract JSON from markdown code block
            if '```json' in summary_text:
                json_start = summary_text.find('{')
                json_end = summary_text.rfind('}') + 1
                if json_start >= 0 and json_end > json_start:
                    json_str = summary_text[json_start:json_end]
                    parsed = json.loads(json_str)
                    extraction_v1 = parsed.get('extraction_v1')

        if not extraction_v1:
            raise ValueError(f"Could not extract extraction_v1 from fact_extraction_result_v1 for session: {session_id}")

        # 2. Build prompt
        prompt = build_fact_structuring_prompt(extraction_v1)

        # 3. Save prompt to DB
        supabase.table('business_interview_sessions').update({
            'fact_structuring_prompt_v1': prompt
        }).eq('id', session_id).execute()

        # 4. Call OpenAI API
        print(f"[Background] Calling OpenAI API for fact structuring...")
        llm_response = openai_client.chat.completions.create(
            model='gpt-4o',
            messages=[
                {'role': 'system', 'content': 'You are a fact organization assistant for child development support.'},
                {'role': 'user', 'content': prompt}
            ],
            temperature=0.3,
            response_format={'type': 'json_object'}
        )

        llm_output = llm_response.choices[0].message.content

        if not llm_output or llm_output.strip() == '':
            raise ValueError("OpenAI returned empty response")

        # 5. Parse JSON response
        try:
            fact_clusters_data = json.loads(llm_output)
        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse LLM JSON response: {str(e)}")

        # 6. Save result to DB
        supabase.table('business_interview_sessions').update({
            'fact_structuring_result_v1': fact_clusters_data,
            'updated_at': datetime.now().isoformat()
        }).eq('id', session_id).execute()

        processing_time = time.time() - start_time
        print(f"[Background] Fact structuring completed in {processing_time:.2f}s for session: {session_id}")

    except Exception as e:
        print(f"[Background] ERROR in fact structuring: {str(e)}")
        # Update DB with error
        if supabase:
            supabase.table('business_interview_sessions').update({
                'error_message': f"Fact structuring failed: {str(e)}",
                'updated_at': datetime.now().isoformat()
            }).eq('id', session_id).execute()
