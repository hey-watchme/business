# 非同期処理アーキテクチャ 実装計画書

**作成日**: 2026-01-11
**最終更新**: 2026-01-12
**対象プロジェクト**: WatchMe Business API
**目的**: 1時間の音声処理に対応、堅牢なイベント駆動型システム構築

---

## ✅ 実装完了（2026-01-12）

### Phase 1: インフラ構築
- ✅ **SQSキュー作成**（FIFO）
  - `business-transcription-completed-queue.fifo`
  - `business-analysis-completed-queue.fifo`
- ✅ **Lambda関数作成**
  - `business-transcription-completed-handler`
  - SQSトリガー設定完了
- ✅ **DBカラム追加＆status制約更新**
  - `analysis_prompt`, `analysis_result`, `error_message`
  - status: 'recording' → 'uploaded' → 'transcribing' → 'transcribed' → 'analyzing' → 'completed'

### Phase 2: API実装
- ✅ **バックグラウンドタスク実装**
  - `services/background_tasks.py`
  - `transcribe_background()`, `analyze_background()`
- ✅ **POST /api/transcribe 非同期化**
  - 202 Accepted を即座に返す
  - バックグラウンドで処理 → SQS送信
- ✅ **POST /api/analyze 非同期化**
  - 202 Accepted を即座に返す
  - バックグラウンドでLLM分析

---

## ⚠️ 重要な問題発見：環境変数の管理方法が既存WatchMeと不一致

### 問題点

**今回の実装（不適切）**:
- SQS URLを**GitHub Secretsに追加**
- 環境変数経由でコンテナに渡す
- `.github/workflows/deploy-to-ecr.yml` で環境変数設定
- `docker-compose.prod.yml` で環境変数マッピング

**既存WatchMeプロジェクトの方法（正しい）**:
- SQS URLを**コード内にデフォルト値として定義**
- GitHub Secretsは不要
- 環境変数を設定すれば上書き可能（柔軟性）

### 既存WatchMeの実装例

**audio-processor/lambda_function.py:8-11**:
```python
ASR_QUEUE_URL = os.environ.get('ASR_QUEUE_URL', 'https://sqs.ap-southeast-2.amazonaws.com/754724220380/watchme-asr-queue-v2.fifo')
SED_QUEUE_URL = os.environ.get('SED_QUEUE_URL', 'https://sqs.ap-southeast-2.amazonaws.com/754724220380/watchme-sed-queue-v2.fifo')
SER_QUEUE_URL = os.environ.get('SER_QUEUE_URL', 'https://sqs.ap-southeast-2.amazonaws.com/754724220380/watchme-ser-queue-v2.fifo')
```

**特徴**:
- ✅ デフォルト値として直接URLを記述
- ✅ GitHub Secretsは不要
- ✅ Lambda/EC2の環境変数設定も不要（デフォルト値で動作）
- ✅ 必要に応じて環境変数で上書き可能

### なぜ既存の方法が優れているか

| 項目 | GitHub Secrets方式（今回の実装） | デフォルト値方式（既存WatchMe） |
|------|--------------------------------|-------------------------------|
| **セキュリティ** | SQS URLは秘密情報ではない | 同左 |
| **一貫性** | ❌ 既存WatchMeと異なる | ✅ 既存WatchMeと同じ |
| **シンプルさ** | ❌ CI/CD設定が複雑化 | ✅ コードのみで完結 |
| **メンテナンス** | ❌ Secrets更新が必要 | ✅ コード修正のみ |
| **可読性** | ❌ URLがコードに見えない | ✅ コードで確認可能 |
| **トラブルシューティング** | ❌ Secrets設定ミスで動かない | ✅ デフォルト値で動作 |

---

## 🔧 次のセッションでの修正タスク

### 修正方針

**SQS URLをコード内にデフォルト値として定義し、GitHub Secretsを削除する**

### 修正箇所

#### 1. `app.py` の修正

**現在（問題あり）**:
```python
SQS_TRANSCRIPTION_QUEUE_URL = os.getenv("SQS_TRANSCRIPTION_QUEUE_URL")
SQS_ANALYSIS_QUEUE_URL = os.getenv("SQS_ANALYSIS_QUEUE_URL")
```

**修正後（推奨）**:
```python
SQS_TRANSCRIPTION_QUEUE_URL = os.getenv(
    "SQS_TRANSCRIPTION_QUEUE_URL",
    "https://sqs.ap-southeast-2.amazonaws.com/754724220380/business-transcription-completed-queue.fifo"
)
SQS_ANALYSIS_QUEUE_URL = os.getenv(
    "SQS_ANALYSIS_QUEUE_URL",
    "https://sqs.ap-southeast-2.amazonaws.com/754724220380/business-analysis-completed-queue.fifo"
)
```

#### 2. `docker-compose.prod.yml` から削除

```yaml
# 以下の2行を削除
- SQS_TRANSCRIPTION_QUEUE_URL=${SQS_TRANSCRIPTION_QUEUE_URL}
- SQS_ANALYSIS_QUEUE_URL=${SQS_ANALYSIS_QUEUE_URL}
```

#### 3. `.github/workflows/deploy-to-ecr.yml` から削除

```yaml
# env: セクションから削除
SQS_TRANSCRIPTION_QUEUE_URL: ${{ secrets.SQS_TRANSCRIPTION_QUEUE_URL }}
SQS_ANALYSIS_QUEUE_URL: ${{ secrets.SQS_ANALYSIS_QUEUE_URL }}

# .env作成スクリプトから削除
echo "SQS_TRANSCRIPTION_QUEUE_URL=${SQS_TRANSCRIPTION_QUEUE_URL}" >> .env
echo "SQS_ANALYSIS_QUEUE_URL=${SQS_ANALYSIS_QUEUE_URL}" >> .env
```

#### 4. GitHub Secrets から削除（オプション）

以下のSecretsは不要なため削除可能:
- `SQS_TRANSCRIPTION_QUEUE_URL`
- `SQS_ANALYSIS_QUEUE_URL`

---

## 📝 次のセッションでの実装手順

### ステップ1: コード修正

1. `app.py` でSQS URLをデフォルト値として定義
2. `docker-compose.prod.yml` からSQS環境変数を削除
3. `.github/workflows/deploy-to-ecr.yml` からSQS環境変数設定を削除

### ステップ2: デプロイ＆検証

```bash
# コミット＆プッシュ
git add backend/app.py backend/docker-compose.prod.yml .github/workflows/deploy-to-ecr.yml
git commit -m "refactor: use default values for SQS URLs (align with WatchMe architecture)"
git push origin main

# デプロイ完了後、動作確認
curl -X POST https://api.hey-watch.me/business/api/transcribe \
  -H "X-API-Token: watchme-b2b-poc-2025" \
  -H "Content-Type: application/json" \
  -d '{"session_id": "test-session-id"}'
# → 202 Accepted が返ればOK
```

### ステップ3: Lambda確認

```bash
# Lambdaログ確認
aws logs tail /aws/lambda/business-transcription-completed-handler --follow --region ap-southeast-2
```

---

## 🏗️ アーキテクチャ（最終形）

### 全体フロー

```
録音完了 → S3アップロード
  ↓
POST /api/transcribe → 202 Accepted（即座に返す）
  ↓
バックグラウンド処理（Speechmatics）
  ↓
DB更新（transcription保存）
  ↓
SQS送信（business-transcription-completed-queue.fifo）
  ↓
Lambda: business-transcription-completed-handler
  ↓
POST /api/analyze → 202 Accepted（即座に返す）
  ↓
バックグラウンド処理（GPT-4）
  ↓
DB更新（analysis_result保存）
  ↓
完了
```

### SQS URL の管理方法（既存WatchMeパターン）

**app.py**:
```python
# Default values (既存WatchMeと同じパターン)
SQS_TRANSCRIPTION_QUEUE_URL = os.getenv(
    "SQS_TRANSCRIPTION_QUEUE_URL",
    "https://sqs.ap-southeast-2.amazonaws.com/754724220380/business-transcription-completed-queue.fifo"
)
```

**利点**:
- ✅ コードで直接URLが確認可能
- ✅ GitHub Secrets不要（管理が簡単）
- ✅ CI/CD設定がシンプル
- ✅ デフォルト値で動作（トラブルシューティングが容易）
- ✅ 環境変数で上書き可能（柔軟性は維持）

---

## 🎯 WatchMeとの一貫性

| 項目 | WatchMe | Business API（修正後） |
|------|---------|----------------------|
| SQS URL管理 | コード内にデフォルト値 | ✅ コード内にデフォルト値 |
| GitHub Secrets | 不要 | ✅ 不要 |
| 並列処理 | 3つのAPI（ASR/SED/SER） | 1つ（ASRのみ） |
| 完了チェック | aggregator-checker | 不要（Lambdaが直接次実行） |
| トリガー | S3 Event | 手動（将来は自動化可能） |

---

## 📚 参考資料

- **既存WatchMeアーキテクチャ**: `/Users/kaya.matsumoto/projects/watchme/server-configs/docs/PROCESSING_ARCHITECTURE.md`
- **既存Lambda実装**: `/Users/kaya.matsumoto/projects/watchme/server-configs/production/lambda-functions/`
- **audio-processor実装例**: `watchme-audio-processor/lambda_function.py:8-11`

---

## ✅ 修正完了後のメリット

1. ✅ **既存WatchMeプロジェクトと完全に一貫**
2. ✅ **GitHub Secrets管理が不要**
3. ✅ **CI/CD設定がシンプル**
4. ✅ **コードでURLが確認可能**（可読性向上）
5. ✅ **トラブルシューティングが容易**（デフォルト値で動作）
6. ✅ **環境変数で上書き可能**（柔軟性は維持）

---

## 📊 現在の進捗

| フェーズ | 進捗 | 状態 |
|---------|------|------|
| 企画・設計 | 100% | ✅ 完了 |
| インフラ構築 | 100% | ✅ 完了 |
| バックエンドAPI | 100% | ✅ 完了（要修正） |
| **環境変数管理の修正** | **0%** | **🔴 次のタスク** |
| 本番環境テスト | 0% | ⏸️ 修正後に実施 |
| フロントエンド表示 | 0% | ⏸️ 未着手 |

**全体進捗**: 約55%（環境変数修正 → テスト → フロントエンド表示が残り）
