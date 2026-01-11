"""
ASR Provider Manager

Supported providers:
- Deepgram (nova-2, nova-3, whisper)
- Google Cloud Speech-to-Text (chirp, latest_long)
- AWS Transcribe (standard, medical)
- Azure Speech (standard)
"""

from typing import BinaryIO, Dict, Any
from abc import ABC, abstractmethod

class BaseASRProvider(ABC):
    """Base class for all ASR providers"""

    @abstractmethod
    async def transcribe_audio(
        self,
        audio_file: BinaryIO,
        filename: str
    ) -> Dict[str, Any]:
        """
        Transcribe audio file

        Returns:
        {
            "transcription": str,
            "processing_time": float,
            "confidence": float,
            "word_count": int,
            "utterances": list,
            "paragraphs": list,
            "speaker_count": int,
            "model": str,
            "provider": str,
            "no_speech_detected": bool
        }
        """
        pass
