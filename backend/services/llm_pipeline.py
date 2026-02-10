"""
LLM Pipeline - Common processing for Phase 1-3

Unified pattern for all analysis phases:
1. Load data from DB
2. Generate prompt
3. Call LLM
4. Parse response
5. Save result to DB
"""

import json
import time
from datetime import datetime
from typing import Callable, Dict, Any, Optional
from supabase import Client


def execute_llm_phase(
    session_id: str,
    supabase: Client,
    llm_service,
    phase_name: str,
    prompt_builder: Callable,
    input_selector: str,
    output_column: str,
    prompt_column: str,
    model_used_column: Optional[str] = None,
    additional_data: Optional[Dict[str, Any]] = None,
    use_stored_prompt: bool = False
) -> None:
    """
    Execute a single LLM analysis phase (Phase 1, 2, or 3)

    Unified processing pattern:
    1. DB.select() - Load previous phase result
    2. Build prompt (or use stored prompt if use_stored_prompt=True)
    3. Save prompt to DB
    4. Call LLM
    5. Parse JSON (flexible)
    6. Save result to DB

    Args:
        session_id: Session ID
        supabase: Supabase client
        llm_service: LLM service instance
        phase_name: Phase name for logging (e.g., "fact_extraction", "fact_structuring")
        prompt_builder: Function to build prompt (takes input_data, returns prompt string)
        input_selector: SQL select clause for input data (e.g., "transcription, support_plan:support_plan_id(*)")
        output_column: DB column for result (e.g., "fact_extraction_result_v1")
        prompt_column: DB column for prompt (e.g., "fact_extraction_prompt_v1")
        model_used_column: DB column to record model used (e.g., "model_used_phase2")
        additional_data: Additional data to pass to prompt_builder (optional)
        use_stored_prompt: If True, use the prompt already stored in DB instead of rebuilding

    Raises:
        Exception: If any step fails
    """
    start_time = time.time()
    print(f"[Background] Starting {phase_name} for session: {session_id}")

    try:
        # 1. Load data from DB
        result = supabase.table('business_interview_sessions')\
            .select(input_selector)\
            .eq('id', session_id)\
            .single()\
            .execute()

        if not result.data:
            raise ValueError(f"Session not found: {session_id}")

        # 1.5. Clear old error_message (if exists) before starting new phase
        supabase.table('business_interview_sessions').update({
            'error_message': None
        }).eq('id', session_id).execute()

        # 2. Build prompt (or use stored prompt)
        if use_stored_prompt:
            # Use the prompt already saved in DB (edited by user)
            prompt_result = supabase.table('business_interview_sessions')\
                .select(prompt_column)\
                .eq('id', session_id)\
                .single()\
                .execute()
            prompt = prompt_result.data.get(prompt_column) if prompt_result.data else None
            if not prompt:
                raise ValueError(f"No stored prompt found in {prompt_column}")
            print(f"[Background] Using stored prompt for {phase_name}")
        else:
            if additional_data:
                prompt = prompt_builder(result.data, **additional_data)
            else:
                prompt = prompt_builder(result.data)

            # 3. Save prompt to DB
            supabase.table('business_interview_sessions').update({
                prompt_column: prompt
            }).eq('id', session_id).execute()

        # 4. Call LLM
        print(f"[Background] Calling LLM for {phase_name}...")
        try:
            llm_output = llm_service.generate(prompt)
            if not llm_output:
                raise ValueError("LLM returned empty response")
        except Exception as e:
            raise ValueError(f"LLM generation failed: {str(e)}")

        # 5. Parse JSON response (flexible handling)
        try:
            if llm_output.strip().startswith('{'):
                result_data = json.loads(llm_output)
            else:
                # If not JSON, wrap in summary structure
                result_data = {'summary': llm_output}
        except json.JSONDecodeError:
            # Fallback: treat as plain text
            result_data = {'summary': llm_output}

        # 6. Save result to DB
        update_data = {
            output_column: result_data,
            'updated_at': datetime.now().isoformat()
        }
        # Record which model was used (if column specified)
        if model_used_column and hasattr(llm_service, 'model_name'):
            update_data[model_used_column] = llm_service.model_name
        supabase.table('business_interview_sessions').update(update_data).eq('id', session_id).execute()

        processing_time = time.time() - start_time
        print(f"[Background] {phase_name} completed in {processing_time:.2f}s for session: {session_id}")

    except Exception as e:
        print(f"[Background] ERROR in {phase_name}: {str(e)}")
        # Update DB with error
        if supabase:
            supabase.table('business_interview_sessions').update({
                'error_message': f"{phase_name} failed: {str(e)}",
                'updated_at': datetime.now().isoformat()
            }).eq('id', session_id).execute()
        raise


def validate_previous_phase_result(
    result_data: Dict[str, Any],
    expected_key: str
) -> bool:
    """
    Validate that previous phase result exists and has expected structure

    Handles different data structures:
    - Direct: {"extraction_v1": {...}}
    - Wrapped: {"summary": "```json\n{...}\n```"}

    Args:
        result_data: Data from previous phase
        expected_key: Expected key in result (e.g., "extraction_v1")

    Returns:
        True if valid, False otherwise
    """
    if not result_data:
        return False

    # Case 1: Direct structure
    if isinstance(result_data, dict) and expected_key in result_data:
        return True

    # Case 2: Wrapped in summary
    if isinstance(result_data, dict) and 'summary' in result_data:
        summary_text = result_data.get('summary', '')
        if '```json' in summary_text and expected_key in summary_text:
            return True

    return False


def extract_from_wrapped_result(
    result_data: Dict[str, Any],
    expected_key: str
) -> Optional[Dict[str, Any]]:
    """
    Extract data from wrapped result (used in background tasks)

    Args:
        result_data: Data from previous phase
        expected_key: Expected key in result (e.g., "extraction_v1")

    Returns:
        Extracted data or None if not found
    """
    # Case 1: Direct structure
    if isinstance(result_data, dict) and expected_key in result_data:
        return result_data[expected_key]

    # Case 2: Wrapped in summary
    if isinstance(result_data, dict) and 'summary' in result_data:
        summary_text = result_data['summary']
        if '```json' in summary_text:
            json_start = summary_text.find('{')
            json_end = summary_text.rfind('}') + 1
            if json_start >= 0 and json_end > json_start:
                json_str = summary_text[json_start:json_end]
                parsed = json.loads(json_str)
                return parsed.get(expected_key)

    return None
