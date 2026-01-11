import os
import time
from typing import BinaryIO, Dict, Any
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
import logging

logger = logging.getLogger(__name__)

class DeepgramASRService:
    """Deepgram Nova-2 ASR Service for Business API"""

    def __init__(self, model: str = "nova-2"):
        from deepgram import DeepgramClient

        api_key = os.getenv("DEEPGRAM_API_KEY")
        if not api_key:
            raise ValueError("DEEPGRAM_API_KEY environment variable not set")

        self.client = DeepgramClient(api_key=api_key)
        self._model = model
        logger.info(f"Deepgram API initialized: model={model}")

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
        """Transcribe audio file using Deepgram API with retry"""
        try:
            start_time = time.time()

            # Reset file pointer and read audio data
            audio_file.seek(0)
            audio_data = audio_file.read()

            # Deepgram API options
            from deepgram import PrerecordedOptions

            options = PrerecordedOptions(
                model=self._model,
                language="ja",  # Japanese
                punctuate=True,  # Auto punctuation
                diarize=True,    # Speaker diarization
                smart_format=True,  # Smart formatting (dates, numbers)
                utterances=True,  # Utterance segmentation
            )

            # Call Deepgram API
            response = self.client.listen.rest.v("1").transcribe_file(
                source={"buffer": audio_data},
                options=options
            )

            processing_time = time.time() - start_time

            # Extract transcription text
            if not response or not response.results:
                return {
                    "transcription": "",
                    "processing_time": round(processing_time, 2),
                    "confidence": 0.0,
                    "word_count": 0,
                    "no_speech_detected": True
                }

            channels = response.results.channels
            if not channels or len(channels) == 0:
                return {
                    "transcription": "",
                    "processing_time": round(processing_time, 2),
                    "confidence": 0.0,
                    "word_count": 0,
                    "no_speech_detected": True
                }

            # Get transcript from first channel
            alternatives = channels[0].alternatives
            if not alternatives or len(alternatives) == 0:
                return {
                    "transcription": "",
                    "processing_time": round(processing_time, 2),
                    "confidence": 0.0,
                    "word_count": 0,
                    "no_speech_detected": True
                }

            transcript = alternatives[0].transcript
            confidence = alternatives[0].confidence
            word_count = len(transcript.split()) if transcript else 0

            return {
                "transcription": transcript,
                "processing_time": round(processing_time, 2),
                "confidence": round(confidence, 2),
                "word_count": word_count,
                "no_speech_detected": False
            }

        except Exception as e:
            logger.error(f"Deepgram API error: {str(e)}")
            raise
