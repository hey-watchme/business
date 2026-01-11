# Testing Guide - Transcription API

最終更新: 2026-01-11

## 📋 概要

Deepgram最適化後のトランスクリプションAPIのテスト手順

## 🔧 事前準備

### 1. データベースマイグレーション

**Supabase Dashboard** で以下のSQLを実行:

```bash
# ファイルを開く
cat infrastructure/supabase/migrations/add_transcription_metadata.sql
```

実行先: https://supabase.com/dashboard/project/qvtlwotzuzbavrzqhyvt/editor

### 2. 環境変数確認

```bash
# ローカル（テスト用）
cat backend/.env

# 必須:
# DEEPGRAM_API_KEY=xxx
# SUPABASE_URL=https://qvtlwotzuzbavrzqhyvt.supabase.co
# SUPABASE_KEY=xxx
# API_TOKEN=watchme-b2b-poc-2025
```

## 🧪 テスト実行

### テストスクリプトで実行（推奨）

```bash
cd /Users/kaya.matsumoto/projects/watchme/business

# 抜粋版（30秒・推奨）
./test-transcription.sh section001_raw.wav

# フル版（15分）
./test-transcription.sh full_raw.wav
```

### 期待される出力

```json
{
  "success": true,
  "session_id": "xxx-xxx-xxx",
  "transcription": "こんにちは...",
  "processing_time": 2.5,
  "confidence": 0.95,
  "word_count": 350,
  "utterances": [
    {
      "start": 0.0,
      "end": 5.2,
      "confidence": 0.95,
      "transcript": "こんにちは、今日は良い天気ですね",
      "speaker": 0
    }
  ],
  "paragraphs": [
    {
      "start": 0.0,
      "end": 15.3,
      "transcript": "こんにちは、今日は良い天気ですね。そうですね、本当に気持ちいいです。"
    }
  ],
  "speaker_count": 2,
  "model": "nova-2",
  "message": "Transcription completed successfully"
}
```

### 手動テスト（curl）

```bash
API_URL="https://api.hey-watch.me/business"
API_TOKEN="watchme-b2b-poc-2025"

# 1. Upload
curl -X POST $API_URL/api/upload \
  -H "X-API-Token: $API_TOKEN" \
  -F "audio=@/tmp/section001_raw.wav;type=audio/wav" \
  -F "facility_id=00000000-0000-0000-0000-000000000001" \
  -F "child_id=00000000-0000-0000-0000-000000000002"

# 2. Transcribe
curl -X POST $API_URL/api/transcribe \
  -H "Content-Type: application/json" \
  -H "X-API-Token: $API_TOKEN" \
  -d '{"session_id": "YOUR_SESSION_ID"}' | jq '.'
```

## 📊 確認ポイント

### 1. レスポンス確認

- ✅ `utterances` が配列で返ってくる
- ✅ `paragraphs` が配列で返ってくる
- ✅ `speaker_count` が数値（0以上）
- ✅ `model` が "nova-2"

### 2. データベース確認

**Supabase Dashboard** > Table Editor > `business_interview_sessions`

- ✅ `transcription` カラムに文字起こし結果
- ✅ `transcription_metadata` カラムにJSONBデータ

```sql
SELECT
  id,
  transcription,
  transcription_metadata->>'speaker_count' as speaker_count,
  jsonb_array_length(transcription_metadata->'utterances') as utterance_count
FROM business_interview_sessions
ORDER BY created_at DESC
LIMIT 1;
```

### 3. パフォーマンス確認

- ✅ `processing_time` が10秒以内（30秒音源）
- ✅ エラーなく完了

## 🚀 デプロイ手順

### 1. コード検証

```bash
# 構文チェック
python3 -m py_compile backend/app.py
python3 -m py_compile backend/services/asr_provider.py

# エンコーディング確認
file backend/app.py
file backend/services/asr_provider.py
```

### 2. GitHub へプッシュ

```bash
git add .
git commit -m "feat: add Deepgram extended transcription data (utterances/paragraphs/speaker_count)"
git push origin main
```

### 3. GitHub Actions 確認

```bash
gh run list --limit 3
gh run watch  # リアルタイム監視
```

### 4. 本番環境で動作確認

```bash
# ヘルスチェック
curl https://api.hey-watch.me/business/health

# テストスクリプト実行
./test-transcription.sh section001_raw.wav
```

## 🔍 トラブルシューティング

### utterances が空配列

→ Deepgram が音声を検出できていない可能性
→ `no_speech_detected: true` になっているか確認

### speaker_count が 0

→ 話者分離に失敗（音声が短い/音質が悪い）
→ `diarize=True` が有効になっているか確認

### データベースエラー

→ マイグレーションSQL実行済みか確認
→ RLSポリシーを確認（POCはすべて許可設定）

## 📝 次のステップ

1. ✅ Deepgram 最適化完了
2. 🔄 Google STT / AWS Transcribe / Azure Speech の追加
3. 🔄 プロバイダー切り替え機能（ASR Provider Manager）
4. 🔄 コスト・精度・速度の比較レポート自動生成
