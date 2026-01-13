# Business Audio Upload Handler

S3アップロードイベントをトリガーに文字起こし処理を自動開始するLambda関数

## 📋 概要

S3バケット（`watchme-business`）にファイルがアップロードされたら、自動的に文字起こし処理を開始する。

## 🔄 処理フロー

```
1. S3にファイルアップロード (webm)
   ↓
2. S3イベントがこのLambdaをトリガー
   ↓
3. business_interview_sessions テーブルから session_id 取得
   ↓
4. POST /api/transcribe を呼び出し
   ↓
5. バックグラウンドで文字起こし開始
```

## ⚙️ 環境変数

| 変数名 | 説明 | デフォルト値 |
|--------|------|------------|
| `API_BASE_URL` | Business API のURL | `https://api.hey-watch.me/business` |
| `API_TOKEN` | API認証トークン | `watchme-b2b-poc-2025` |
| `SUPABASE_URL` | Supabase URL | - |
| `SUPABASE_KEY` | Supabase Service Role Key | - |

## 🚀 デプロイ手順

### 1. Lambda関数パッケージ作成

```bash
cd /Users/kaya.matsumoto/projects/watchme/business/lambda/audio-upload-handler

# Install dependencies
pip3 install -r requirements.txt -t .

# Create ZIP
zip -r lambda_function.zip lambda_function.py urllib3/
```

### 2. AWS Lambda作成

```bash
# Create Lambda function
aws lambda create-function \
  --function-name business-audio-upload-handler \
  --runtime python3.11 \
  --role arn:aws:iam::754724220380:role/watchme-lambda-role \
  --handler lambda_function.lambda_handler \
  --zip-file fileb://lambda_function.zip \
  --timeout 60 \
  --memory-size 256 \
  --region ap-southeast-2

# Set environment variables
aws lambda update-function-configuration \
  --function-name business-audio-upload-handler \
  --environment "Variables={
    API_BASE_URL=https://api.hey-watch.me/business,
    API_TOKEN=watchme-b2b-poc-2025,
    SUPABASE_URL=https://qvtlwotzuzbavrzqhyvt.supabase.co,
    SUPABASE_KEY=YOUR_SERVICE_ROLE_KEY
  }" \
  --region ap-southeast-2
```

### 3. S3イベント設定

```bash
# Add S3 trigger permission
aws lambda add-permission \
  --function-name business-audio-upload-handler \
  --statement-id s3-trigger-permission \
  --action lambda:InvokeFunction \
  --principal s3.amazonaws.com \
  --source-arn arn:aws:s3:::watchme-business \
  --region ap-southeast-2

# Create S3 event notification (via AWS Console)
# - Bucket: watchme-business
# - Event: s3:ObjectCreated:*
# - Prefix: recordings/
# - Suffix: .webm
# - Lambda: business-audio-upload-handler
```

## 🧪 テスト

### ローカルテスト（模擬S3イベント）

```bash
python3 -c "
import lambda_function
import json

event = {
    'Records': [{
        's3': {
            'bucket': {'name': 'watchme-business'},
            'object': {'key': 'recordings/facility-id/child-id/2026-01-13/session-id.webm'}
        }
    }]
}

result = lambda_function.lambda_handler(event, None)
print(json.dumps(result, indent=2))
"
```

### 本番テスト

```bash
# 実際にファイルをアップロードして確認
aws s3 cp test.webm s3://watchme-business/recordings/test/test/2026-01-13/test.webm

# CloudWatch Logsで確認
aws logs tail /aws/lambda/business-audio-upload-handler --follow
```

## 📊 モニタリング

- **CloudWatch Logs**: `/aws/lambda/business-audio-upload-handler`
- **Lambda Metrics**: Invocations, Errors, Duration

## 🔧 トラブルシューティング

### session_id が見つからない

→ business_interview_sessions テーブルに該当レコードがあるか確認

### API呼び出しエラー

→ API_TOKEN と API_BASE_URL が正しいか確認

### タイムアウト

→ Timeout設定を60秒→120秒に延長
