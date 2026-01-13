# システムアーキテクチャ

**最終更新**: 2026-01-13

---

## 📊 全体構成

### コンポーネント

```
┌─────────────────┐
│  Frontend (PWA) │ ← React + TypeScript + Vite
│  Port: 5176     │
└────────┬────────┘
         │ HTTPS
         ▼
┌─────────────────────────────────────────┐
│  Backend API (FastAPI)                  │
│  Port: 8052                             │
│  https://api.hey-watch.me/business      │
└────────┬────────────────────────────────┘
         │
         ├─→ S3 (watchme-business)
         ├─→ Supabase (PostgreSQL)
         ├─→ Speechmatics API (ASR)
         ├─→ OpenAI API (LLM)
         └─→ SQS (イベント通知)
```

### 技術スタック

| レイヤー | 技術 |
|---------|------|
| **Frontend** | React + TypeScript + Vite + PWA |
| **Backend** | FastAPI (Python 3.11) |
| **Database** | Supabase (PostgreSQL) |
| **Storage** | AWS S3 |
| **Message Queue** | AWS SQS (FIFO) |
| **Serverless** | AWS Lambda |
| **ASR** | Speechmatics Batch API |
| **LLM** | OpenAI GPT-4o |
| **Deploy** | GitHub Actions → ECR → EC2 (Sydney) |

---

## 🔄 データフロー（非同期処理）

### 全体フロー（完全自動化）✅ **2026-01-13 稼働開始**

```
1. 録音完了
   ↓
2. POST /api/upload
   - S3にアップロード (webm)
   - DBにセッション作成 (status: 'uploaded')
   ↓
3. S3イベント → Lambda: business-audio-upload-handler ✅ 自動実行
   - s3_audio_path から session_id を取得
   - POST /api/transcribe 自動呼び出し
   ↓
4. POST /api/transcribe → 202 Accepted (即座に返却)
   - status: 'transcribing'
   - バックグラウンドで Speechmatics API 呼び出し
   ↓
5. 文字起こし完了 (15分の音声でもOK)
   - DB更新: transcription 保存
   - status: 'transcribed'
   - SQS送信: business-transcription-completed-queue.fifo
   ↓
6. Lambda: business-transcription-completed-handler
   - SQS通知を受信
   - POST /api/analyze 呼び出し
   ↓
7. POST /api/analyze → 202 Accepted (即座に返却)
   - status: 'analyzing'
   - バックグラウンドで GPT-4o 分析
   ↓
8. 分析完了
   - DB更新: analysis_result 保存
   - status: 'completed'
   ↓
9. フロントエンド: ポーリングまたはWebSocketで結果取得
```

### なぜ非同期処理か

| 課題 | 解決策 |
|------|--------|
| 15分の音声 → タイムアウト（180秒） | バックグラウンド処理（時間無制限） |
| フロントエンド依存 | Lambda自動実行（S3イベント） |
| 処理失敗時のリトライ | SQS Dead Letter Queue |
| スケーラビリティ | SQS + Lambda の自動スケール |

### 完全自動化の実現（2026-01-13）

**✅ 達成内容:**
- S3アップロード → 文字起こし → 分析まで**完全自動**
- 手動トリガー不要
- ステータス管理でUI側から進捗確認可能

**技術スタック:**
- S3 Event Notification
- AWS Lambda (イベント駆動型)
- SQS FIFO Queue
- FastAPI (非同期バックグラウンド処理)

---

## 🗄️ データベース構造

### 主要テーブル

#### `business_interview_sessions`

```sql
CREATE TABLE business_interview_sessions (
  id UUID PRIMARY KEY,
  facility_id UUID NOT NULL,
  child_id UUID NOT NULL,
  staff_id UUID,
  s3_audio_path TEXT NOT NULL,
  duration_seconds INTEGER,

  -- 文字起こし
  transcription TEXT,
  transcription_metadata JSONB,

  -- 分析
  analysis_prompt TEXT,
  analysis_result JSONB,

  -- ステータス管理
  status TEXT NOT NULL, -- 'uploaded' | 'transcribing' | 'transcribed' | 'analyzing' | 'completed' | 'failed'
  error_message TEXT,

  recorded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### ステータス遷移（パターンA：シンプル版）

```
uploaded
  ↓ (S3イベント → Lambda → POST /api/transcribe)
transcribing
  ↓ (Speechmatics完了)
transcribed
  ↓ (SQS → Lambda → POST /api/analyze)
analyzing
  ↓ (GPT-4o完了)
completed

(エラー時)
  ↓
failed (error_messageに詳細)
```

**ステータス一覧:**

| ステータス | 説明 | 更新タイミング |
|-----------|------|--------------|
| `uploaded` | S3アップロード完了 | POST /api/upload 完了時 |
| `transcribing` | 文字起こし処理中 | POST /api/transcribe 開始時 |
| `transcribed` | 文字起こし完了 | Speechmatics API完了時 |
| `analyzing` | LLM分析処理中 | POST /api/analyze 開始時 |
| `completed` | 全処理完了 | GPT-4o分析完了時 |
| `failed` | エラー発生 | いずれかの処理で失敗時 |

---

## 🔌 API仕様

### エンドポイント

#### POST /api/upload

**リクエスト**:
```
Content-Type: multipart/form-data
- audio: File (webm/wav)
- facility_id: UUID
- child_id: UUID
```

**レスポンス** (200 OK):
```json
{
  "success": true,
  "session_id": "uuid",
  "s3_path": "recordings/...",
  "message": "Audio uploaded successfully"
}
```

#### POST /api/transcribe

**リクエスト**:
```json
{
  "session_id": "uuid"
}
```

**レスポンス** (202 Accepted):
```json
{
  "status": "processing",
  "message": "Transcription started"
}
```

**特徴**:
- 即座に202を返す（非同期処理）
- バックグラウンドでSpeechmaticsを呼び出し
- 完了時にSQS送信

#### POST /api/analyze

**リクエスト**:
```json
{
  "session_id": "uuid"
}
```

**レスポンス** (202 Accepted):
```json
{
  "status": "processing",
  "message": "Analysis started"
}
```

**特徴**:
- 即座に202を返す（非同期処理）
- バックグラウンドでGPT-4oを呼び出し

#### GET /api/sessions/{session_id}

**レスポンス** (200 OK):
```json
{
  "id": "uuid",
  "status": "completed",
  "transcription": "...",
  "analysis_result": {
    "summary": "..."
  },
  "created_at": "2026-01-13T00:00:00Z"
}
```

---

## ⚙️ AWS構成

### SQSキュー

| キュー名 | タイプ | 用途 |
|---------|-------|------|
| `business-transcription-completed-queue.fifo` | FIFO | 文字起こし完了通知 |
| `business-analysis-completed-queue.fifo` | FIFO | 分析完了通知（未使用） |

### Lambda関数

| 関数名 | トリガー | 処理 | 状態 |
|--------|---------|------|------|
| `business-audio-upload-handler` | S3 Upload (`recordings/*.webm`) | POST /api/transcribe 呼び出し | ✅ **デプロイ済み（2026-01-13）** |
| `business-transcription-completed-handler` | SQS | POST /api/analyze 呼び出し | ✅ デプロイ済み |

**完全自動化達成**: S3アップロード後、手動操作なしで文字起こし・分析まで自動実行されます。

### EC2

- **インスタンス**: t4g.large (AWS Graviton2)
- **リージョン**: ap-southeast-2 (Sydney)
- **IP**: 3.24.16.82
- **ドメイン**: api.hey-watch.me
- **コンテナ**: Docker (watchme-business-api)

---

## 🔐 環境変数管理

### 原則

**既存WatchMeパターン**: コード内にデフォルト値を定義

```python
SQS_TRANSCRIPTION_QUEUE_URL = os.getenv(
    "SQS_TRANSCRIPTION_QUEUE_URL",
    "https://sqs.ap-southeast-2.amazonaws.com/754724220380/business-transcription-completed-queue.fifo"
)
```

**メリット**:
- ✅ GitHub Secrets不要
- ✅ CI/CD設定がシンプル
- ✅ コードで直接確認可能
- ✅ 環境変数で上書き可能（柔軟性）

### 必要な環境変数

| 変数名 | 説明 | デフォルト値 |
|--------|------|------------|
| `AWS_ACCESS_KEY_ID` | AWS認証 | - |
| `AWS_SECRET_ACCESS_KEY` | AWS認証 | - |
| `AWS_REGION` | AWSリージョン | `ap-southeast-2` |
| `S3_BUCKET` | S3バケット名 | `watchme-business` |
| `SUPABASE_URL` | Supabase URL | - |
| `SUPABASE_KEY` | Supabase Key | - |
| `SPEECHMATICS_API_KEY` | Speechmatics API | - |
| `OPENAI_API_KEY` | OpenAI API | - |
| `API_TOKEN` | API認証トークン | `watchme-b2b-poc-2025` |

---

## 🚀 デプロイフロー

### GitHub Actions

```
1. git push origin main
   ↓
2. GitHub Actions トリガー
   ↓
3. Docker イメージビルド (linux/arm64)
   ↓
4. ECR へプッシュ
   ↓
5. EC2 へデプロイ
   - docker-compose pull
   - docker-compose up -d
   ↓
6. 完了（約7分）
```

### 手動デプロイ（EC2）

```bash
ssh -i ~/watchme-key.pem ubuntu@3.24.16.82
cd /home/ubuntu/watchme-business-api
./run-prod.sh
```

---

## 📈 スケーラビリティ

### 現在の構成

- **EC2**: 単一インスタンス
- **SQS + Lambda**: 自動スケール
- **Speechmatics**: API制限内
- **OpenAI**: API制限内

### 将来の拡張

1. **EC2マルチインスタンス**
   - ALB + Auto Scaling Group
   - コンテナオーケストレーション（ECS/EKS）

2. **データベース最適化**
   - Supabase のスケールアップ
   - Read Replica

3. **キャッシュ層**
   - Redis for session/result cache
   - CloudFront for static assets

---

## 🔍 モニタリング

### ログ

- **Backend API**: Docker logs
- **Lambda**: CloudWatch Logs
- **SQS**: CloudWatch Metrics

### アラート（未実装）

- API エラー率
- Lambda失敗率
- SQS DLQ メッセージ数
