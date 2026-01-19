# 個別支援計画 自動生成システム 技術仕様書

**最終更新**: 2026-01-19 23:45 JST
**対象プロジェクト**: WatchMe Business API
**システム状態**: Phase 0-4 稼働中 ✅
**実装完了度**: 95% (Phase 0-4完了、PDF生成未実装)

---

## 📋 目次

1. [システム概要](#システム概要)
2. [処理フロー](#処理フロー)
3. [データベース設計](#データベース設計)
4. [Phase 0: 文字起こし](#phase-0-文字起こし)
5. [Phase 1: 事実抽出](#phase-1-事実抽出)
6. [Phase 2: 事実整理](#phase-2-事実整理)
7. [Phase 3: 個別支援計画生成](#phase-3-個別支援計画生成)
8. [Phase 4: Excel出力](#phase-4-excel出力)
9. [UI実装（管理画面表示）](#ui実装管理画面表示)
10. [共通実装パターン](#共通実装パターン)
10. [LLMモデル管理](#llmモデル管理)
11. [テスト方法](#テスト方法)

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

## Phase 4: Excel出力

### 概要

- **実装日**: 2026-01-19
- **状態**: ✅ 稼働中
- **エンドポイント**: `GET /api/sessions/{session_id}/download-excel`
- **使用ライブラリ**: openpyxl
- **処理時間**: <1秒

### 責務

assessment_v1から**個別支援計画書のExcelファイル**を生成する（2シート構成）。

### 出力ファイル構成

#### Sheet 1: 別紙1-1（個別支援計画書）
- タイトル：個別支援計画書
- 利用児氏名・年齢（subjectsテーブルから取得）
- 総合的な支援方針
- 長期目標・短期目標
- 支援項目（5領域）
  - 運動・感覚
  - 言語・コミュニケーション
  - 健康・生活
  - 認知・行動
  - 人間関係・社会性
- 家族支援
- 移行支援・地域連携

#### Sheet 2: 別紙1-2（個別支援計画書別表）
- 週間スケジュール（月〜日・祝日）
- 提供時間（利用開始・終了時間）
- 延長支援時間
  - 【支援前】延長支援時間
  - 【支援後】延長支援時間
- 延長を必要とする理由
- 特記事項

### 実装ファイル

- `backend/services/excel_generator.py`: Excel生成ロジック
  - `generate_support_plan_excel()`: メイン関数
  - `generate_main_support_plan()`: Sheet 1生成
  - `generate_support_schedule()`: Sheet 2生成
  - `extract_assessment_v1()`: データ抽出（ラップされたJSON対応）
- `backend/app.py`: ダウンロードエンドポイント
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

## UI実装（管理画面表示）

### 概要

- **実装日**: 2026-01-19
- **状態**: ✅ 稼働中
- **ページ**: 個別支援計画詳細画面（Session Detail Drawer）

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

## 改訂履歴

- 2026-01-18 23:30: 開発計画書から技術仕様書に全面改訂（Phase 0-3完了時点）
- 2026-01-18 19:00: Phase 2プロンプト改善、DRY原則追加
- 2026-01-18 初版: Phase 1完了、Phase 2実装中
