import os
import time
from typing import BinaryIO, Dict, Any
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
import logging

logger = logging.getLogger(__name__)

class GoogleSpeechASRService:
    """Google Cloud Speech-to-Text ASR Service

    Supported models:
    - chirp_2: Chirp 2 model (GA in us-central1, asia-southeast1, europe-west4)
    - chirp_3: Chirp 3 model (Preview)
    - latest_long: Long-form audio (up to 5 hours)
    - latest_short: Short-form audio (< 1 minute)
    """

    def __init__(self, model: str = "chirp_2"):
        from google.cloud import speech_v2
        from google.api_core.client_options import ClientOptions

        credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        if not credentials_path:
            raise ValueError("GOOGLE_APPLICATION_CREDENTIALS environment variable not set")

        self._model = model
        self._project_id = "watchme-479214"
        self._location = "us-central1"  # US region for Chirp model + diarization

        # Use regional endpoint
        client_options = ClientOptions(
            api_endpoint=f"{self._location}-speech.googleapis.com"
        )
        self.client = speech_v2.SpeechClient(client_options=client_options)

        logger.info(f"Google Speech API initialized: model={model}, location={self._location}")

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
        """Transcribe audio file using Google Cloud Speech-to-Text API with retry"""
        try:
            start_time = time.time()

            # Reset file pointer and read audio data
            audio_file.seek(0)
            audio_data = audio_file.read()

            from google.cloud import speech_v2

            # Prepare request
            config = speech_v2.RecognitionConfig(
                auto_decoding_config=speech_v2.AutoDetectDecodingConfig(),
                language_codes=["ja-JP"],
                model=self._model,
                features=speech_v2.RecognitionFeatures(
                    enable_automatic_punctuation=True,
                    enable_word_time_offsets=True,
                    enable_word_confidence=True,
                )
            )

            request = speech_v2.RecognizeRequest(
                recognizer=f"projects/{self._project_id}/locations/{self._location}/recognizers/business-interview-recognizer",
                config=config,
                content=audio_data,
            )

            # Call Google Speech API
            response = self.client.recognize(request=request)

            processing_time = time.time() - start_time

            # Extract transcription text and metadata
            if not response.results:
                return {
                    "transcription": "",
                    "processing_time": round(processing_time, 2),
                    "confidence": 0.0,
                    "word_count": 0,
                    "utterances": [],
                    "paragraphs": [],
                    "speaker_count": 0,
                    "no_speech_detected": True,
                    "model": self._model,
                    "provider": "google",
                }

            # Combine all transcripts
            full_transcript = ""
            total_confidence = 0.0
            utterances = []
            speaker_set = set()

            for result in response.results:
                if not result.alternatives:
                    continue

                alternative = result.alternatives[0]
                full_transcript += alternative.transcript
                total_confidence += alternative.confidence

                # Extract speaker-tagged utterances
                if hasattr(alternative, 'words') and alternative.words:
                    current_speaker = None
                    current_utterance = {
                        "words": [],
                        "start": 0,
                        "end": 0,
                        "speaker": None
                    }

                    for word_info in alternative.words:
                        speaker_tag = getattr(word_info, 'speaker_tag', 0) if hasattr(word_info, 'speaker_tag') else 0
                        speaker_set.add(speaker_tag)

                        if current_speaker is None:
                            current_speaker = speaker_tag
                            current_utterance["speaker"] = speaker_tag
                            current_utterance["start"] = word_info.start_offset.total_seconds()

                        if speaker_tag != current_speaker:
                            # Speaker changed - save previous utterance
                            current_utterance["end"] = current_utterance["words"][-1]["end"]
                            current_utterance["transcript"] = "".join([w["word"] for w in current_utterance["words"]])
                            current_utterance["confidence"] = sum([w["confidence"] for w in current_utterance["words"]]) / len(current_utterance["words"])
                            utterances.append(current_utterance)

                            # Start new utterance
                            current_speaker = speaker_tag
                            current_utterance = {
                                "words": [],
                                "start": word_info.start_offset.total_seconds(),
                                "end": 0,
                                "speaker": speaker_tag
                            }

                        current_utterance["words"].append({
                            "word": word_info.word,
                            "start": word_info.start_offset.total_seconds(),
                            "end": word_info.end_offset.total_seconds(),
                            "confidence": word_info.confidence
                        })

                    # Add last utterance
                    if current_utterance["words"]:
                        current_utterance["end"] = current_utterance["words"][-1]["end"]
                        current_utterance["transcript"] = "".join([w["word"] for w in current_utterance["words"]])
                        current_utterance["confidence"] = sum([w["confidence"] for w in current_utterance["words"]]) / len(current_utterance["words"])
                        utterances.append(current_utterance)

            avg_confidence = total_confidence / len(response.results) if response.results else 0.0

            # Clean utterances (remove 'words' field for response)
            clean_utterances = []
            for utt in utterances:
                clean_utterances.append({
                    "start": round(utt["start"], 2),
                    "end": round(utt["end"], 2),
                    "transcript": utt["transcript"],
                    "speaker": utt["speaker"],
                    "confidence": round(utt["confidence"], 2)
                })

            return {
                "transcription": full_transcript,
                "processing_time": round(processing_time, 2),
                "confidence": round(avg_confidence, 2),
                "word_count": len(full_transcript),
                "utterances": clean_utterances,
                "paragraphs": [],  # Google Speech v2 doesn't provide paragraph segmentation
                "speaker_count": len(speaker_set),
                "no_speech_detected": False,
                "model": self._model,
                "provider": "google",
            }

        except Exception as e:
            logger.error(f"Google Speech API error: {str(e)}")
            raise
