# 個別支援計画 自動生成システム 技術仕様書

**最終更新**: 2026-01-30 21:30 JST
**対象プロジェクト**: WatchMe Business API
**システム状態**: Phase 0-4 稼働中、認証Phase B完了 ✅
**実装完了度**: 80% (Phase 0-4完了、認証Phase B完了、Phase C-D未実装)

---

## 📋 目次

1. [システム概要](#システム概要)
2. [処理フロー](#処理フロー)
3. [データベース設計](#データベース設計)
4. [Phase 0: 文字起こし](#phase-0-文字起こし)
5. [Phase 1: 事実抽出](#phase-1-事実抽出)
6. [Phase 2: 事実整理](#phase-2-事実整理)
7. [Phase 3: 個別支援計画生成](#phase-3-個別支援計画生成)
8. [Phase 4: Excel/UI出力](#phase-4-excelui出力)
9. [共通実装パターン](#共通実装パターン)
10. [LLMモデル管理](#llmモデル管理)
11. [テスト方法](#テスト方法)
12. [今後の実装計画](#今後の実装計画)
13. [認証設計](#認証設計)

---

## システム概要

### 目的

保護者ヒアリング音声から個別支援計画書を自動生成するシステム。

### 処理概要

```
録音（webm）
  → 文字起こし（Speechmatics、話者分離）
  → 事実抽出（LLM、11カテゴリ）
  → 事実整理（LLM、支援計画用に再分類）
  → 個別支援計画生成（LLM、5領域の支援項目）
  → 管理画面表示（構造化UI）
  → Excel出力（2シート）
```

### 処理時間

| フェーズ | 処理時間 |
|---------|---------|
| Phase 0 | 約4.5分（47分音声の場合） |
| Phase 1 | 5-7秒 |
| Phase 2 | 6-7秒 |
| Phase 3 | 17秒 |
| Phase 4 | <1秒（Excel生成） |
| **合計** | **約5分30秒** |

### 設計思想

**3段階パイプライン設計**:

- **Phase 1-2**: 事実のみ（推論・解釈ゼロ）→ 自動化可能
- **Phase 3**: 専門的判断（解釈・評価・創造）→ 現在は自動化、将来的にHuman in the Loop想定

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
OpenAI GPT-4o (事実のみ抽出、11カテゴリ)
  ↓
fact_extraction_result_v1 (extraction_v1) 保存

【Phase 2: 事実整理】
POST /api/structure-facts
  ↓
structure_facts_background()
  ↓
OpenAI GPT-4o (支援計画用に再分類)
  ↓
fact_structuring_result_v1 (fact_clusters_v1) 保存

【Phase 3: 個別支援計画生成】
POST /api/assess
  ↓
assess_background()
  ↓
OpenAI GPT-4o (専門的判断、個別支援計画生成)
  ↓
assessment_result_v1 (assessment_v1) 保存
```

### ステータス遷移

```
uploaded → transcribing → transcribed → analyzing → analyzed → completed
```

---

## データベース設計

### business_interview_sessions テーブル

**最終確認**: 2026-01-18

```sql
-- 基本情報
id                           UUID PRIMARY KEY
facility_id                  UUID NOT NULL
subject_id                   UUID NOT NULL
support_plan_id              UUID
s3_audio_path                TEXT
staff_id                     UUID
session_type                 TEXT
session_number               INTEGER
attendees                    JSONB
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

-- ステータス管理
status                       TEXT DEFAULT 'recording'
error_message                TEXT

-- タイムスタンプ
recorded_at                  TIMESTAMPTZ
created_at                   TIMESTAMPTZ DEFAULT now()
updated_at                   TIMESTAMPTZ DEFAULT now()
```

---

## Phase 0: 文字起こし

### 概要

- **実装日**: 2026-01-13
- **状態**: ✅ 稼働中
- **ASRプロバイダー**: Speechmatics Batch API
- **特徴**: 話者分離対応（3名以上検出可能）

### データフロー

```
録音アップロード → S3 → Lambda → Speechmatics → DB保存
```

### 処理速度

- 30秒音声: 約26秒（ほぼリアルタイム）
- 47分音声: 約4.5分（**10.6倍速**）

### 出力

**transcription カラム**:
```
Speaker 1: こんにちは、本日はよろしくお願いします。
Speaker 2: よろしくお願いします。
...
```

---

## Phase 1: 事実抽出

### 概要

- **実装日**: 2026-01-17
- **状態**: ✅ 稼働中
- **エンドポイント**: `POST /api/analyze`
- **使用モデル**: OpenAI gpt-4o
- **処理時間**: 5-7秒

### 責務

ヒアリング文字起こしから**事実のみを抽出**する。

**DO**:
- 発言された内容を11カテゴリに分類
- 事実の要約（summary）
- 信頼度（confidence）の付与

**DON'T**:
- 推論・解釈（「〜と考えられる」「〜の可能性」）
- 因果関係の付与
- 専門的判断

### 出力構造

**fact_extraction_result_v1**:
```json
{
  "extraction_v1": {
    "basic_info": [
      {"field": "氏名", "value": "松本正弦", "confidence": "high"}
    ],
    "current_state": [...],
    "strengths": [...],
    "challenges": [...],
    "physical_sensory": [...],
    "medical_development": [...],
    "family_environment": [...],
    "parent_intentions": [
      {"summary": "楽しく遊びたい", "priority": 1, "confidence": "high"}
    ],
    "staff_notes": [...],
    "administrative_notes": [...],
    "unresolved_items": [...]
  }
}
```

### 実装ファイル

- `backend/app.py`: エンドポイント定義
- `backend/services/background_tasks.py`: `analyze_background()`
- `backend/services/prompts.py`: プロンプト（Phase 1は直接埋め込み）

---

## Phase 2: 事実整理

### 概要

- **実装日**: 2026-01-18
- **状態**: ✅ 稼働中
- **エンドポイント**: `POST /api/structure-facts`
- **使用モデル**: OpenAI gpt-4o
- **処理時間**: 6-7秒

### 責務

extraction_v1を**支援計画用に再分類**する。

**Phase 2の役割**:
> 「判断をしない代わりに、判断しやすさを最大化する工程」

**DO**:
- Phase 1の11カテゴリを支援計画用の領域に再配置
- 文脈的に近い事実を束ねる
- Phase 3が参照しやすい"判断材料セット"を作る

**DON'T**:
- 解釈・評価（「〜が必要」「〜が課題」）
- 因果関係の作成
- 事実の過度な要約（情報量を減らさない）

### 出力構造

**fact_structuring_result_v1**:
```json
{
  "fact_clusters_v1": {
    "child_profile": {
      "name": "string",
      "age": number,
      "diagnosis": ["string"],
      "school_name": "string"
    },
    "strengths_facts": [...],
    "challenges_facts": [...],
    "cognitive_facts": [...],
    "behavior_facts": [...],
    "social_communication_facts": [...],
    "physical_sensory_facts": [...],
    "daily_living_facts": [...],
    "medical_facts": [...],
    "family_context": [...],
    "parent_child_intentions": [
      {"speaker": "本人", "intention": "...", "priority": 1}
    ],
    "service_administrative_facts": [...]
  }
}
```

### キー設計の意図

- `strengths_facts` / `challenges_facts` → 目標設定用
- `cognitive_facts` / `behavior_facts` → 支援計画用
- `parent_child_intentions` → 本人・保護者の希望

### 実装ファイル

- `backend/app.py`: エンドポイント定義
- `backend/services/background_tasks.py`: `structure_facts_background()` (約30行)
- `backend/services/prompts.py`: `build_fact_structuring_prompt()`
- `backend/services/llm_pipeline.py`: 共通処理（`execute_llm_phase()`）

---

## Phase 3: 個別支援計画生成

### 概要

- **実装日**: 2026-01-18
- **状態**: ✅ 稼働中
- **エンドポイント**: `POST /api/assess`
- **使用モデル**: OpenAI gpt-4o
- **処理時間**: 17秒

### 責務

fact_clusters_v1から**個別支援計画書**を生成する。

**Phase 3で初めて許可されること**:
- 解釈・評価（「〜と見立てています」「〜が必要である」）
- 因果関係の推論
- 専門家視点での判断

### 出力構造

**assessment_result_v1**:
```json
{
  "assessment_v1": {
    "support_policy": {
      "child_understanding": "子どもの理解・見立て（200-400文字）",
      "key_approaches": [
        "視覚的スケジュールの活用",
        "事前説明の徹底"
      ],
      "collaboration_notes": "保育園との情報共有、訪問連携"
    },
    "family_child_intentions": {
      "child": "楽しく遊びたい（本人）",
      "parents": "場面に合った行動を..."
    },
    "long_term_goal": {
      "goal": "視覚的なスケジュールを手掛かりに...",
      "timeline": "6か月後",
      "rationale": "本人の視覚優位な特性を活かし..."
    },
    "short_term_goals": [
      {
        "goal": "見える化された手順やスケジュールを...",
        "timeline": "3か月後"
      }
    ],
    "support_items": [
      {
        "category": "運動・感覚",
        "target": "「どうぞ」と言われてから活動に...",
        "methods": [
          "活動前に全体を指差しする等を行い...",
          "手の平、足の裏、お尻等体を支えたり..."
        ],
        "staff": "作業療法士、保育士",
        "timeline": "6か月後",
        "notes": "専門的支援実施加算については、別紙参照",
        "priority": 2
      }
    ],
    "family_support": {
      "goal": "日常生活において、本人の意思を...",
      "methods": [...],
      "timeline": "6か月後",
      "notes": "子育てサポート加算：月1回..."
    },
    "transition_support": {
      "goal": "日常的な連携に加え、特に行事等の際には...",
      "methods": [...],
      "partner_organization": "〇〇保育園",
      "timeline": "6か月後",
      "notes": "保護者の意向も確認しながら..."
    }
  }
}
```

### 5領域カバレッジ

児童発達支援の5領域を必ずカバー：

1. 健康・生活
2. 運動・感覚
3. 認知・行動
4. 言語・コミュニケーション
5. 人間関係・社会性

### 実装ファイル

- `backend/app.py`: エンドポイント定義
- `backend/services/background_tasks.py`: `assess_background()` (約30行)
- `backend/services/prompts.py`: `build_assessment_prompt()`
- `backend/services/llm_pipeline.py`: 共通処理（`execute_llm_phase()`）

---

## Phase 4: Excel/UI出力

### 概要

- **実装日**: 2026-01-30（UI 2ページ目追加）
- **状態**: ✅ 稼働中（UI完了、データ連携は一部TODO）
- **進捗**: 85%完了

### 個別支援計画書 2ページ構成

個別支援計画書は **2ページ構成** の公文書形式で実装：

| ページ | 内容 | 実装状態 |
|-------|------|---------|
| 1/2ページ | 計画書ヘッダー、児童情報、意向、支援方針 | ✅ 完了 |
| 2/2ページ | 支援詳細テーブル（7列）、説明・同意欄 | ✅ 完了 |

---

### UI実装

#### ページ1/2: 計画書ヘッダー・支援方針

**ファイル**: `frontend/src/pages/SupportPlanCreate.tsx`

**表示項目**:
- ヘッダー情報
  - 計画作成日
  - 事業所名（⚠️ 要実装：認証から取得）
  - 計画作成者（⚠️ 要実装：児発管ログイン情報から取得）
  - モニタリング予定時期
- 児童情報
  - 児童名、年齢
  - 障害種別、障害支援区分
  - 保護者氏名、相談支援事業所
- 利用者及びその家族の生活に対する意向・ニーズ
  - 本人の意向
  - 保護者の意向
- 支援方針
  - 子どもの理解・見立て
  - 主要アプローチ
  - 連携事項
- 目標設定
  - 長期目標
  - 短期目標
- 支援項目（5領域）
  - 健康・生活
  - 運動・感覚
  - 認知・行動
  - 言語・コミュニケーション
  - 人間関係・社会性
- 家族支援
- 移行支援・地域連携

#### ページ2/2: 支援詳細テーブル・同意欄

**ファイル**: `frontend/src/pages/SupportPlanCreate.tsx`

**7列テーブル構造**:

| 列 | 内容 | データソース |
|----|------|-------------|
| 項目 | 支援領域（5領域から） | LLM Phase 3 |
| 具体的な到達目標 | 短期目標の詳細化 | LLM Phase 3 |
| 具体的な支援内容・5領域との関係性等 | 支援方法と領域マッピング | LLM Phase 3 |
| 達成時期 | 目標達成予定 | 手動入力 / LLM |
| 担当者・提供期間 | 児発管/職員、実施期間 | 認証から取得 |
| 留意事項 | 注意点・配慮事項 | LLM Phase 3 |
| 優先順位 | 1-5の優先度 | 手動入力 |

**5領域の説明テキスト**:
```
「5領域」は、児童発達支援・放課後等デイサービスにおける
発達支援の重要な視点となる5つの領域です。
```

**説明・同意セクション**:
- 同意文言: 「提供する支援内容について、本計画書に基づき説明を受け、内容に同意しました。」
- 署名欄テーブル:
  - 説明者（空欄）
  - 説明・同意日（空欄）
  - 保護者氏名（空欄）

**CSSクラス**:
- `.support-details-table`: 7列テーブルスタイル
- `.support-details-wrapper`: 横スクロール対応ラッパー
- `.official-document-header`: A4公文書スタイル

---

### Excel出力仕様

#### ファイル構成

**2シート構成**:

1. **Sheet 1（メイン）**: 個別支援計画書本体
2. **Sheet 2（別表）**: 個別支援計画書別表（週間スケジュール等）

#### Sheet 1: 個別支援計画書（メイン）
- 児童プロフィール（氏名・年齢）
- 計画作成日
- 本人・保護者の意向
- 子どもの理解・見立て
- 主要アプローチ
- 連携事項
- 長期目標
- 短期目標
- 支援項目（5領域）
- 家族支援
- 移行支援・地域連携

#### Sheet 2: 別紙1-2（個別支援計画書別表）
- 週間スケジュール（月〜日・祝日）
- 提供時間（利用開始・終了時間）
- 延長支援時間
- 延長を必要とする理由
- 特記事項

### 実装ファイル

**バックエンド**:
- `backend/services/excel_generator.py`: Excel生成ロジック
  - `generate_support_plan_excel()`: メイン関数
  - `generate_main_support_plan()`: Sheet 1生成
  - `generate_support_schedule()`: Sheet 2生成
  - `extract_assessment_v1()`: データ抽出（ラップされたJSON対応）
- `backend/app.py`: ダウンロードエンドポイント

**フロントエンド**:
- `frontend/src/pages/SupportPlanCreate.tsx`: 2ページ構成の計画書UI
- `frontend/src/pages/SupportPlanCreate.css`: 公文書スタイルCSS
- `frontend/src/components/Phase3Display.tsx`: ダウンロードボタンUI

### API仕様

**エンドポイント**: `GET /api/sessions/{session_id}/download-excel`

**レスポンス**:
- Content-Type: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- ファイル名: `個別支援計画_{session_id}.xlsx`

### データ取得優先順位

1. **subjectsテーブル**（児童名・年齢）
2. **assessment_v1.child_profile**（フォールバック）
3. **デフォルト値**（〇〇 〇〇、5歳）

---

## LLM結果の表示コンポーネント

### 概要

- **実装日**: 2026-01-19
- **状態**: ✅ 稼働中
- **ページ**: セッション詳細ドロワー

### 実装コンポーネント

#### Phase1Display.tsx
- 11カテゴリの事実抽出結果を構造化表示
- 信頼度バッジ（high/medium/low）
- 優先度表示

#### Phase2Display.tsx
- 11カテゴリの事実整理結果を構造化表示
- 児童プロフィール
- カラーコード（強み=緑、課題=黄色）
- 本人・保護者の意向（話者別）

#### Phase3Display.tsx
- 個別支援計画の全セクション表示
- 支援方針（子どもの理解・見立て、主要アプローチ、連携事項）
- 長期目標・短期目標
- 支援項目（5領域）
- 家族支援
- 移行支援・地域連携
- **Excelダウンロードボタン**

### データ抽出処理

各コンポーネントで`{"summary": "```json\n{...}\n```"}`形式のラップされたJSONに対応：

```typescript
// Handle wrapped JSON format
if (!extraction && (data as any).summary) {
  const jsonMatch = summaryText.match(/```json\s*\n([\s\S]*?)\n```/);
  if (jsonMatch) {
    const parsed = JSON.parse(jsonMatch[1]);
    extraction = parsed.extraction_v1;
  }
}
```

---

## 共通実装パターン

### 設計原則

**DRY原則に基づく統一パターン**（2026-01-18策定）

すべてのフェーズ（Phase 1-3）は以下のパターンに従う：

1. **共通LLMパイプライン**を使用（`llm_pipeline.py`）
2. **バックグラウンド関数は約30行**（`execute_llm_phase()`を呼ぶだけ）
3. **エンドポイントは統一パターン**（検証 → スレッド起動 → 202返却）

### 共通処理フロー

```python
# backend/services/llm_pipeline.py
def execute_llm_phase(
    session_id,
    supabase,
    llm_service,
    phase_name,
    prompt_builder,
    input_selector,
    output_column,
    prompt_column
):
    """
    統一LLMパイプライン

    1. DB.select() - 前フェーズ結果取得
    2. プロンプト生成
    3. プロンプトDB保存
    4. LLM呼び出し
    5. JSON parse（柔軟対応）
    6. 結果DB保存
    """
```

### バックグラウンド関数の実装例

```python
def structure_facts_background(session_id, supabase, llm_service):
    """Phase 2: 事実整理"""
    execute_llm_phase(
        session_id=session_id,
        supabase=supabase,
        llm_service=llm_service,
        phase_name="fact_structuring",
        prompt_builder=build_fact_structuring_prompt,
        input_selector="fact_extraction_result_v1",
        output_column="fact_structuring_result_v1",
        prompt_column="fact_structuring_prompt_v1"
    )
```

**実装行数**: 約30行（Phase 1, 2, 3すべて）

### エンドポイントの統一パターン

```python
@app.post("/api/{phase}")
async def {phase}(request, x_api_token):
    # 1. トークン検証
    # 2. 前提条件チェック（前フェーズ結果存在）
    # 3. バックグラウンドスレッド起動
    # 4. 即座に202 Accepted返却
```

---

## LLMモデル管理

### 現在の設定

**ファイル**: `backend/services/llm_providers.py`

```python
CURRENT_PROVIDER = "openai"
CURRENT_MODEL = "gpt-4o"
```

### フェーズ別使用モデル

| フェーズ | エンドポイント | 関数名 | モデル | プロバイダー |
|---------|--------------|--------|--------|------------|
| Phase 1 | POST /api/analyze | `analyze_background()` | gpt-4o | OpenAI |
| Phase 2 | POST /api/structure-facts | `structure_facts_background()` | gpt-4o | OpenAI |
| Phase 3 | POST /api/assess | `assess_background()` | gpt-4o | OpenAI |

### コスト試算（1セッションあたり）

| フェーズ | 入力トークン | 出力トークン | コスト |
|---------|------------|------------|--------|
| Phase 1 | 15,000 | 2,000 | $0.10 |
| Phase 2 | 2,500 | 1,500 | $0.03 |
| Phase 3 | 2,000 | 3,000 | $0.05 |
| **合計** | **19,500** | **6,500** | **$0.18** |

### モデル切り替え方法

1. `llm_providers.py`の定数を変更
2. コミット・プッシュ
3. GitHub Actions自動デプロイ（約7分）

---

## テスト方法

### 標準テストデータ

**session_id**: `a522ab30-77ca-4599-81b8-48bc8deca835`

- 対象: 松本正弦（5歳、ASD、境界知能 IQ81、白幡幼稚園）
- 文字起こし: 15,255語
- 参加者: 父・母
- 録音日: 2026-01-13

### フルパイプラインテスト

```bash
# Phase 1: 事実抽出
curl -X POST https://api.hey-watch.me/business/api/analyze \
  -H "X-API-Token: watchme-b2b-poc-2025" \
  -H "Content-Type: application/json" \
  -d '{"session_id": "a522ab30-77ca-4599-81b8-48bc8deca835"}'

# Phase 2: 事実整理
curl -X POST https://api.hey-watch.me/business/api/structure-facts \
  -H "X-API-Token: watchme-b2b-poc-2025" \
  -H "Content-Type: application/json" \
  -d '{"session_id": "a522ab30-77ca-4599-81b8-48bc8deca835"}'

# Phase 3: 個別支援計画生成
curl -X POST https://api.hey-watch.me/business/api/assess \
  -H "X-API-Token: watchme-b2b-poc-2025" \
  -H "Content-Type: application/json" \
  -d '{"session_id": "a522ab30-77ca-4599-81b8-48bc8deca835"}'
```

### 結果確認（Supabase SQL Editor）

```sql
SELECT
    fact_extraction_result_v1 IS NOT NULL as has_phase1,
    fact_structuring_result_v1 IS NOT NULL as has_phase2,
    assessment_result_v1 IS NOT NULL as has_phase3,
    updated_at
FROM business_interview_sessions
WHERE id = 'a522ab30-77ca-4599-81b8-48bc8deca835';
```

---

## 参考資料

- リタリコ個別支援計画書様式: `/Users/kaya.matsumoto/projects/watchme/docs/個別支援計画/個別支援計画書（参考記載例）リタリコ.pdf`
- テストデータ: `/Users/kaya.matsumoto/Desktop/business_interview_sessions_rows.csv`

---

## 今後の実装計画

### 優先度順タスクリスト

| 優先度 | タスク | 影響範囲 | 見積もり |
|-------|--------|---------|---------|
| 1 | 認証システム実装 | 全画面 | 中 |
| 2 | 事業所名の自動取得 | 計画書ヘッダー | 小 |
| 3 | 計画作成者（児発管）自動取得 | 計画書ヘッダー | 小 |
| 4 | モニタリング期間の設定UI | 計画書ヘッダー | 小 |
| 5 | 7列テーブルへのLLMデータ連携 | 2ページ目 | 中 |
| 6 | 説明・同意日の入力UI | 2ページ目 | 小 |

### データ要件分析

#### 現在利用可能なデータ

| データ項目 | ソース | 利用可能 |
|-----------|--------|---------|
| 児童名 | `subjects.name` | ✅ |
| 年齢 | `subjects.age` | ✅ |
| 障害種別 | `subjects.diagnosis` | ✅ |
| 保護者氏名 | `subjects.guardian_name` | ✅ |
| 計画作成日 | `support_plans.created_at` | ✅ |
| 本人の意向 | LLM Phase 2 → 3 | ✅ |
| 保護者の意向 | LLM Phase 2 → 3 | ✅ |
| 支援方針 | LLM Phase 3 | ✅ |
| 長期目標 | LLM Phase 3 | ✅ |
| 短期目標 | LLM Phase 3 | ✅ |
| 支援項目（5領域） | LLM Phase 3 | ✅ |
| 家族支援 | LLM Phase 3 | ✅ |
| 移行支援・地域連携 | LLM Phase 3 | ✅ |

#### 新規作成・拡張が必要なデータ

| データ項目 | 対応方法 | 実装方針 |
|-----------|---------|---------|
| 事業所名 | `business_facilities.name` カラム追加 | DB拡張 |
| 計画作成者名 | `support_plans.manager_id` → `users.name` | 認証連携 |
| モニタリング開始日 | `support_plans.monitoring_start` 追加 | DB拡張 |
| モニタリング終了日 | `support_plans.monitoring_end` 追加 | DB拡張 |
| 説明・同意日 | `support_plans.consent_date` 追加 | DB拡張 |
| 担当者・提供期間 | 認証ユーザー情報から取得 | 認証連携 |

### DBスキーマ変更計画

#### business_facilities テーブル拡張

```sql
ALTER TABLE business_facilities
ADD COLUMN name TEXT;  -- 事業所名
```

#### business_support_plans テーブル拡張

```sql
ALTER TABLE business_support_plans
ADD COLUMN manager_id UUID REFERENCES users(id),  -- 計画作成者（児発管）
ADD COLUMN monitoring_start DATE,  -- モニタリング開始日
ADD COLUMN monitoring_end DATE,    -- モニタリング終了日
ADD COLUMN consent_date DATE;      -- 説明・同意日
```

---

## 認証設計

### 現状の課題

現在のシステムは固定APIトークン（`X-API-Token: watchme-b2b-poc-2025`）で認証しており、以下の問題がある：

1. **ユーザー識別不可**: 誰がログインしているか分からない
2. **事業所関連付け不可**: ユーザーと事業所の紐付けができない
3. **権限管理不可**: 児発管と一般職員の区別ができない
4. **監査ログ不可**: 誰が何をしたか追跡できない

### ユーザー構造の理解

WatchMeサービス全体のユーザー構造：

```
┌───────────────────────────────────────────────────────┐
│                 users（WatchMe全ユーザー）              │
│                                                        │
│   ┌──────────────────┐    ┌──────────────────────┐    │
│   │  個人ユーザー      │    │  ビジネスユーザー      │    │
│   │  (保護者など)      │    │  (事業者職員)          │    │
│   │                   │    │                       │    │
│   │  facility_id=NULL │    │  facility_id=UUID ────┼────┼──→ 参照
│   │                   │    │  role='manager'/'staff'│    │
│   │  アクセス:        │    │  アクセス:             │    │
│   │  - iOSアプリのみ  │    │  - iOSアプリ          │    │
│   │                   │    │  - ビジネスサイト      │    │
│   └──────────────────┘    └──────────────────────┘    │
└───────────────────────────────────────────────────────┘
                                                          │
                                                          ▼
                              ┌─────────────────────────────────┐
                              │   business_facilities (事業所)   │
                              │     └── organization_id ────────┼──→ business_organizations (法人)
                              └─────────────────────────────────┘
```

**ポイント**:
- `users` はWatchMe全体のユーザー基盤（独立した大きな枠組み）
- 個人ユーザー（保護者）は `facility_id = NULL`
- ビジネスユーザーは `facility_id` で事業所を「参照」している
- `business_organizations` → `business_facilities` は事業者管理テーブル群

### ビジネスサイトアクセス判定

```python
# ビジネスサイトにアクセス可能か判定
def can_access_business_site(user):
    return user.facility_id is not None
```

**同一事業所の情報共有**:
```sql
-- 同じ facility_id を持つユーザーは同じ情報にアクセス
SELECT * FROM business_interview_sessions 
WHERE facility_id = :current_user_facility_id
```

### 認証アーキテクチャ: Supabase Auth

**メリット**:
- 既存Supabase環境との親和性が高い
- Row Level Security (RLS) でデータアクセス制御可能
- JWT認証でフロント・バックエンド両対応
- `auth.users` と `public.users` の連携が容易

**認証フロー**:
```
[ユーザー] → [ログイン画面] → [Supabase Auth (auth.users)]
                              ↓
                    [JWT発行] → [フロントエンド保持]
                              ↓
              [API呼び出し時にJWT送信] → [バックエンド検証]
                                       ↓
                              [user_id取得] → [public.users参照]
                                             ↓
                              [facility_id確認] → [事業所情報取得]
```

### DBスキーマ変更

#### 1. 新規テーブル: `business_organizations`

```sql
CREATE TABLE business_organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,                    -- 法人名（例: 株式会社リタリコ）
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 2. 既存テーブル変更: `business_facilities`

```sql
-- organization_id カラム追加
ALTER TABLE business_facilities
ADD COLUMN organization_id UUID REFERENCES business_organizations(id);

-- 既存レコードのマイグレーション（必要に応じて）
-- UPDATE business_facilities SET organization_id = '...' WHERE id = '...';
```

#### 3. 既存テーブル: `users` （変更なし）

`facility_id` カラムはすでに存在。外部キー制約の追加のみ検討：

```sql
-- 外部キー制約追加（オプション）
ALTER TABLE users
ADD CONSTRAINT fk_users_facility
FOREIGN KEY (facility_id) REFERENCES business_facilities(id);
```

### ユーザーロール定義

| role | 説明 | ビジネスサイト権限 |
|------|------|-------------------|
| `parent` | 保護者（個人ユーザー） | アクセス不可 |
| `manager` | 児発管（計画作成者） | フルアクセス |
| `staff` | 一般職員 | 閲覧のみ |

### 画面別権限設計

| 画面 | 児発管 (manager) | 職員 (staff) | 保護者 (parent) |
|------|-----------------|--------------|-----------------|
| ビジネスサイトトップ | ✅ | ✅ | ❌ |
| セッション一覧 | ✅ 閲覧・作成 | ✅ 閲覧・作成 | ❌ |
| 音声文字起こし | ✅ 実行 | ✅ 実行 | ❌ |
| LLMパイプライン | ✅ 実行 | ✅ 閲覧のみ | ❌ |
| 個別支援計画書 | ✅ 作成・編集 | ✅ 閲覧のみ | ❌ |
| Excel出力 | ✅ 可能 | ✅ 可能 | ❌ |
| 支援管理ページ | ✅ 作成・編集 | ❌ アクセス不可 | ❌ |

### 実装ステップ

#### Phase A: DBスキーマ準備 ✅ 完了

| Step | 作業内容 | SQL | 状態 |
|------|---------|-----|------|
| A-1 | `business_organizations` テーブル作成 | CREATE TABLE | ✅ 完了 |
| A-2 | `business_facilities` に `organization_id` 追加 | ALTER TABLE | ✅ 完了 |
| A-3 | テストデータ投入 | INSERT | ✅ 完了 |

#### Phase B: フロントエンド認証 ✅ 完了

| Step | 作業内容 | ファイル | 状態 |
|------|---------|---------|------|
| B-1 | Supabase Client設定 | `frontend/src/lib/supabase.ts` | ✅ 完了 |
| B-2 | 認証Context作成 | `frontend/src/contexts/AuthContext.tsx` | ✅ 完了 |
| B-3 | ログイン画面作成 | `frontend/src/pages/Login.tsx` | ✅ 完了 |
| B-4 | App.tsxに認証チェック追加 | `frontend/src/App.tsx` | ✅ 完了 |
| B-5 | ヘッダーにユーザー・事業所情報表示 | `frontend/src/components/Layout.tsx` | ✅ 完了 |

**実装済み機能**:
- Google OAuth ログイン
- メール/パスワード ログイン・サインアップ
- ビジネスユーザー判定（`facility_id IS NOT NULL`）
- ヘッダーに組織名・事業所名・ユーザー名表示

#### Phase C: バックエンド認証 ⏳ 未実装

| Step | 作業内容 | ファイル |
|------|---------|---------|
| C-1 | JWT検証ミドルウェア | `backend/middleware/auth.py` |
| C-2 | ユーザー情報取得ヘルパー | `backend/services/user_service.py` |
| C-3 | 既存エンドポイントに認証適用 | `backend/app.py` |

#### Phase D: 計画書へのデータ連携 ⏳ 未実装

| Step | 作業内容 | 詳細 |
|------|---------|------|
| D-1 | 事業所名自動取得 | `facility_id` → `business_facilities.name` |
| D-2 | 法人名取得（必要に応じて） | `organization_id` → `business_organizations.name` |
| D-3 | 計画作成者名自動取得 | `user_id` → `users.name` (role='manager') |

### RLSポリシー設定 ✅ 完了

認証を機能させるため、以下のRow Level Securityポリシーを追加：

```sql
-- users: 自分のレコードを読める
CREATE POLICY "Users can read own record" ON public.users
  FOR SELECT USING (auth.uid() = user_id);

-- business_facilities: 自分の事業所を読める
CREATE POLICY "Users can read own facility" ON public.business_facilities
  FOR SELECT USING (id IN (SELECT facility_id FROM public.users WHERE user_id = auth.uid()));

-- business_organizations: 自分の組織を読める
CREATE POLICY "Users can read own organization" ON public.business_organizations
  FOR SELECT USING (id IN (
    SELECT organization_id FROM public.business_facilities 
    WHERE id IN (SELECT facility_id FROM public.users WHERE user_id = auth.uid())
  ));
```

### テストデータ案

```sql
-- 法人
INSERT INTO business_organizations (id, name) VALUES
('org-001', '株式会社テスト福祉');

-- 事業所
UPDATE business_facilities 
SET organization_id = 'org-001'
WHERE id = '既存のfacility_id';

-- テストユーザー（既存ユーザーを更新）
UPDATE users 
SET facility_id = '既存のfacility_id', role = 'manager'
WHERE email = 'test-manager@example.com';
```

---

## 改訂履歴

- 2026-02-02 23:00: Phase 5（Human-in-the-Loop編集システム）設計追加、ギャップ分析完了、2カラム版管理設計確定
- 2026-01-30 21:30: 認証Phase B完了（フロントエンド認証、RLSポリシー設定）
- 2026-01-30 20:00: 認証設計を全面改訂（WatchMe全体のユーザー構造を反映、organizations追加）
- 2026-01-30 19:00: Phase 4を全面改訂（UI 2ページ目追加）、認証設計・実装計画セクション追加
- 2026-01-18 23:30: 開発計画書から技術仕様書に全面改訂（Phase 0-3完了時点）
- 2026-01-18 19:00: Phase 2プロンプト改善、DRY原則追加
- 2026-01-18 初版: Phase 1完了、Phase 2実装中

---

## Phase 5: Human-in-the-Loop 編集システム

### 概要

- **設計日**: 2026-02-02
- **状態**: 🚧 設計完了、実装待ち
- **目的**: AI生成した個別支援計画書を、Web管理画面からインライン編集できるシステム

### 設計思想

1. **AI生成値と修正後値の分離保存**: データ品質の検証を可能にするため、2カラム構造で管理
2. **プレビュー = Excel**: プレビューで見えているものがそのままExcel出力される（完全一致）
3. **インライン編集**: 各項目に鉛筆アイコン、クリックで編集モード、保存ボタン（青色アクティブ）で確定
4. **情報不足時の対応**: 「情報が取得できませんでした」をそのまま表示、無理に生成しない

---

### 現状のギャップ分析（2026-02-02時点）

#### A. 現在のUI出力（ハードコード問題）

`frontend/src/pages/SupportPlanCreate.tsx` の「Official Document Header Section」:

| 項目 | 現在の状態 | データソース |
|------|-----------|-------------|
| 事業所名 | ⚠️ ハードコード "ヨリドコロ横浜白楽" | 必要: `business_facilities.name` |
| 計画作成者 | ⚠️ ハードコード "山田太郎" | 必要: `users.name` (role='manager') |
| 本人の意向 | ⚠️ ハードコード | 必要: `assessment_v1.family_child_intentions.child` |
| 保護者の意向 | ⚠️ ハードコード | 必要: `assessment_v1.family_child_intentions.parents` |
| 総合的な支援の方針 | ⚠️ ハードコード | 必要: `assessment_v1.support_policy.child_understanding` |
| 長期目標 | ⚠️ ハードコード | 必要: `assessment_v1.long_term_goal.goal` |
| 短期目標 | ⚠️ ハードコード | 必要: `assessment_v1.short_term_goals[0].goal` |
| 支援の提供時間 | ⚠️ ハードコード リスト | 必要: 新規カラム or 手動入力 |
| 留意点・備考 | ⚠️ ハードコード リスト | 必要: 新規カラム or 手動入力 |
| 7列テーブル（Page 2） | ⚠️ 完全ハードコード | 必要: `assessment_v1.support_items[]` |
| 説明者 | ⚠️ ハードコード | 必要: `users.name` |
| 説明・同意日 | ⚠️ ハードコード | 必要: 新規カラム `consent_date` |

#### B. assessment_v1に存在する情報

✅ **活用可能（自動転記対象）**:

```json
{
  "assessment_v1": {
    "support_policy": {
      "child_understanding": "子どもの理解・見立て（200-400文字）",
      "key_approaches": ["視覚的スケジュール", "事前説明"],
      "collaboration_notes": "保育園との情報共有"
    },
    "family_child_intentions": {
      "child": "楽しく遊びたい（本人）",
      "parents": "場面に合った行動を..."
    },
    "long_term_goal": {
      "goal": "視覚的なスケジュールを手掛かりに...",
      "timeline": "6か月後",
      "rationale": "本人の視覚優位な特性を活かし..."
    },
    "short_term_goals": [
      {"goal": "...", "timeline": "3か月後"}
    ],
    "support_items": [
      {
        "category": "運動・感覚",
        "target": "目標",
        "methods": ["方法1", "方法2"],
        "staff": "担当者",
        "timeline": "6か月後",
        "priority": 2
      }
    ],
    "family_support": {},
    "transition_support": {}
  }
}
```

⚠️ **注意**: `support_items[].notes` フィールドが欠落 → Phase 3プロンプト改善必要

#### C. assessment_v1に存在しない情報（別ソースが必要）

| 情報 | データソース | 対応方法 |
|------|-------------|---------|
| 事業所名 | `business_facilities.name` | 認証連携（facility_id JOIN） |
| 計画作成者名 | `users.name` (role='manager') | 認証連携（created_by JOIN） |
| 障害種別 | `subjects.diagnosis` | ✅ 既存カラム |
| 障害支援区分 | - | 新規カラム `subjects.support_class` |
| 保護者氏名 | `subjects.guardian_name` | ✅ 既存カラム（要確認） |
| 相談支援事業所 | - | 新規カラム `subjects.consultation_agency` |
| 支援の提供時間 | - | 新規カラム or 手動入力 |
| 説明・同意日 | - | 新規カラム `business_support_plans.consent_date` |

---

### データベース設計（2カラム版管理）

#### 設計方針

- **2カラム方式**: 各項目ごとに `xxx_ai_generated` と `xxx_user_edited` のペア
- **表示優先順位**: `user_edited IS NOT NULL ? user_edited : ai_generated`
- **メリット**: SQL検索が容易、パフォーマンスが良い、シンプル

#### business_support_plans テーブル（全面改訂版）

```sql
-- マイグレーション: 004_support_plans_versioning.sql

-- 既存テーブルを削除して再作成（開発中のためデータ保存不要）
DROP TABLE IF EXISTS business_support_plans CASCADE;

CREATE TABLE business_support_plans (
    -- 基本情報
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id UUID NOT NULL REFERENCES business_facilities(id),
    subject_id UUID REFERENCES subjects(id),
    title TEXT,
    plan_number TEXT,
    status TEXT DEFAULT 'draft',
    created_by UUID REFERENCES users(user_id),
    
    -- タイムスタンプ
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- モニタリング期間
    monitoring_start DATE,
    monitoring_end DATE,
    
    -- ===== 2カラム版管理フィールド =====
    
    -- 本人の意向
    child_intention_ai_generated TEXT,
    child_intention_user_edited TEXT,
    
    -- 保護者の意向
    family_intention_ai_generated TEXT,
    family_intention_user_edited TEXT,
    
    -- 総合的な支援の方針（子どもの理解・見立て）
    general_policy_ai_generated TEXT,
    general_policy_user_edited TEXT,
    
    -- 主要アプローチ（JSONBで配列）
    key_approaches_ai_generated JSONB,
    key_approaches_user_edited JSONB,
    
    -- 連携事項
    collaboration_notes_ai_generated TEXT,
    collaboration_notes_user_edited TEXT,
    
    -- 長期目標
    long_term_goal_ai_generated TEXT,
    long_term_goal_user_edited TEXT,
    long_term_period_ai_generated TEXT DEFAULT '1年',
    long_term_period_user_edited TEXT,
    long_term_rationale_ai_generated TEXT,
    long_term_rationale_user_edited TEXT,
    
    -- 短期目標（JSONBで配列）
    short_term_goals_ai_generated JSONB,
    short_term_goals_user_edited JSONB,
    
    -- 支援項目（7列テーブル、JSONBで配列）
    support_items_ai_generated JSONB,
    support_items_user_edited JSONB,
    
    -- 家族支援
    family_support_ai_generated JSONB,
    family_support_user_edited JSONB,
    
    -- 移行支援・地域連携
    transition_support_ai_generated JSONB,
    transition_support_user_edited JSONB,
    
    -- ===== 手動入力専用フィールド =====
    
    -- 支援の標準的な提供時間（手動入力）
    service_schedule TEXT,
    
    -- 留意点・備考（手動入力）
    notes TEXT,
    
    -- 説明・同意
    explainer_name TEXT,
    consent_date DATE,
    guardian_signature TEXT
);

-- インデックス
CREATE INDEX idx_support_plans_facility ON business_support_plans(facility_id);
CREATE INDEX idx_support_plans_subject ON business_support_plans(subject_id);
CREATE INDEX idx_support_plans_created_by ON business_support_plans(created_by);

-- Updated_at トリガー
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_support_plans_updated_at
    BEFORE UPDATE ON business_support_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

#### subjects テーブル拡張

```sql
-- マイグレーション: 005_subjects_extension.sql

ALTER TABLE subjects
ADD COLUMN IF NOT EXISTS support_class TEXT,       -- 障害支援区分（例: 区分3）
ADD COLUMN IF NOT EXISTS consultation_agency TEXT; -- 相談支援事業所名
```

---

### 自動転記マッピング

#### assessment_v1 → business_support_plans

| assessment_v1 パス | business_support_plans カラム |
|-------------------|------------------------------|
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

---

### 実装ステップ（確定版）

#### Step 1: DBマイグレーション作成

**ファイル**: `backend/migrations/004_support_plans_versioning.sql`

**作業内容**:
- business_support_plans テーブルを2カラム構造に全面改訂
- 既存データは削除OK（開発中）

**テスト方法**:
```sql
-- Supabase SQL Editorで実行後、確認クエリ
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'business_support_plans';
```

#### Step 2: Phase 3 プロンプト改善

**ファイル**: `backend/services/prompts.py` の `build_assessment_prompt()`

**変更内容**:
1. `support_items[].notes` フィールドを追加生成
2. 情報不足時は「情報が取得できませんでした」を返す指示追加

**テスト方法**:
```bash
# 既存セッションで再実行
curl -X POST https://api.hey-watch.me/business/api/assess \
  -H "X-API-Token: watchme-b2b-poc-2025" \
  -H "Content-Type: application/json" \
  -d '{"session_id": "a522ab30-77ca-4599-81b8-48bc8deca835"}'

# 結果確認
SELECT assessment_result_v1->'assessment_v1'->'support_items'->0->>'notes'
FROM business_interview_sessions
WHERE id = 'a522ab30-77ca-4599-81b8-48bc8deca835';
```

#### Step 3: 自動転記API実装

**ファイル**: `backend/app.py`

**エンドポイント**: `POST /api/support-plans/{plan_id}/sync-from-assessment`

**処理内容**:
1. plan_idからsupport_planを取得
2. 関連するsession_idからassessment_v1を取得
3. マッピングテーブルに従って `xxx_ai_generated` カラムに保存

**テスト方法**:
```bash
curl -X POST http://localhost:8052/api/support-plans/{plan_id}/sync-from-assessment \
  -H "X-API-Token: watchme-b2b-poc-2025"

# 確認
SELECT child_intention_ai_generated, general_policy_ai_generated
FROM business_support_plans WHERE id = '{plan_id}';
```

#### Step 4: EditableField コンポーネント作成

**ファイル**: `frontend/src/components/EditableField.tsx`

**機能**:
- 表示モード: 値 + 鉛筆アイコン
- 編集モード: 入力UI + 保存ボタン（青色、未保存時アクティブ）
- 型別UI:
  - `text`: 1行テキスト入力
  - `textarea`: 複数行テキスト入力
  - `date`: 日付ピッカー
  - `list`: 箇条書き編集（配列）
- 保存: EnterキーまたはSaveボタンでPUT `/api/support-plans/{id}` 呼び出し

**Props**:
```typescript
interface EditableFieldProps {
  planId: string;
  field: string;           // カラム名（xxx_user_edited）
  value: string | null;    // 現在値
  aiValue: string | null;  // AI生成値（フォールバック用）
  type: 'text' | 'textarea' | 'date' | 'list';
  onSave: (field: string, value: string) => Promise<void>;
}
```

**テスト方法**:
- 鉛筆アイコンクリック → 編集モードに切り替わる
- 値を変更 → 保存ボタンがアクティブ（青色）になる
- Enter/保存ボタン → API呼び出し、値が更新される
- ページリロード → 更新された値が表示される

#### Step 5: EditableTableRow コンポーネント作成

**ファイル**: `frontend/src/components/EditableTableRow.tsx`

**機能**:
- 7列テーブルの1行を管理
- 行編集ボタン → 7列全てが編集モードに
- 保存ボタン1つで行全体を更新
- `support_items_user_edited` の該当indexを更新

**構造**:
```typescript
interface SupportItem {
  category: string;      // 項目（5領域）
  target: string;        // 具体的な到達目標
  methods: string[];     // 具体的な支援内容
  timeline: string;      // 達成時期
  staff: string;         // 担当者・提供期間
  notes: string;         // 留意事項
  priority: number;      // 優先順位
}
```

**テスト方法**:
- 行編集ボタンクリック → 7列全てが入力可能に
- 各列の値を変更
- 保存ボタン → 行全体がAPI更新
- ページリロード → 更新された行が表示される

#### Step 6: UI全面改修

**ファイル**: `frontend/src/pages/SupportPlanCreate.tsx`

**作業内容**:
1. ハードコードされた全項目を削除
2. `plan.xxx_user_edited ?? plan.xxx_ai_generated` でデータ取得
3. 各項目をEditableFieldでラップ
4. 7列テーブルをEditableTableRowでラップ

**テスト方法**:
- ページ表示 → AI生成値が表示される（ハードコードなし）
- 任意の項目を編集 → 保存成功
- ページリロード → 編集した値が保持されている

#### Step 7: Excel出力統一

**ファイル**: `backend/services/excel_generator.py`

**変更内容**:
- assessment_v1から直接取得 → business_support_plansから取得に変更
- 取得ロジック: `user_edited if user_edited else ai_generated`
- プレビューと完全一致した出力

**テスト方法**:
- UIで編集した値がある状態でExcelダウンロード
- Excelの内容がUIプレビューと一致していることを確認

#### Step 8: 認証連携

**ファイル**: 
- `frontend/src/components/RecordingSession.tsx`
- `backend/app.py`

**作業内容**:
1. RecordingSessionでAuthContextからuser_idを取得しstaff_idとして送信
2. business_interview_sessions.staff_idに記録
3. business_support_plans.created_byに設定

**テスト方法**:
- ログイン状態で録音実行
- business_interview_sessions.staff_idにユーザーIDが記録されている
- 計画作成時にcreated_byが設定されている

---

### テスト計画

#### 単体テスト

| テスト項目 | 期待結果 | 確認方法 |
|-----------|---------|---------|
| DBマイグレーション | テーブルが2カラム構造で作成 | `\d business_support_plans` |
| 自動転記API | assessment_v1がai_generatedに保存 | SELECTクエリ |
| EditableField表示 | 値 + 鉛筆アイコンが表示 | 目視確認 |
| EditableField編集 | 入力UI + 青色保存ボタン | 目視確認 |
| EditableField保存 | user_editedカラムが更新 | SELECTクエリ |
| EditableTableRow | 7列同時編集、1ボタンで保存 | 目視確認 |

#### 統合テスト

| シナリオ | 手順 | 期待結果 |
|---------|------|---------|
| E2E: 録音→計画生成→編集→Excel | 1. 録音アップロード<br>2. Phase 0-3実行<br>3. 自動転記API実行<br>4. UI表示確認<br>5. 任意項目を編集<br>6. Excelダウンロード | ExcelがUIと一致 |
| 情報不足時 | 1. 情報が少ない録音で計画生成<br>2. UI表示確認 | 「情報が取得できませんでした」表示 |
| 編集→リロード | 1. 項目を編集<br>2. ページリロード | 編集した値が保持 |

#### 回帰テスト

| 確認項目 | 期待結果 |
|---------|---------|
| 既存の録音アップロード | 正常動作 |
| 既存のPhase 0-3パイプライン | 正常動作 |
| 既存のExcel出力 | 正常動作（改修後のロジック） |

---

### 標準テストデータ

**session_id**: `a522ab30-77ca-4599-81b8-48bc8deca835`

- 対象: 松本正弦（5歳、ASD、境界知能 IQ81、白幡幼稚園）
- 文字起こし: 15,255語
- 参加者: 父・母
- 録音日: 2026-01-13
- Phase 0-3: ✅ 完了済み

---

### 実装優先順位

1. **Step 1: DBマイグレーション** - 基盤整備（他のStep依存）
2. **Step 2: プロンプト改善** - 独立して実行可能
3. **Step 3: 自動転記API** - Step 1完了後
4. **Step 4-5: コンポーネント作成** - 並行して実行可能
5. **Step 6: UI改修** - Step 3-5完了後
6. **Step 7: Excel統一** - Step 6完了後
7. **Step 8: 認証連携** - 独立して実行可能

---

### 未実装・今後の課題

| 項目 | 優先度 | 備考 |
|------|--------|------|
| 別表（週間スケジュール）UI | 低 | メイン2ページ完成後に着手 |
| バックエンド認証（Phase C） | 中 | JWT検証ミドルウェア |
| 変更履歴の可視化 | 低 | 将来的な品質検証用 |
| 一括編集モード | 低 | 複数項目を同時に編集 |
