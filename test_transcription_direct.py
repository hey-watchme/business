#!/usr/bin/env python3
"""
Direct transcription test using Speechmatics API
Usage: python3 test_transcription_direct.py <audio_file_path>
"""
import os
import sys
import asyncio
import json
from datetime import datetime

async def transcribe_audio(audio_path: str):
    """Transcribe audio using Speechmatics API"""
    from speechmatics.batch import AsyncClient, TranscriptionConfig

    api_key = os.getenv("SPEECHMATICS_API_KEY")
    if not api_key:
        print("Error: SPEECHMATICS_API_KEY environment variable not set")
        sys.exit(1)

    print(f"Starting transcription: {audio_path}")
    print(f"File size: {os.path.getsize(audio_path) / (1024*1024):.2f} MB")
    print("")

    start_time = datetime.now()

    with open(audio_path, 'rb') as audio_file:
        client = AsyncClient(api_key=api_key)

        config = TranscriptionConfig(
            language="ja",
            diarization="speaker",
            enable_entities=True,
            speaker_diarization_config={
                "speaker_sensitivity": 0.5,
                "prefer_current_speaker": False
            }
        )

        print("Submitting job to Speechmatics...")
        job = await client.submit_job(audio_file, transcription_config=config)
        print(f"Job ID: {job.id}")
        print("Waiting for completion...")

        result = await client.wait_for_completion(job.id)
        await client.close()

    end_time = datetime.now()
    processing_time = (end_time - start_time).total_seconds()

    print(f"\nCompleted in {processing_time:.2f} seconds")
    print("")

    # Extract transcript
    transcript = result.transcript_text if hasattr(result, 'transcript_text') else ""

    # Count speakers
    speaker_set = set()
    if hasattr(result, 'results'):
        for item in result.results:
            if hasattr(item, 'alternatives') and item.alternatives:
                alt = item.alternatives[0]
                if hasattr(alt, 'speaker') and alt.speaker:
                    speaker_set.add(alt.speaker)

    # Prepare output
    output = {
        "audio_file": os.path.basename(audio_path),
        "processing_time_seconds": round(processing_time, 2),
        "speaker_count": len(speaker_set),
        "word_count": len(transcript),
        "transcript": transcript,
        "model": "speechmatics-batch",
        "timestamp": end_time.isoformat()
    }

    return output

async def main():
    if len(sys.argv) < 2:
        print("Usage: python3 test_transcription_direct.py <audio_file_path>")
        sys.exit(1)

    audio_path = sys.argv[1]

    if not os.path.exists(audio_path):
        print(f"Error: File not found: {audio_path}")
        sys.exit(1)

    result = await transcribe_audio(audio_path)

    # Save to file
    output_file = f"/tmp/transcription_result_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print("=" * 80)
    print("TRANSCRIPTION RESULT")
    print("=" * 80)
    print(f"\nSpeaker Count: {result['speaker_count']}")
    print(f"Word Count: {result['word_count']}")
    print(f"Processing Time: {result['processing_time_seconds']} seconds")
    print(f"\nTranscript:\n{result['transcript']}")
    print("")
    print(f"Full result saved to: {output_file}")

if __name__ == "__main__":
    asyncio.run(main())
