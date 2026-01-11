#!/bin/bash

# Usage: ./test-transcription.sh [filename]
# Example: ./test-transcription.sh section001_raw.wav

FILENAME=${1:-section001_raw.wav}
API_URL="https://api.hey-watch.me/business"
API_TOKEN="watchme-b2b-poc-2025"

echo "🎵 Testing transcription with: $FILENAME"
echo ""

# 1. Download from S3
echo "📥 Downloading from S3..."
PRESIGNED_URL=$(aws s3 presign s3://watchme-business/samples/$FILENAME --region ap-southeast-2 --expires-in 3600)
curl -s -o /tmp/$FILENAME "$PRESIGNED_URL"
echo "✓ Downloaded to /tmp/$FILENAME"
echo ""

# 2. Upload
echo "📤 Uploading to API..."
UPLOAD_RESPONSE=$(curl -s -X POST $API_URL/api/upload \
  -H "X-API-Token: $API_TOKEN" \
  -F "audio=@/tmp/$FILENAME;type=audio/wav" \
  -F "facility_id=00000000-0000-0000-0000-000000000001" \
  -F "child_id=00000000-0000-0000-0000-000000000002")

SESSION_ID=$(echo $UPLOAD_RESPONSE | jq -r '.session_id')
echo "✓ Uploaded. Session ID: $SESSION_ID"
echo ""

# 3. Transcribe
echo "🎙️  Transcribing..."
TRANSCRIBE_RESPONSE=$(curl -s -X POST $API_URL/api/transcribe \
  -H "Content-Type: application/json" \
  -H "X-API-Token: $API_TOKEN" \
  -d "{\"session_id\": \"$SESSION_ID\"}")

echo "✓ Transcription completed"
echo ""
echo "📝 Result:"
echo $TRANSCRIBE_RESPONSE | jq '.'
