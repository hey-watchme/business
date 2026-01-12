#!/usr/bin/env python3
"""
Test Speechmatics ASR provider locally
"""
import asyncio
import sys
import os
sys.path.insert(0, '/Users/kaya.matsumoto/projects/watchme/business/backend')

# Load environment variables from .env
from dotenv import load_dotenv
load_dotenv('/Users/kaya.matsumoto/projects/watchme/business/backend/.env')

from services.asr_providers.speechmatics_provider import SpeechmaticsASRService
import json

async def test_speechmatics():
    print("🎙️  Testing Speechmatics ASR...")
    print(f"API Key: {os.getenv('SPEECHMATICS_API_KEY')[:10]}...")

    # Download test audio from S3
    import boto3
    s3 = boto3.client('s3', region_name='ap-southeast-2')
    audio_data = s3.get_object(
        Bucket='watchme-business',
        Key='samples/section001_raw.wav'
    )['Body'].read()

    print(f"Downloaded audio: {len(audio_data)} bytes")

    # Create BytesIO object
    from io import BytesIO
    audio_file = BytesIO(audio_data)

    # Initialize Speechmatics provider
    provider = SpeechmaticsASRService()

    # Transcribe
    print("\n⏳ Transcribing...")
    result = await provider.transcribe_audio(
        audio_file=audio_file,
        filename="section001_raw.wav"
    )

    print("\n📝 Result:")
    print(json.dumps(result, indent=2, ensure_ascii=False))

    print(f"\n✅ Success!")
    print(f"   Provider: {result['provider']}")
    print(f"   Model: {result['model']}")
    print(f"   Processing time: {result['processing_time']}s")
    print(f"   Confidence: {result['confidence']}")
    print(f"   Speaker count: {result['speaker_count']}")
    print(f"   Utterances: {len(result['utterances'])}")
    print(f"   Word count: {result['word_count']}")

if __name__ == "__main__":
    asyncio.run(test_speechmatics())
