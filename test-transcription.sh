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
  -F "subject_id=00000000-0000-0000-0000-000000000002")

SESSION_ID=$(echo $UPLOAD_RESPONSE | jq -r '.session_id')
echo "✓ Uploaded. Session ID: $SESSION_ID"
echo ""

# 3. Transcribe (async processing)
echo "🎙️  Starting transcription..."
TRANSCRIBE_RESPONSE=$(curl -s -X POST $API_URL/api/transcribe \
  -H "Content-Type: application/json" \
  -H "X-API-Token: $API_TOKEN" \
  -d "{\"session_id\": \"$SESSION_ID\"}")

echo "✓ Transcription started"
echo "$TRANSCRIBE_RESPONSE" | jq '.'
echo ""

# 4. Wait and check status
echo "⏳ Waiting for transcription to complete (checking every 10 seconds)..."
MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  sleep 10

  SESSION_DATA=$(curl -s $API_URL/api/sessions/$SESSION_ID -H "X-API-Token: $API_TOKEN")
  STATUS=$(echo $SESSION_DATA | jq -r '.status')

  echo "Status: $STATUS (attempt $((RETRY_COUNT + 1))/$MAX_RETRIES)"

  if [ "$STATUS" == "transcribed" ] || [ "$STATUS" == "completed" ]; then
    echo ""
    echo "✅ Transcription completed!"
    echo ""
    echo "📝 Result:"
    echo $SESSION_DATA | jq '{status: .status, transcription: .transcription, transcription_metadata: .transcription_metadata}'
    exit 0
  elif [ "$STATUS" == "failed" ]; then
    echo ""
    echo "❌ Transcription failed"
    echo ""
    echo "Error:"
    echo $SESSION_DATA | jq '{status: .status, error_message: .error_message}'
    exit 1
  fi

  RETRY_COUNT=$((RETRY_COUNT + 1))
done

echo ""
echo "⏱️  Timeout: Transcription did not complete within expected time"
echo "Session ID: $SESSION_ID"
echo "Check status manually: curl $API_URL/api/sessions/$SESSION_ID -H \"X-API-Token: $API_TOKEN\""
