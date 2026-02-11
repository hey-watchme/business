# 個別支援計画 自動生成システム 技術仕様書

**最終更新**: 2026-02-11 JST
**対象プロジェクト**: WatchMe Business API
**システム状態**: Phase 0-3パイプライン完全稼働 ✅、Phase 2アノテーション方式転換完了 ✅、自動sync実装完了 ✅、手動入力対応 ✅、複数LLMモデル選択対応 ✅
**実装完了度**: 99% (Phase 2アノテーション方式転換完了、プロンプト保存フロー修正完了、タブUI実装完了)

---

## 📋 目次

1. [システム概要](#システム概要)
2. [処理フロー](#処理フロー)
3. [データベース設計](#データベース設計)
4. [Phase 0: 文字起こし](#phase-0-文字起こし)
5. [Phase 1: 事実抽出](#phase-1-事実抽出)
6. [Phase 2: 事実整理](#phase-2-事実整理)
7. [Phase 3: 個別支援計画生成](#phase-3-個別支援計画生成)
8. [Phase 4: UI表示](#phase-4-ui表示)
9. [自動sync処理](#自動sync処理)

---

## システム概要

### 目的

保護者ヒアリング音声から個別支援計画書を自動生成するシステム。

### 処理概要

```
録音（webm）
  → 文字起こし（Speechmatics、話者分離）
  → 事実抽出（LLM、12カテゴリ）
  → 事実整理（LLM、支援計画用に再分類）
  → 個別支援計画生成（LLM、5領域の支援項目）
  → 自動sync（business_support_plans へ同期）
  → タブUI表示（ホーム/アセスメント/Phase1/Phase2）
```

### 処理時間

| フェーズ | 処理時間 |
|---------|---------|
| Phase 0 | 約4.5分（47分音声の場合） |
| Phase 1 | 5-7秒 |
| Phase 2 | 6-7秒 |
| Phase 3 | 17秒 |
| 自動sync | <1秒 |
| **合計** | **約5分30秒** |

### 設計思想

**3段階パイプライン設計**:
- **Phase 1**: 事実抽出（推論・解釈ゼロ）→ ノイズ除外 + 12カテゴリの事実を抽出
- **Phase 2**: 事実アノテーション（原文保持 + 専門分析外付け）→ 氷山モデル背景分析・強みの活用可能性・優先度タグを付加
- **Phase 3**: 計画書生成（Phase 2の `annotated_facts_v1` を計画書フォーマットに翻訳）→ 目標・支援内容の策定

---

## 処理フロー

### 全体フロー

```
【Phase 0: 文字起こし】
録音アップロード (webm)
  ↓
S3保存 (s3://watchme-business/interviews/)
  ↓
Lambda: business-audio-upload-handler (S3イベント)
  ↓
Speechmatics Batch API (話者分離対応)
  ↓
transcription カラムに保存

【Phase 1: 事実抽出】
POST /api/analyze
  ↓
analyze_background() (バックグラウンドスレッド)
  ↓
OpenAI GPT-4o (事実のみ抽出、12カテゴリ)
  ↓
fact_extraction_result_v1 保存

【Phase 2: 事実アノテーション】
POST /api/structure-facts
  ↓
structure_facts_background()
  ↓
OpenAI GPT-4o (原文保持 + 専門分析外付け)
  ↓
fact_structuring_result_v1 保存 (annotated_facts_v1形式)

【Phase 3: 個別支援計画生成】
POST /api/assess
  ↓
assess_background()
  ↓
OpenAI GPT-4o (専門的判断、個別支援計画生成)
  ↓
assessment_result_v1 保存
  ↓
sync_assessment_to_support_plan() (自動実行)
  ↓
business_support_plans の xxx_ai_generated カラムに同期

【Phase 4: 管理画面表示】
business_support_plans から表示
  ↓
タブUI（ホーム/アセスメント/Phase1/Phase2）
  ↓
ユーザー編集 → xxx_user_edited カラムに保存
```

### ステータス遷移

```
uploaded → transcribing → transcribed → analyzing → analyzed → completed
```

---

## データベース設計

### business_interview_sessions テーブル

```sql
-- 基本情報
id                           UUID PRIMARY KEY
facility_id                  UUID NOT NULL
subject_id                   UUID NOT NULL
support_plan_id              UUID
s3_audio_path                TEXT
duration_seconds             INTEGER

-- Phase 0: 文字起こし
transcription                TEXT
transcription_metadata       JSONB

-- Phase 1: 事実抽出
fact_extraction_prompt_v1    TEXT
fact_extraction_result_v1    JSONB

-- Phase 2: 事実整理
fact_structuring_prompt_v1   TEXT
fact_structuring_result_v1   JSONB

-- Phase 3: 個別支援計画生成
assessment_prompt_v1         TEXT
assessment_result_v1         JSONB

-- 使用LLMモデル記録（2026-02-10追加）
model_used_phase1            TEXT  -- "provider/model" (e.g., "openai/gpt-4o")
model_used_phase2            TEXT
model_used_phase3            TEXT

-- ステータス管理
status                       TEXT DEFAULT 'recording'
error_message                TEXT

-- タイムスタンプ
recorded_at                  TIMESTAMPTZ
created_at                   TIMESTAMPTZ DEFAULT now()
updated_at                   TIMESTAMPTZ DEFAULT now()
```

### business_support_plans テーブル

**2カラム版管理構造**: AIが生成した内容（`xxx_ai_generated`）とユーザーが編集した内容（`xxx_user_edited`）を分離管理。

```sql
-- 基本情報
id UUID PRIMARY KEY
facility_id UUID NOT NULL
subject_id UUID
session_id UUID
title TEXT
status TEXT DEFAULT 'draft'

-- 本人の意向（2カラム版）
child_intention_ai_generated TEXT
child_intention_user_edited TEXT

-- 保護者の意向（2カラム版）
family_intention_ai_generated TEXT
family_intention_user_edited TEXT

-- 総合的な支援の方針（2カラム版）
general_policy_ai_generated TEXT
general_policy_user_edited TEXT

-- 主要アプローチ（2カラム版、JSONB）
key_approaches_ai_generated JSONB
key_approaches_user_edited JSONB

-- 連携事項（2カラム版）
collaboration_notes_ai_generated TEXT
collaboration_notes_user_edited TEXT

-- 長期目標（2カラム版）
long_term_goal_ai_generated TEXT
long_term_goal_user_edited TEXT
long_term_period_ai_generated TEXT
long_term_period_user_edited TEXT
long_term_rationale_ai_generated TEXT
long_term_rationale_user_edited TEXT

-- 短期目標（2カラム版、JSONB）
short_term_goals_ai_generated JSONB
short_term_goals_user_edited JSONB

-- 支援項目（2カラム版、JSONB）
support_items_ai_generated JSONB
support_items_user_edited JSONB

-- 家族支援（2カラム版、JSONB）
family_support_ai_generated JSONB
family_support_user_edited JSONB

-- 移行支援・地域連携（2カラム版、JSONB）
transition_support_ai_generated JSONB
transition_support_user_edited JSONB

-- タイムスタンプ
created_at TIMESTAMPTZ DEFAULT NOW()
updated_at TIMESTAMPTZ DEFAULT NOW()
```

---

## Phase 0: 文字起こし

### 概要

- **実装日**: 2026-01-13
- **状態**: ✅ 稼働中
- **ASRプロバイダー**: Speechmatics Batch API
- **特徴**: 話者分離対応（3名以上検出可能）
- **処理速度**: 30秒音声→約26秒、47分音声→約4.5分（10.6倍速）

### 出力

**transcription カラム**:
```
Speaker 1: こんにちは、本日はよろしくお願いします。
Speaker 2: よろしくお願いします。
...
```

**transcription_metadata カラム**:
```json
{
  "utterances": [...],
  "paragraphs": [...],
  "speaker_count": 2,
  "confidence": 0.95,
  "word_count": 1234,
  "model": "speechmatics-enhanced",
  "processing_time": 4.5
}
```

---

## Phase 1: 事実抽出

### 概要

- **実装日**: 2026-01-17（プロンプト改善: 2026-02-10、マルチモデル対応: 2026-02-10）
- **状態**: ✅ 稼働中
- **エンドポイント**: `POST /api/analyze`
- **使用モデル**: OpenAI gpt-4o（デフォルト）、GPT-5.2 / Gemini 3 Pro 選択可能
- **処理時間**: 5-7秒

### 責務

トランスクリプションから**支援の根拠となる事実**を12カテゴリに分類して抽出。

**プロンプト構造** (`build_fact_extraction_prompt()`):
- **Role**: 児童発達支援の専門アセスメント担当者
- **IGNORE（除外）**: 契約・事務・送迎・アプリ設定等のノイズを完全除外
- **MUST KEEP（抽出対象）**: 5領域（本人の特性・行動、対人関係・社会性、健康・生活習慣、本人の意向、保護者の意向・課題）
- **DO/DON'T**: 事実のみ抽出、推論・解釈禁止、場面情報（いつ・どこで）をセットで保持
- **迷ったら残す原則**: 判断に迷う発言は削除せず confidence: low で保持

### 出力構造

**fact_extraction_result_v1**:
```json
{
  "extraction_v1": {
    "basic_info": [...],
    "current_state": [...],
    "strengths": [...],
    "challenges": [...],
    "physical_sensory": [...],
    "medical_development": [...],
    "family_environment": [...],
    "parent_intentions": [...],
    "child_intentions": [...],
    "staff_notes": [...],
    "administrative_notes": [...],
    "unresolved_items": [...]
  }
}
```

### 実装ファイル

- `backend/app.py`: エンドポイント定義
- `backend/services/background_tasks.py`: `analyze_background()`
- `backend/services/prompts.py`: `build_fact_extraction_prompt()`
- `backend/services/llm_pipeline.py`: 共通処理

---

## Phase 2: 事実アノテーション（専門的分析の付加）

### 概要

- **実装日**: 2026-01-18（アノテーション方式への転換: 2026-02-11、プロンプト日本語化: 2026-02-11）
- **状態**: ✅ 稼働中
- **エンドポイント**: `POST /api/structure-facts`
- **使用モデル**: OpenAI gpt-4o（デフォルト）、GPT-5.2 / Gemini 3 Pro 選択可能
- **処理時間**: 6-7秒

### 責務

Phase 1で抽出された事実に対して、**原文を完全保持したまま**専門的な分析（氷山モデル背景分析・強みの活用可能性・優先度タグ）を外付けする。Phase 3の"下ごしらえ"を完成させる。

**アノテーション方式の特徴**:
- **原文保持**: Phase 1の `summary` を `original_fact` として完全コピー（要約・言い換え禁止）
- **1対1対応**: Phase 1のアイテム数 = Phase 2のアイテム数（情報の欠落なし）
- **専門分析の外付け**: `professional_analysis` フィールドで背景・強み・優先度を付加

**プロンプト構造** (`build_fact_structuring_prompt()`):
- **Role**: 児童発達支援の専門アセスメント担当者（アノテーター）
- **絶対ルール**: `original_fact` = Phase 1の `summary` の完全コピー
- **5領域分類**: 健康・生活、運動・感覚、認知・行動、言語・コミュニケーション、人間関係・社会性
- **場面（setting）タグ**: 「home」「school」「therapy」「general」
- **専門分析**:
  - `background`: 氷山モデル分析（行動の背景にある特性・ニーズ）
  - `strength_potential`: 強みの活用可能性（支援でどう活かせるか）
  - `priority`: 保護者の懸念に直結する場合は「high」
- **DON'T**: 事実の捏造禁止、目標・支援方法の記述禁止（Phase 3の責務）

### 出力構造

**fact_structuring_result_v1** (新形式: `annotated_facts_v1`):
```json
{
  "annotated_facts_v1": {
    "child_profile": {
      "name": "氏名",
      "age": 5,
      "birth_date": "YYYY-MM-DD",
      "gender": "性別",
      "diagnosis": ["診断名"],
      "school_name": "通園先名",
      "school_type": "園の種別"
    },
    "annotated_items": [
      {
        "source_category": "Phase 1のカテゴリキー (例: strengths, challenges)",
        "original_fact": "Phase 1の summary テキストをそのまま転記（完全一致必須）",
        "category": "social_communication | cognitive_behavior | health_daily_living | motor_sensory | language_communication",
        "setting": "home | school | therapy | general",
        "professional_analysis": {
          "background": "氷山モデル：この事実の背景にある特性・ニーズの分析",
          "strength_potential": "この事実を支援の中でどう強みとして活かせるか、または null",
          "priority": "high | normal"
        }
      }
    ],
    "parent_child_intentions": [
      {
        "speaker": "本人 | 保護者（父） | 保護者（母）",
        "original_intention": "Phase 1の summary テキストをそのまま転記",
        "priority": "high | normal"
      }
    ],
    "unresolved_items": [
      {
        "original_fact": "Phase 1の summary テキストをそのまま転記",
        "reason": "未解決の理由"
      }
    ]
  }
}
```

### 実装ファイル

- `backend/app.py`: エンドポイント定義
- `backend/services/background_tasks.py`: `structure_facts_background()`
- `backend/services/prompts.py`: `build_fact_structuring_prompt()` (日本語プロンプト)
- `frontend/src/components/Phase2Display.tsx`: 新構造 `annotated_facts_v1` 対応UI

---

## Phase 3: 個別支援計画生成

### 概要

- **実装日**: 2026-01-18（プロンプト改善: 2026-02-10、マルチモデル対応: 2026-02-10）
- **状態**: ✅ 稼働中（自動sync対応）
- **エンドポイント**: `POST /api/assess`
- **使用モデル**: OpenAI gpt-4o（デフォルト）、GPT-5.2 / Gemini 3 Pro 選択可能
- **処理時間**: 17秒
- **自動sync**: ✅ Phase 3完了後、自動的に `business_support_plans` に同期

### 責務

Phase 2でアノテーションされた事実（`annotated_facts_v1`）と専門分析（background, strength_potential, priority）を、**個別支援計画書のフォーマットに翻訳**する。

**プロンプト構造** (`build_assessment_prompt()`):
- **Role**: 児童発達支援管理責任者
- **Phase 2連携**:
  - `background` → 支援が必要な根拠
  - `strength_potential` → 具体的な支援方法の基盤
  - `priority: high` → 長期目標・支援方針の中心
  - `original_fact` → 個別性を担保するための具体的エピソード引用
- **計画生成のロジック**:
  1. 保護者の願い（parent_child_intentions）→ 長期目標の柱
  2. Phase 2の background を引用 → 「なぜこの目標が必要か」を説明
  3. strength_potential を変換 → 具体的な支援方法
  4. 5領域を網羅 → 各 support_item に領域ラベル
  5. priority: high のアイテムが計画の中心
- **氷山モデルに基づく支援設計**: 問題行動の制止ではなく背景ニーズへのアプローチ
- **執筆スタイル**: 到達目標（「〜ができる」）と支援者アクション（「〜を行う」「〜を促す」）を分離
- **DON'T**: Phase 2にない分析の捏造禁止、テンプレート的目標禁止、一般論補完禁止

### 出力構造

**assessment_result_v1**:
```json
{
  "assessment_v1": {
    "support_policy": {
      "child_understanding": "...",
      "key_approaches": [...],
      "collaboration_notes": "..."
    },
    "family_child_intentions": {
      "child": "...",
      "parents": "..."
    },
    "long_term_goal": {
      "goal": "...",
      "timeline": "12か月後",
      "rationale": "..."
    },
    "short_term_goals": [...],
    "support_items": [
      {
        "category": "運動・感覚",
        "target": "...",
        "methods": [...],
        "staff": "作業療法士、保育士",
        "timeline": "6か月後",
        "notes": "..."
      }
    ],
    "family_support": {...},
    "transition_support": {...}
  }
}
```

### 実装ファイル

- `backend/app.py`: エンドポイント定義
- `backend/services/background_tasks.py`: `assess_background()`, `sync_assessment_to_support_plan()`
- `backend/services/prompts.py`: `build_assessment_prompt()`

---

## Phase 4: UI表示

### 概要

- **実装日**: 2026-02-04（タブUI完成）、2026-02-10（手動入力機能追加、マルチモデル選択UI追加）
- **状態**: ✅ 稼働中
- **進捗**: 99%完了（タブ構造実装完了、手動入力機能実装完了、マルチモデル選択UI実装完了）

### UI構成

**タブ構造**:
1. **ホームタブ**: 個別支援計画書 Excel風UI（初期表示）
2. **アセスメントタブ**: セッション情報、トランスクリプション、手動入力
3. **Phase 1タブ**: 事実抽出結果（extraction_v1）
4. **Phase 2タブ**: 事実整理結果（fact_clusters_v1）

### 2カラム版管理

**EditableField コンポーネント**:
```typescript
const displayValue = value ?? aiValue ?? '';  // ユーザー編集値 > AI生成値 > 空文字
```

ユーザーが編集した内容は `xxx_user_edited` カラムに保存され、AI生成値（`xxx_ai_generated`）は保持されます。

### 手動入力機能（2026-02-10追加）

**目的**: 外部で行った面談のテキストを手動入力し、分析パイプライン（Phase 1-2-3）を途中から開始できる

**実装内容**:
- **バックエンド**: `POST /api/sessions/manual` エンドポイント追加
  - 音声なしでセッション作成（`s3_audio_path` は `NULL`）
  - `status` は `'transcribed'` で作成（Phase 1から開始可能）
- **フロントエンド**: アセスメントタブに「面談記録を手動入力」ボタン追加
  - セッションなし時: ボタンクリックで空セッション作成 → テキスト入力可能に
  - セッションあり + transcriptionなし: 常にtextareaを表示（入力可能）
- **UIデザイン統一**: Phase 1/2タブと同じカード型デザインに統一
- **フィードバック改善**: alert()廃止 → インライン表示（保存完了チェックマーク、分析進捗表示）

---

## 自動sync処理

### 概要（2026-02-04追加）

Phase 3完了後、`assessment_result_v1` の内容が自動的に `business_support_plans` テーブルの `xxx_ai_generated` カラムに同期されます。

### マッピング

| assessment_v1 | business_support_plans |
|---------------|------------------------|
| `family_child_intentions.child` | `child_intention_ai_generated` |
| `family_child_intentions.parents` | `family_intention_ai_generated` |
| `support_policy.child_understanding` | `general_policy_ai_generated` |
| `support_policy.key_approaches` | `key_approaches_ai_generated` |
| `support_policy.collaboration_notes` | `collaboration_notes_ai_generated` |
| `long_term_goal.goal` | `long_term_goal_ai_generated` |
| `long_term_goal.timeline` | `long_term_period_ai_generated` |
| `long_term_goal.rationale` | `long_term_rationale_ai_generated` |
| `short_term_goals` | `short_term_goals_ai_generated` |
| `support_items` | `support_items_ai_generated` |
| `family_support` | `family_support_ai_generated` |
| `transition_support` | `transition_support_ai_generated` |

### 実装

- **関数**: `sync_assessment_to_support_plan()` in `background_tasks.py`
- **呼び出し**: `assess_background()` 完了後に自動実行
- **エラーハンドリング**: 失敗してもPhase 3全体は失敗しない（警告ログのみ）

---

## マルチモデル対応（2026-02-10追加）

### 概要

Phase 1-3 の LLM 分析で、複数のモデルを選択可能。自動実行（Lambda経由）はデフォルトモデルを使用し、UI からの手動実行時にモデルを切り替え可能。

### 対応モデル

| プロバイダー | モデル | 用途 |
|------------|--------|------|
| **OpenAI** | `gpt-4o`（デフォルト） | 標準分析 |
| **OpenAI** | `gpt-5.2-2025-12-11` | 高品質検証 |
| **OpenAI** | `gpt-4o-mini` | 低コストテスト |
| **Google** | `gemini-3-pro-preview` | 比較検証 |
| **Google** | `gemini-2.0-flash-exp` | 高速テスト |

### 実行パターン

| 実行方法 | モデル選択 | 動作 |
|---------|----------|------|
| **全Phase一括実行** | モーダルで選択 | Phase 1→2→3 を同一モデルで順次実行 |
| **Phase Xのみ再実行** | タブ内ドロップダウン | 該当Phaseのみ実行 |
| **Lambda自動実行** | デフォルト（`gpt-4o`） | 環境変数 `LLM_DEFAULT_MODEL` で設定 |

### APIパラメータ

```json
POST /api/analyze
{
  "session_id": "uuid",
  "use_custom_prompt": false,
  "provider": "openai",
  "model": "gpt-5.2-2025-12-11"
}
```

`provider` / `model` を省略するとデフォルト（`LLM_DEFAULT_PROVIDER` / `LLM_DEFAULT_MODEL`）が使用される。

### モデル記録

使用モデルは `business_interview_sessions` テーブルの `model_used_phase1/2/3` カラムに `"provider/model"` 形式で記録。

### 実装ファイル

- `backend/services/llm_providers.py`: `LLMFactory.create()`, `OpenAIProvider`, `GeminiProvider`
- `backend/app.py`: `AnalyzeRequest.provider/model`, 各エンドポイントでモデル生成
- `frontend/src/pages/SupportPlanCreate.tsx`: モデル選択モーダル、Phase タブ内ドロップダウン

---

## 関連ドキュメント

- [実装ガイド](./INDIVIDUAL_SUPPORT_PLAN_IMPLEMENTATION.md) - 共通実装パターン、テスト方法、LLM管理
- [変更履歴](./INDIVIDUAL_SUPPORT_PLAN_CHANGELOG.md) - 改訂履歴、今後の実装計画
- [認証設計](./AUTHENTICATION_DESIGN.md) - Organization/Facility設計、認証体系
- [アーキテクチャ](./ARCHITECTURE.md) - システム全体のアーキテクチャ
- [テストガイド](./TESTING_GUIDE.md) - テスト方法（⚠️ 一部古い内容含む）
