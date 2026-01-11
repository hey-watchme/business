# 次のセッション用メモ

最終更新: 2026-01-11

## ✅ 完了済み

### Step 1: 録音機能
- ✅ 録音 → S3アップロード → DB保存
- ✅ CORS問題解決

### Step 2: 文字起こし機能（同期型・暫定実装）
- ✅ POST /api/transcribe 実装（同期型）
- ✅ Deepgram Nova-2統合
- ✅ テスト成功：「えっと、もう一回テストしましょう。」
- ✅ 処理時間: 1.23秒、信頼度: 99%
- ⚠️ **問題**: 15分の音声はタイムアウトする

---

## 🚀 次の実装: Step 2.5 + Step 3 - 非同期処理への移行

**実装計画書**: `/Users/kaya.matsumoto/projects/watchme/business/ASYNC_PROCESSING_PLAN.md`

### 🎯 なぜ非同期処理が必要か

#### 現在の問題
```
POST /api/transcribe（同期型）
  ↓ 15分の音声処理中...
  ↓ タイムアウト（Nginx: 180秒）❌
```

#### 解決策：WatchMeパターン（Lambda/SQS）
```
POST /api/transcribe → 202 Accepted（即座に返す）
  ↓
バックグラウンド処理（15分でもOK）
  ↓ 完了
SQS通知 → Lambda → 次の処理（自動）
```

**メリット**:
- ✅ タイムアウトなし
- ✅ フロントエンドに依存しない
- ✅ 確実に次の処理へ進む
- ✅ リトライ機能あり

---

## 🏗️ 実装するアーキテクチャ（WatchMeパターン）

### 全体フロー

```
1. 録音完了 → S3アップロード
   ↓
2. POST /api/transcribe → 202 Accepted
   - status: 'processing'
   - バックグラウンドで処理開始
   ↓
3. 文字起こし完了（15分後でもOK）
   - DB更新: transcription保存
   - SQS送信: business-transcription-completed-queue
   ↓
4. Lambda: business-transcription-completed-handler
   - SQSから通知受信
   - POST /api/analyze 実行
   ↓
5. 分析完了
   - DB更新: analysis_result保存
   - （完了）
```

### 必要なコンポーネント

#### 1. SQSキュー（2つ）
- `business-transcription-completed-queue`
- `business-analysis-completed-queue`

#### 2. Lambda関数（2つ）
- `business-transcription-completed-handler`
- `business-analysis-completed-handler`

#### 3. API修正
- POST /api/transcribe → 非同期化（202 Accepted）
- POST /api/analyze → 非同期化（202 Accepted）

---

## 📊 進捗状況

| フェーズ | 進捗 | 状態 |
|---------|------|------|
| 企画・設計 | 100% | ✅ 完了 |
| インフラ構築 | 100% | ✅ 完了 |
| バックエンドAPI | 100% | ✅ 完了 |
| フロントエンド構築 | 100% | ✅ 完了 |
| **Step 1: 録音→S3→DB** | **100%** | **✅ 完了** |
| **Step 2: Transcription（同期）** | **100%** | **✅ 完了** |
| **Step 2.5: 非同期処理移行** | **0%** | **🚧 次のタスク** |
| **Step 3: LLM分析** | **0%** | **🚧 次のタスク** |
| Step 4: UI表示 | 0% | ⏸️ 未着手 |
| Step 5: Excel/PDF出力 | 0% | ⏸️ 未着手 |

**全体進捗**: 約50%（非同期処理への移行から実装開始）

---

## 💡 次のセッションの最初のアクション

### 1. 実装計画書を確認
```bash
cat /Users/kaya.matsumoto/projects/watchme/business/ASYNC_PROCESSING_PLAN.md
```

### 2. ステップバイステップで実装

#### Phase 1: SQSキュー作成
```bash
aws sqs create-queue \
  --queue-name business-transcription-completed-queue \
  --region ap-southeast-2

aws sqs create-queue \
  --queue-name business-analysis-completed-queue \
  --region ap-southeast-2
```

#### Phase 2: Lambda関数作成
- `business-transcription-completed-handler`
- `business-analysis-completed-handler`

#### Phase 3: API非同期化
- POST /api/transcribe を非同期処理に修正
- POST /api/analyze を実装（非同期）

#### Phase 4: DBカラム追加
```sql
ALTER TABLE business_interview_sessions
ADD COLUMN analysis_prompt TEXT,
ADD COLUMN analysis_result JSONB;
```

---

## 📝 重要な学び（今回のセッション）

### 堅牢なシステムには非同期処理が必須
- 同期型: タイムアウトリスク、フロントエンド依存
- 非同期型（Lambda/SQS）: 確実、タイムアウトなし、自動進行

### WatchMeパターンの適用
- 既存の実績あるアーキテクチャをそのまま使う
- 段階的実装は非効率 → 最初から堅牢に作る

---

## 🔗 参考リンク

- **実装計画書（非同期処理）**: `/Users/kaya.matsumoto/projects/watchme/business/ASYNC_PROCESSING_PLAN.md`
- **WatchMeアーキテクチャ**: `/Users/kaya.matsumoto/projects/watchme/server-configs/docs/PROCESSING_ARCHITECTURE.md`
- **Supabase**: https://supabase.com/dashboard/project/qvtlwotzuzbavrzqhyvt
- **GitHub Actions**: https://github.com/hey-watchme/business/actions
- **AWS Console**: https://ap-southeast-2.console.aws.amazon.com/

---

## 🔮 最終的なアーキテクチャ

```
録音 → S3
  ↓ （将来：S3 Event → Lambda）
フロントエンド → POST /api/transcribe → 202 Accepted
  ↓ バックグラウンド処理
  ↓ 完了 → SQS通知
Lambda → POST /api/analyze → 202 Accepted
  ↓ バックグラウンド処理
  ↓ 完了
結果保存 → フロントエンドで表示
```

堅牢で、スケーラブルで、確実なシステム。
