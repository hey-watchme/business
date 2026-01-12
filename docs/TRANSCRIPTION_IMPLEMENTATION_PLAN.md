# 音声文字起こし機能 実装計画書

**作成日**: 2026-01-11
**対象プロジェクト**: WatchMe Business API
**現在の状況**: 録音→S3アップロード→DB保存まで完了
**次のステップ**: 文字起こし機能の追加

---

## 📋 目次

1. [現状分析](#1-現状分析)
2. [アーキテクチャ設計](#2-アーキテクチャ設計)
3. [既存実装の分析（transcriber-v2）](#3-既存実装の分析transcriber-v2)
4. [実装ステップ](#4-実装ステップ)
5. [環境変数設定](#5-環境変数設定)
6. [テスト計画](#6-テスト計画)
7. [デプロイ手順](#7-デプロイ手順)

---

## 1. 現状分析

### 1.1 完了済み機能

```
Business Frontend (PWA)
  ↓ 録音
  ↓ POST /api/upload
Business Backend (FastAPI :8052)
  ↓ S3アップロード
AWS S3 (watchme-business)
  ↓ 保存完了
Supabase (business_interview_sessions)
  ✅ status: 'completed'
  ✅ s3_audio_path: 'recordings/{facility_id}/{child_id}/{date}/{session_id}.webm'
```

### 1.2 実装済みテーブル

#### `business_interview_sessions`

```sql
CREATE TABLE public.business_interview_sessions (
  id UUID PRIMARY KEY,
  facility_id UUID NOT NULL,
  child_id UUID NOT NULL,
  s3_audio_path TEXT,           -- ✅ 既に保存されている
  transcription TEXT,            -- ❌ NULL（これから実装）
  status TEXT DEFAULT 'recording',  -- 現在は 'completed' で固定
  duration_seconds INTEGER,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 1.3 現在の課題

- ✅ 録音データはS3に保存されている
- ✅ DBにパスは記録されている
- ❌ **文字起こし処理がない**
- ❌ `transcription` カラムが空のまま

---

## 2. アーキテクチャ設計

### 2.1 処理フロー全体像

```
┌──────────────────────────────────────────────────────────────┐
│ Phase 1: 録音・アップロード（✅ 実装済み）                    │
└──────────────────────────────────────────────────────────────┘
Business Frontend (PWA)
  ↓ MediaRecorder API
  ↓ 録音完了
  ↓ POST /api/upload (multipart/form-data)
Business Backend (:8052)
  ↓ S3.put_object()
  ↓ DB.insert() → status: 'completed'
AWS S3 (watchme-business)
  ↓ 音声ファイル保存

┌──────────────────────────────────────────────────────────────┐
│ Phase 2: 文字起こし（⚠️ これから実装）                       │
└──────────────────────────────────────────────────────────────┘
Business Backend (:8052)
  ↓ POST /api/transcribe (新規エンドポイント)
  ↓ {
  ↓   "session_id": "uuid"
  ↓ }
  ↓
  ↓ 1. DB.select() → s3_audio_path取得
  ↓ 2. S3.get_object() → 音声ダウンロード
  ↓ 3. Deepgram API呼び出し
  ↓ 4. DB.update() → transcription保存
  ↓
Deepgram Nova-2 API
  ↓ 日本語文字起こし
  ↓ レスポンス: { "transcript": "...", "confidence": 0.95, ... }
  ↓
Supabase (business_interview_sessions)
  ✅ transcription: "文字起こし結果"
  ✅ status: 'transcribed'
```

### 2.2 新規エンドポイント設計

#### POST `/api/transcribe`

**リクエスト**:
```json
{
  "session_id": "uuid"
}
```

**レスポンス（成功）**:
```json
{
  "success": true,
  "session_id": "uuid",
  "transcription": "文字起こしされたテキスト",
  "confidence": 0.95,
  "duration_seconds": 120,
  "processing_time_seconds": 3.5,
  "message": "Transcription completed successfully"
}
```

**レスポンス（エラー）**:
```json
{
  "success": false,
  "error": "Session not found",
  "detail": "No session found with id: xxx"
}
```

### 2.3 ステータス管理

```
recording     → アップロード中（フロントエンド側）
completed     → アップロード完了（現在の状態）
transcribing  → 文字起こし中（新規追加）
transcribed   → 文字起こし完了（新規追加）
failed        → エラー発生（新規追加）
```

---

## 3. 既存実装の分析（transcriber-v2）

### 3.1 使用しているASRプロバイダー

#### ファイル: `/api/vibe-analysis/transcriber-v2/app/asr_providers.py`

```python
# 現在の設定（L24-25）
CURRENT_PROVIDER = "deepgram"  # プロバイダー名
CURRENT_MODEL = "nova-2"        # モデル名

# サポート対象
- deepgram (nova-2, nova-3)
- groq (whisper-large-v3-turbo)
- azure (ja-JP)
- aiola (jargonic-v2)
```

### 3.2 DeepgramProviderの実装（L491-673）

**初期化**:
```python
from deepgram import DeepgramClient

api_key = os.getenv("DEEPGRAM_API_KEY")
self.client = DeepgramClient(api_key=api_key)
```

**文字起こし処理**:
```python
async def transcribe_audio(
    self,
    audio_file: BinaryIO,
    filename: str,
    detailed: bool = False,
    high_accuracy: bool = False
) -> Dict[str, Any]:
    # 音声データを読み込み
    audio_file.seek(0)
    audio_data = audio_file.read()

    # Deepgram APIオプション設定
    options = {
        "model": "nova-2",
        "language": "ja",
        "punctuate": True,      # 句読点自動挿入
        "diarize": True,        # 話者分離
        "smart_format": True,   # 日付・数字の自動整形
        "utterances": True,     # 発話単位での区切り
    }

    # API呼び出し（SDK v3.7.0）
    from deepgram import PrerecordedOptions

    prerecorded_options = PrerecordedOptions(
        model=options["model"],
        language=options["language"],
        punctuate=options["punctuate"],
        diarize=options["diarize"],
        smart_format=options["smart_format"],
        utterances=options["utterances"],
    )

    response = self.client.listen.rest.v("1").transcribe_file(
        source={"buffer": audio_data},
        options=prerecorded_options
    )

    # レスポンスからテキストを取得
    transcript = response.results.channels[0].alternatives[0].transcript
    confidence = response.results.channels[0].alternatives[0].confidence

    return {
        "transcription": transcript,
        "confidence": confidence,
        "word_count": len(transcript.split()),
        "estimated_duration": response.results.metadata.duration
    }
```

### 3.3 必要な依存パッケージ

#### `transcriber-v2/requirements.txt`:
```
deepgram-sdk==3.7.0
tenacity>=8.2.0  # リトライ処理
boto3==1.35.57   # S3アクセス
supabase==2.10.0
```

### 3.4 環境変数

```bash
# Deepgram
DEEPGRAM_API_KEY=your-deepgram-api-key

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-key

# AWS S3
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
S3_BUCKET_NAME=watchme-business  # Business用バケット
AWS_REGION=ap-southeast-2
```

---

## 4. 実装ステップ

### Step 1: パッケージ追加（requirements.txt）

**ファイル**: `/business/backend/requirements.txt`

```diff
 fastapi==0.115.0
 uvicorn==0.32.1
 python-multipart==0.0.9
 pydantic==2.11.7
 python-dotenv==1.0.1
 aiofiles==23.2.1
 boto3==1.34.34
 supabase==2.27.1
 httpx==0.27.2
 openpyxl==3.1.2
 groq==0.4.2
 openai==1.14.0
+deepgram-sdk==3.7.0
+tenacity>=8.2.0
```

### Step 2: ASRサービスモジュール作成

**ファイル**: `/business/backend/services/asr_provider.py`（新規作成）

```python
# services/asr_provider.py
import os
import logging
from typing import BinaryIO, Dict, Any
from deepgram import DeepgramClient, PrerecordedOptions
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from fastapi import HTTPException

logger = logging.getLogger(__name__)

class DeepgramASRService:
    """Deepgram Nova-2 ASR Service for Business API"""

    def __init__(self):
        api_key = os.getenv("DEEPGRAM_API_KEY")
        if not api_key:
            raise ValueError("DEEPGRAM_API_KEY environment variable is required")

        self.client = DeepgramClient(api_key=api_key)
        self.model = "nova-2"
        logger.info(f"Deepgram ASR initialized with model: {self.model}")

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
        """
        Transcribe audio file using Deepgram Nova-2

        Args:
            audio_file: Binary audio file stream
            filename: Original filename

        Returns:
            {
                "transcription": "text",
                "confidence": 0.95,
                "duration_seconds": 120.5,
                "word_count": 350
            }
        """
        try:
            logger.info(f"Starting transcription for: {filename}")

            # Read audio data
            audio_file.seek(0)
            audio_data = audio_file.read()

            # Configure Deepgram options (Japanese, punctuation, speaker diarization)
            options = PrerecordedOptions(
                model=self.model,
                language="ja",           # Japanese
                punctuate=True,          # Auto punctuation
                diarize=True,            # Speaker diarization
                smart_format=True,       # Smart formatting (dates, numbers)
                utterances=True,         # Utterance segmentation
            )

            # Call Deepgram API
            response = self.client.listen.rest.v("1").transcribe_file(
                source={"buffer": audio_data},
                options=options
            )

            # Extract results
            if not response or not response.results:
                return {
                    "transcription": "",
                    "confidence": 0.0,
                    "duration_seconds": 0.0,
                    "word_count": 0,
                    "no_speech_detected": True
                }

            channels = response.results.channels
            if not channels or len(channels) == 0:
                return {
                    "transcription": "",
                    "confidence": 0.0,
                    "duration_seconds": 0.0,
                    "word_count": 0,
                    "no_speech_detected": True
                }

            alternatives = channels[0].alternatives
            if not alternatives or len(alternatives) == 0:
                return {
                    "transcription": "",
                    "confidence": 0.0,
                    "duration_seconds": 0.0,
                    "word_count": 0,
                    "no_speech_detected": True
                }

            transcript = alternatives[0].transcript.strip() if alternatives[0].transcript else ""

            if not transcript:
                return {
                    "transcription": "",
                    "confidence": 0.0,
                    "duration_seconds": 0.0,
                    "word_count": 0,
                    "no_speech_detected": True
                }

            confidence = alternatives[0].confidence if hasattr(alternatives[0], 'confidence') else 0.0
            word_count = len(transcript.split())

            # Get duration from metadata
            duration = 0.0
            if hasattr(response.results, 'metadata') and hasattr(response.results.metadata, 'duration'):
                duration = response.results.metadata.duration

            logger.info(f"Transcription completed: {word_count} words, confidence: {confidence:.2f}")

            return {
                "transcription": transcript,
                "confidence": round(confidence, 2),
                "duration_seconds": round(duration, 2),
                "word_count": word_count
            }

        except Exception as e:
            logger.error(f"Deepgram API error: {e}")
            raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")
```

### Step 3: 文字起こしエンドポイント追加

**ファイル**: `/business/backend/app.py`

```python
# 既存のインポートに追加
import tempfile
import os
from services.asr_provider import DeepgramASRService

# サービス初期化（既存のs3_client, supabaseの後に追加）
asr_service = DeepgramASRService() if os.getenv("DEEPGRAM_API_KEY") else None

# Pydanticモデル追加
class TranscribeRequest(BaseModel):
    session_id: str

class TranscribeResponse(BaseModel):
    success: bool
    session_id: str
    transcription: str
    confidence: float
    duration_seconds: float
    word_count: int
    message: str

# エンドポイント追加
@app.post("/api/transcribe", response_model=TranscribeResponse)
async def transcribe_session(
    request: TranscribeRequest,
    x_api_token: str = Header(None, alias="X-API-Token")
):
    """
    Transcribe audio for a given interview session

    Steps:
    1. Fetch session from DB
    2. Download audio from S3
    3. Call Deepgram API
    4. Save transcription to DB
    """
    # Validate token
    if x_api_token != API_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid API token")

    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")

    if not asr_service:
        raise HTTPException(status_code=500, detail="ASR service not configured (DEEPGRAM_API_KEY missing)")

    try:
        # 1. Fetch session from DB
        result = supabase.table('business_interview_sessions')\
            .select('*')\
            .eq('id', request.session_id)\
            .single()\
            .execute()

        if not result.data:
            raise HTTPException(status_code=404, detail=f"Session not found: {request.session_id}")

        session = result.data
        s3_audio_path = session.get('s3_audio_path')

        if not s3_audio_path:
            raise HTTPException(status_code=400, detail="Session has no audio file")

        # 2. Download audio from S3
        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp_file:
            tmp_file_path = tmp_file.name

            try:
                s3_client.download_file(S3_BUCKET, s3_audio_path, tmp_file_path)

                # 3. Call Deepgram API
                with open(tmp_file_path, 'rb') as audio_file:
                    transcription_result = await asr_service.transcribe_audio(
                        audio_file,
                        os.path.basename(s3_audio_path)
                    )

                # 4. Save transcription to DB
                supabase.table('business_interview_sessions').update({
                    'transcription': transcription_result['transcription'],
                    'duration_seconds': int(transcription_result['duration_seconds']),
                    'status': 'transcribed'
                }).eq('id', request.session_id).execute()

                return TranscribeResponse(
                    success=True,
                    session_id=request.session_id,
                    transcription=transcription_result['transcription'],
                    confidence=transcription_result['confidence'],
                    duration_seconds=transcription_result['duration_seconds'],
                    word_count=transcription_result['word_count'],
                    message="Transcription completed successfully"
                )

            finally:
                # Clean up temp file
                if os.path.exists(tmp_file_path):
                    os.unlink(tmp_file_path)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")
```

### Step 4: ステータスカラムの更新（オプション）

**ファイル**: `/business/infrastructure/supabase/update_status_enum.sql`（新規作成）

```sql
-- Add new status values to business_interview_sessions
ALTER TABLE public.business_interview_sessions
DROP CONSTRAINT IF EXISTS business_interview_sessions_status_check;

ALTER TABLE public.business_interview_sessions
ADD CONSTRAINT business_interview_sessions_status_check
CHECK (status IN ('recording', 'completed', 'transcribing', 'transcribed', 'failed'));

COMMENT ON COLUMN public.business_interview_sessions.status IS 'recording, completed, transcribing, transcribed, failed';
```

---

## 5. 環境変数設定

### 5.1 必要な環境変数（追加分）

```bash
# Deepgram API
DEEPGRAM_API_KEY=your-deepgram-api-key
```

**⚠️ 重要**: 既存のtranscriber-v2と同じAPIキーを使用可能

### 5.2 環境変数設定手順（3箇所セット）

#### 1. GitHub Secrets
```
Repository: hey-watchme/business
Settings > Secrets and variables > Actions
→ New repository secret

Name: DEEPGRAM_API_KEY
Value: your-deepgram-api-key
```

#### 2. `docker-compose.prod.yml`
```yaml
services:
  business-api:
    environment:
      # 既存の環境変数...
      - DEEPGRAM_API_KEY=${DEEPGRAM_API_KEY}  # ← 追加
```

#### 3. `.github/workflows/deploy-to-ecr.yml`

**3-a. `env:` セクション**:
```yaml
env:
  # 既存の環境変数...
  DEEPGRAM_API_KEY: ${{ secrets.DEEPGRAM_API_KEY }}  # ← 追加
```

**3-b. `.env` 作成スクリプト**:
```yaml
run: |
  ssh ${EC2_USER}@${EC2_HOST} << ENDSSH
    cd /home/ubuntu/watchme-business-api
    # 既存のecho文...
    echo "DEEPGRAM_API_KEY=${DEEPGRAM_API_KEY}" >> .env  # ← 追加
  ENDSSH
```

---

## 6. テスト計画

### 6.1 ローカルテスト（構文チェックのみ）

```bash
# 1. パッケージ追加後の構文チェック
cd /Users/kaya.matsumoto/projects/watchme/business/backend
python3 -m py_compile app.py
python3 -m py_compile services/asr_provider.py

# 2. エンコーディング確認
file app.py
file services/asr_provider.py

# 期待される出力: "Python script text executable, UTF-8 text"
```

### 6.2 本番デプロイ後のテスト

#### Step 1: ヘルスチェック
```bash
curl https://api.hey-watch.me/business/health
```

**期待レスポンス**:
```json
{
  "status": "healthy",
  "service": "watchme-business-api",
  "s3_bucket": "watchme-business",
  "supabase_connected": true
}
```

#### Step 2: 文字起こしテスト

**前提条件**: 既にアップロード済みのセッションIDが必要

```bash
# 1. 既存セッション一覧を確認（Supabase Dashboard）
# business_interview_sessions テーブルから session_id をコピー

# 2. 文字起こしAPIを実行
curl -X POST https://api.hey-watch.me/business/api/transcribe \
  -H "Content-Type: application/json" \
  -H "X-API-Token: watchme-b2b-poc-2025" \
  -d '{
    "session_id": "your-session-id-here"
  }'
```

**期待レスポンス**:
```json
{
  "success": true,
  "session_id": "xxx",
  "transcription": "文字起こしされた内容...",
  "confidence": 0.95,
  "duration_seconds": 120.5,
  "word_count": 350,
  "message": "Transcription completed successfully"
}
```

#### Step 3: DB確認

```sql
-- Supabase SQL Editor
SELECT
  id,
  status,
  transcription,
  duration_seconds,
  created_at
FROM public.business_interview_sessions
WHERE id = 'your-session-id-here';
```

**期待結果**:
- `status`: "transcribed"
- `transcription`: テキストが保存されている
- `duration_seconds`: 数値が入っている

### 6.3 エラーケースのテスト

#### ケース1: 存在しないセッションID
```bash
curl -X POST https://api.hey-watch.me/business/api/transcribe \
  -H "Content-Type: application/json" \
  -H "X-API-Token: watchme-b2b-poc-2025" \
  -d '{
    "session_id": "00000000-0000-0000-0000-000000000000"
  }'
```

**期待レスポンス**:
```json
{
  "detail": "Session not found: 00000000-0000-0000-0000-000000000000"
}
```

#### ケース2: 無効なAPIトークン
```bash
curl -X POST https://api.hey-watch.me/business/api/transcribe \
  -H "Content-Type: application/json" \
  -H "X-API-Token: invalid-token" \
  -d '{
    "session_id": "xxx"
  }'
```

**期待レスポンス**:
```json
{
  "detail": "Invalid API token"
}
```

---

## 7. デプロイ手順

### 7.1 事前準備

#### 1. Deepgram APIキーの確認
```bash
# 既存のtranscriber-v2の.envから取得
cat /Users/kaya.matsumoto/projects/watchme/api/vibe-analysis/transcriber-v2/.env | grep DEEPGRAM_API_KEY
```

#### 2. GitHub Secretsに登録
```
https://github.com/hey-watchme/business/settings/secrets/actions
→ New repository secret
→ Name: DEEPGRAM_API_KEY
→ Value: (上記で確認したキー)
```

### 7.2 コード修正＆デプロイ

```bash
cd /Users/kaya.matsumoto/projects/watchme/business/backend

# 1. requirements.txt更新
# （Step 1の内容を反映）

# 2. services/asr_provider.py作成
mkdir -p services
# （Step 2の内容を作成）

# 3. app.py更新
# （Step 3の内容を反映）

# 4. 構文チェック
python3 -m py_compile app.py
python3 -m py_compile services/asr_provider.py
file app.py services/asr_provider.py

# 5. GitHub push（CI/CD自動実行）
git add .
git commit -m "feat: add Deepgram transcription API endpoint

- Add deepgram-sdk and tenacity to requirements.txt
- Create services/asr_provider.py with DeepgramASRService
- Add POST /api/transcribe endpoint to app.py
- Support status: transcribing, transcribed, failed
- Use nova-2 model with Japanese language support"

git push origin main
```

### 7.3 デプロイ監視

```bash
# GitHub Actions監視
gh run watch

# デプロイ完了後、ログ確認
gh run list --limit 3
gh run view --log
```

### 7.4 本番確認

```bash
# 1. コンテナ起動確認
ssh -i ~/watchme-key.pem ubuntu@3.24.16.82
docker ps | grep business

# 2. ログ確認
docker logs watchme-business-api --tail 100 -f

# 3. 環境変数確認
docker exec watchme-business-api printenv | grep DEEPGRAM_API_KEY

# 期待: DEEPGRAM_API_KEY=xxx（キーが表示される）
```

---

## 8. トラブルシューティング

### 問題1: `DEEPGRAM_API_KEY` が見つからない

**症状**:
```
HTTPException: ASR service not configured (DEEPGRAM_API_KEY missing)
```

**解決手順**:
```bash
# 1. GitHub Secretsを確認
gh secret list

# 2. docker-compose.prod.yml を確認
cat docker-compose.prod.yml | grep DEEPGRAM

# 3. .github/workflows/deploy-to-ecr.yml を確認
cat .github/workflows/deploy-to-ecr.yml | grep DEEPGRAM

# 4. EC2で環境変数を確認
ssh -i ~/watchme-key.pem ubuntu@3.24.16.82
docker exec watchme-business-api printenv | grep DEEPGRAM
```

### 問題2: S3からのダウンロードに失敗

**症状**:
```
ClientError: Access Denied
```

**解決手順**:
```bash
# AWS認証情報を確認
docker exec watchme-business-api printenv | grep AWS

# S3バケットポリシーを確認（admin権限必要）
aws s3api get-bucket-policy --bucket watchme-business --profile admin
```

### 問題3: Deepgram APIエラー

**症状**:
```
HTTPException: Transcription failed: ...
```

**解決手順**:
```bash
# 1. Deepgram APIキーの有効性を確認
curl -X POST https://api.deepgram.com/v1/listen \
  -H "Authorization: Token YOUR_DEEPGRAM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://static.deepgram.com/examples/Bueller-Life-moves-pretty-fast.wav"}'

# 2. Deepgramの利用状況を確認
# https://console.deepgram.com/

# 3. コンテナログで詳細エラーを確認
docker logs watchme-business-api --tail 100 -f
```

---

## 9. 次のステップ（将来拡張）

### Phase 2: フロントエンド統合
- 録音完了後、自動的に文字起こしを実行
- 文字起こし中のローディング表示
- 結果の表示UI

### Phase 3: LLM処理
- GPT-4oで構造化分析
- 個別支援計画書の自動生成

### Phase 4: 最適化
- 長尺音声対応（分割処理）
- 話者分離情報の活用
- リアルタイム進捗表示

---

## 10. まとめ

### 実装の核心ポイント

1. **既存実装の再利用**: transcriber-v2のDeepgram実装をそのまま活用
2. **同じAPIキー**: 既存プロジェクトのDEEPGRAM_API_KEYを共有
3. **シンプルな処理**: S3 → Deepgram → DB の3ステップ
4. **環境変数管理**: GitHub Secrets + docker-compose + CI/CDの3箇所セット

### 実装時間の見積もり

- コード実装: 1-2時間
- 環境変数設定: 30分
- デプロイ＆テスト: 1時間
- **合計**: 3-4時間

### 成功の判断基準

✅ POST /api/transcribe でエラーが出ない
✅ DBの `transcription` カラムにテキストが保存される
✅ `status` が "transcribed" に更新される
✅ レスポンスに confidence, duration_seconds が含まれる

---

**作成者**: Claude (Anthropic)
**最終更新**: 2026-01-11
**参考**: transcriber-v2実装、IMPLEMENTATION_PLAN.md
