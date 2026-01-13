import json
import os
import urllib3
from urllib.parse import unquote_plus

# Environment variables
API_BASE_URL = os.environ.get('API_BASE_URL', 'https://api.hey-watch.me/business')
API_TOKEN = os.environ.get('API_TOKEN', 'watchme-b2b-poc-2025')
SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_KEY')

# Initialize HTTP client
http = urllib3.PoolManager()


def get_session_id_from_s3_path(s3_path):
    """
    Get session_id from business_interview_sessions table using s3_audio_path

    Args:
        s3_path: S3 file path (e.g., recordings/{facility_id}/{child_id}/{date}/{session_id}.webm)

    Returns:
        session_id: UUID string or None if not found
    """
    try:
        print(f"Querying session for S3 path: {s3_path}")

        response = http.request(
            'GET',
            f"{SUPABASE_URL}/rest/v1/business_interview_sessions",
            fields={
                's3_audio_path': f'eq.{s3_path}',
                'select': 'id'
            },
            headers={
                'apikey': SUPABASE_KEY,
                'Authorization': f'Bearer {SUPABASE_KEY}'
            }
        )

        if response.status == 200:
            data = json.loads(response.data.decode('utf-8'))
            if data and len(data) > 0:
                session_id = data[0].get('id')
                print(f"Found session_id: {session_id}")
                return session_id

        print(f"Warning: Could not find session for s3_path: {s3_path}")
        return None

    except Exception as e:
        print(f"Error getting session_id: {e}")
        return None


def lambda_handler(event, context):
    """
    Lambda handler for S3 audio upload events (Business API)

    Flow:
    1. Receive S3 upload event
    2. Query business_interview_sessions table to get session_id
    3. Call POST /api/transcribe to start transcription

    Args:
        event: S3 event
        context: Lambda context

    Returns:
        dict: Response with statusCode and message
    """
    print(f"Received S3 event: {json.dumps(event)}")

    try:
        # Extract information from S3 event
        s3_record = event['Records'][0]['s3']
        bucket_name = s3_record['bucket']['name']
        object_key = unquote_plus(s3_record['object']['key'])

        print(f"Processing S3 object: {bucket_name}/{object_key}")

        # Get session_id from database
        session_id = get_session_id_from_s3_path(object_key)

        if not session_id:
            print(f"ERROR: No session found for s3_path: {object_key}")
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'Session not found for uploaded file'})
            }

        # Call POST /api/transcribe
        transcribe_url = f"{API_BASE_URL}/api/transcribe"

        response = http.request(
            'POST',
            transcribe_url,
            body=json.dumps({'session_id': session_id}).encode('utf-8'),
            headers={
                'Content-Type': 'application/json',
                'X-API-Token': API_TOKEN
            }
        )

        print(f"API response status: {response.status}")
        print(f"API response body: {response.data.decode('utf-8')}")

        # Check response status
        if response.status in [200, 202]:
            print(f"SUCCESS: Transcription started for session {session_id}")
            return {
                'statusCode': 200,
                'body': json.dumps({
                    'message': 'Transcription started successfully',
                    'session_id': session_id,
                    's3_path': object_key
                })
            }
        else:
            print(f"ERROR: API returned status {response.status}")
            raise Exception(f"API error: {response.status}")

    except Exception as e:
        print(f"ERROR processing S3 event: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }
