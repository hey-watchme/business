#!/usr/bin/env python3
"""
Test Google Cloud Speech-to-Text provider locally
"""
import asyncio
import sys
sys.path.insert(0, '/Users/kaya.matsumoto/projects/watchme/business/backend')

from services.asr_providers.google_speech import GoogleSpeechASRService
import json

async def test_google_speech():
    print("🎙️  Testing Google Cloud Speech-to-Text...")

    # Download test audio from S3
    import boto3
    s3 = boto3.client('s3', region_name='ap-southeast-2')
    audio_data = s3.get_object(
        Bucket='watchme-business',
        Key='samples/section001_raw.wav'
    )['Body'].read()

    # Create BytesIO object
    from io import BytesIO
    audio_file = BytesIO(audio_data)

    # Initialize Google Speech provider
    provider = GoogleSpeechASRService(model="chirp_2")

    # Transcribe
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

if __name__ == "__main__":
    asyncio.run(test_google_speech())
