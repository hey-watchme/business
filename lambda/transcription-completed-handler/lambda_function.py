import json
import os
import urllib3

# Environment variables
API_BASE_URL = os.environ.get('API_BASE_URL', 'https://api.hey-watch.me/business')
API_TOKEN = os.environ.get('API_TOKEN', 'watchme-b2b-poc-2025')

# Initialize HTTP client
http = urllib3.PoolManager()


def lambda_handler(event, context):
    """
    Lambda handler for transcription completion events

    Flow:
    1. Receive SQS message with session_id
    2. Call POST /api/analyze
    3. Return success (SQS message will be automatically deleted)

    Args:
        event: SQS event containing message body with session_id
        context: Lambda context

    Returns:
        dict: Response with statusCode and processed count
    """
    print(f"Received event: {json.dumps(event)}")

    processed_count = 0
    failed_count = 0

    # Process each SQS message
    for record in event['Records']:
        try:
            # Parse message body
            message_body = json.loads(record['body'])
            session_id = message_body.get('session_id')

            if not session_id:
                print(f"ERROR: No session_id in message: {message_body}")
                failed_count += 1
                continue

            print(f"Processing session: {session_id}")

            # Call POST /api/analyze
            analyze_url = f"{API_BASE_URL}/api/analyze"

            response = http.request(
                'POST',
                analyze_url,
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
                print(f"SUCCESS: Analysis started for session {session_id}")
                processed_count += 1
            else:
                print(f"ERROR: API returned status {response.status} for session {session_id}")
                failed_count += 1
                # Return error to keep message in queue for retry
                raise Exception(f"API error: {response.status}")

        except Exception as e:
            print(f"ERROR processing message: {str(e)}")
            failed_count += 1
            # Re-raise to keep message in DLQ
            raise e

    return {
        'statusCode': 200,
        'body': json.dumps({
            'message': f'Processed {processed_count} messages',
            'processed': processed_count,
            'failed': failed_count
        })
    }
