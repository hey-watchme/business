import os
import time
from typing import BinaryIO, Dict, Any
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
import logging

logger = logging.getLogger(__name__)

class SpeechmaticsASRService:
    """Speechmatics ASR Service using new speechmatics-batch SDK"""

    def __init__(self):
        api_key = os.getenv("SPEECHMATICS_API_KEY")
        if not api_key:
            raise ValueError("SPEECHMATICS_API_KEY environment variable not set")
        self.api_key = api_key
        logger.info("Speechmatics API initialized")

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type(Exception)
    )
    async def transcribe_audio(
        self,
        audio_file: BinaryIO,
        filename: str
    ) -> Dict[str, Any]:
        """Transcribe audio file using Speechmatics Batch API"""
        try:
            from speechmatics.batch import AsyncClient, TranscriptionConfig, FormatType

            start_time = time.time()
            audio_file.seek(0)

            # Create client
            client = AsyncClient(api_key=self.api_key)

            # Configure with diarization (following official example)
            config = TranscriptionConfig(
                language="ja",
                diarization="speaker",
                enable_entities=True,
                speaker_diarization_config={
                    "speaker_sensitivity": 0.5,
                    "prefer_current_speaker": False
                }
            )

            # Submit and wait
            job = await client.submit_job(audio_file, transcription_config=config)
            result = await client.wait_for_completion(job.id, format_type=FormatType.JSON_V2)
            await client.close()

            processing_time = time.time() - start_time

            # Parse results
            if not result or not isinstance(result, dict) or 'results' not in result:
                return {
                    "transcription": "",
                    "processing_time": round(processing_time, 2),
                    "confidence": 0.0,
                    "word_count": 0,
                    "utterances": [],
                    "paragraphs": [],
                    "speaker_count": 0,
                    "no_speech_detected": True,
                    "model": "speechmatics-batch",
                    "provider": "speechmatics",
                }

            # Build transcript and utterances
            full_transcript = ""
            utterances = []
            speaker_set = set()
            current_speaker = None
            current_utterance = {"words": [], "start": 0, "end": 0, "speaker": None, "confidence": []}

            for item in result['results']:
                if item['type'] != 'word':
                    continue

                alt = item['alternatives'][0]
                content = alt['content']
                speaker = alt.get('speaker', 'UU')
                confidence = alt.get('confidence', 0.0)
                start = item['start_time']
                end = item['end_time']

                full_transcript += content
                if speaker != 'UU':
                    speaker_set.add(speaker)

                # Group by speaker
                if current_speaker != speaker:
                    if current_utterance['words']:
                        utterances.append({
                            "start": round(current_utterance['start'], 2),
                            "end": round(current_utterance['end'], 2),
                            "transcript": "".join([w['content'] for w in current_utterance['words']]),
                            "speaker": current_utterance['speaker'],
                            "confidence": round(sum(current_utterance['confidence']) / len(current_utterance['confidence']), 2)
                        })
                    current_speaker = speaker
                    current_utterance = {"words": [], "start": start, "end": end, "speaker": speaker, "confidence": []}

                current_utterance['words'].append({"content": content})
                current_utterance['end'] = end
                current_utterance['confidence'].append(confidence)

            # Add last utterance
            if current_utterance['words']:
                utterances.append({
                    "start": round(current_utterance['start'], 2),
                    "end": round(current_utterance['end'], 2),
                    "transcript": "".join([w['content'] for w in current_utterance['words']]),
                    "speaker": current_utterance['speaker'],
                    "confidence": round(sum(current_utterance['confidence']) / len(current_utterance['confidence']), 2)
                })

            return {
                "transcription": full_transcript,
                "processing_time": round(processing_time, 2),
                "confidence": 0.95,
                "word_count": len(full_transcript),
                "utterances": utterances,
                "paragraphs": [],
                "speaker_count": len(speaker_set),
                "no_speech_detected": False,
                "model": "speechmatics-batch",
                "provider": "speechmatics",
            }

        except Exception as e:
            logger.error(f"Speechmatics API error: {str(e)}")
            raise
