import os
import json
import io
import time
import asyncio
from datetime import datetime
import boto3
from supabase import Client
from services.prompts import build_fact_extraction_prompt, build_fact_structuring_prompt, build_assessment_prompt
from services.llm_pipeline import execute_llm_phase


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
    sqs_queue_url: str = None,
    use_custom_prompt: bool = False
):
    """
    Background task for interview analysis

    Args:
        session_id: Session ID
        supabase: Supabase client
        llm_service: LLM service instance
        sqs_queue_url: SQS queue URL for completion notification (optional)
        use_custom_prompt: If True, use the prompt already stored in DB
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

        # Initialize variables with default values
        subject = None
        attendees = session.get('attendees') or {}  # Handle None from DB
        age_text = "不明"

        # Get subject info directly from session's subject_id
        subject_id = session.get('subject_id')
        if subject_id:
            try:
                subject_result = supabase.table('subjects')\
                    .select('*')\
                    .eq('subject_id', subject_id)\
                    .execute()

                if subject_result and subject_result.data and len(subject_result.data) > 0:
                    subject = subject_result.data[0]

                    # Calculate age from birth_date if available
                    if subject.get('birth_date'):
                        try:
                            birth_date = datetime.fromisoformat(subject['birth_date'].replace('Z', '+00:00'))
                            age = (datetime.now() - birth_date).days // 365
                            age_text = f"{age}歳"
                        except (ValueError, TypeError, KeyError) as e:
                            print(f"[Warning] Failed to calculate age: {e}")
                            age_text = "不明"
            except Exception as e:
                print(f"[Warning] Failed to fetch subject: {e}")
        # Get staff info
        staff_name = "山田太郎"  # Default fallback
        staff_id = session.get('staff_id')
        if staff_id:
            try:
                staff_result = supabase.table('users')\
                    .select('name')\
                    .eq('user_id', staff_id)\
                    .execute()
                if staff_result and staff_result.data and len(staff_result.data) > 0:
                    staff_name = f"{staff_result.data[0].get('name', 'スタッフ')}（児童発達支援管理責任者）"
            except Exception as e:
                print(f"[Warning] Failed to fetch staff: {e}")

        # Generate extraction_v1 prompt using prompts.py (or use stored prompt)
        if use_custom_prompt:
            prompt = session.get('fact_extraction_prompt_v1')
            if not prompt:
                raise Exception("No stored prompt found for Phase 1")
            print(f"[Background] Using stored custom prompt for Phase 1")
        else:
            prompt = build_fact_extraction_prompt(
                transcription=transcription,
                subject=subject,
                age_text=age_text,
                attendees=attendees,
                staff_name=staff_name,
                recorded_at=session.get('recorded_at', '不明')
            )

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
        update_data = {
            'fact_extraction_prompt_v1': prompt,
            'fact_extraction_result_v1': analysis_data,
            'status': 'completed',
            'updated_at': datetime.now().isoformat()
        }
        # Record which model was used
        if hasattr(llm_service, 'model_name'):
            update_data['model_used_phase1'] = llm_service.model_name
        supabase.table('business_interview_sessions').update(update_data).eq('id', session_id).execute()

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
        import traceback
        error_details = traceback.format_exc()
        print(f"[Background] ERROR in analysis: {str(e)}")
        print(f"[Background] Traceback:\n{error_details}")
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
    llm_service,
    use_custom_prompt: bool = False
):
    """
    Phase 2: Fact Structuring (Background Task)

    Converts extraction_v1 into fact_clusters_v1
    - NO interpretation or inference
    - Only reorganize facts into neutral domain clusters

    Args:
        session_id: Session ID
        supabase: Supabase client
        llm_service: LLM service instance
        use_custom_prompt: If True, use the prompt already stored in DB
    """
    # Use unified LLM pipeline
    execute_llm_phase(
        session_id=session_id,
        supabase=supabase,
        llm_service=llm_service,
        phase_name="fact_structuring",
        prompt_builder=build_fact_structuring_prompt,
        input_selector="fact_extraction_result_v1",
        output_column="fact_structuring_result_v1",
        prompt_column="fact_structuring_prompt_v1",
        model_used_column="model_used_phase2",
        use_stored_prompt=use_custom_prompt
    )


def assess_background(
    session_id: str,
    supabase: Client,
    llm_service,
    use_custom_prompt: bool = False
):
    """
    Phase 3: Assessment (Background Task)

    Generates individual support plan based on fact_clusters_v1
    - Professional judgment and interpretation
    - Support policy, goals, and support items

    After Phase 3 completion, automatically syncs assessment_v1 to
    business_support_plans xxx_ai_generated columns.

    Args:
        session_id: Session ID
        supabase: Supabase client
        llm_service: LLM service instance
        use_custom_prompt: If True, use the prompt already stored in DB
    """
    # Use unified LLM pipeline - Phase 3 uses Phase 2 annotated output
    execute_llm_phase(
        session_id=session_id,
        supabase=supabase,
        llm_service=llm_service,
        phase_name="assessment",
        prompt_builder=build_assessment_prompt,
        input_selector="fact_structuring_result_v1",
        output_column="assessment_result_v1",
        prompt_column="assessment_prompt_v1",
        model_used_column="model_used_phase3",
        use_stored_prompt=use_custom_prompt
    )

    # Auto-sync assessment_v1 to business_support_plans after Phase 3 completion
    sync_assessment_to_support_plan(session_id, supabase)


def sync_assessment_to_support_plan(session_id: str, supabase: Client):
    """
    Sync assessment_v1 data to business_support_plans xxx_ai_generated columns

    This function transfers AI-generated data from the session's assessment_result_v1
    to the support plan's xxx_ai_generated columns for Human-in-the-Loop editing.

    Args:
        session_id: Session ID
        supabase: Supabase client
    """
    try:
        print(f"[Background] Starting auto-sync for session: {session_id}")

        # 1. Get session with support_plan_id and assessment_result_v1
        session_result = supabase.table('business_interview_sessions')\
            .select('support_plan_id, assessment_result_v1')\
            .eq('id', session_id)\
            .single()\
            .execute()

        if not session_result.data:
            print(f"[Background] Session not found for sync: {session_id}")
            return

        support_plan_id = session_result.data.get('support_plan_id')
        assessment_result = session_result.data.get('assessment_result_v1')

        if not support_plan_id:
            print(f"[Background] No support_plan_id linked to session: {session_id}")
            return

        if not assessment_result:
            print(f"[Background] No assessment_result_v1 in session: {session_id}")
            return

        # 2. Extract assessment_v1 from various formats
        assessment_v1 = extract_assessment_v1_data(assessment_result)

        if not assessment_v1:
            print(f"[Background] Failed to extract assessment_v1 from session: {session_id}")
            return

        # 3. Build update data according to mapping
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
            print(f"[Background] No data to sync from assessment_v1 for session: {session_id}")
            return

        # 4. Update business_support_plans
        update_data['updated_at'] = datetime.now().isoformat()
        supabase.table('business_support_plans')\
            .update(update_data)\
            .eq('id', support_plan_id)\
            .execute()

        print(f"[Background] Auto-sync completed for session {session_id}: {len(synced_fields)} fields synced ({', '.join(synced_fields)})")

    except Exception as e:
        # Log error but don't fail the entire assessment
        print(f"[Background] WARNING: Auto-sync failed for session {session_id}: {str(e)}")


def extract_assessment_v1_data(assessment_result: dict) -> dict:
    """
    Extract assessment_v1 from various data formats

    Handles:
    - Direct: {"assessment_v1": {...}}
    - Wrapped: {"summary": "```json\n{...}\n```"}

    Args:
        assessment_result: Raw assessment result from DB

    Returns:
        Extracted assessment_v1 dict or empty dict
    """
    import re

    if not assessment_result:
        return {}

    # Case 1: Direct structure
    if 'assessment_v1' in assessment_result:
        return assessment_result['assessment_v1']

    # Case 2: Wrapped in summary
    if 'summary' in assessment_result:
        summary_text = assessment_result['summary']
        # Extract JSON from markdown code block
        json_match = re.search(r'```json\s*\n([\s\S]*?)\n```', summary_text)
        if json_match:
            try:
                parsed = json.loads(json_match.group(1))
                return parsed.get('assessment_v1', {})
            except json.JSONDecodeError:
                pass

    return {}
