# LLM分析機能 実装計画書

**最終更新**: 2026-01-18 19:00 JST
**対象プロジェクト**: WatchMe Business API
**現在のフェーズ**: Phase 2 - fact_structuring デバッグ中 🚧
**進捗**: 45% (Phase 0-1完了、Phase 2コード統一完了・テスト待ち)

---

## 📐 全体設計思想

### なぜ一発変換できないのか？

**一発変換の問題点**:
```
transcription → LLM → 個別支援計画PDF
```
- ❌ プロンプトが長大化・複雑化
- ❌ アウトプットのブレが大きい（解釈・評価・創造が混在）
- ❌ デバッグが困難（どこで失敗したか分からない）
- ❌ Human in the Loopが不可能

**3段階パイプライン設計**:
```
Phase 1: 事実抽出（extraction）
  ↓
Phase 2: 事実の再構造化（structuring）
  ↓
Phase 3: 解釈・評価・計画策定（assessment）
```

**設計の核心**:
- Phase 1-2: **事実のみ**（推論・解釈ゼロ）→ 自動化可能
- Phase 3: **専門的判断**（解釈・評価・創造）→ Human in the Loop必須

---

## 🏛️ 設計の基本原則（Phase 1-3 統一パターン）

**2026-01-18策定 - 全フェーズで厳守**

### 1. バックグラウンド処理の統一構造

すべてのフェーズは同じ処理パターンに従う：

```python
def {phase}_background(
    session_id: str,
    supabase: Client,
    llm_service  # ← 統一パラメータ名（openai_clientではない）
):
    """
    Phase X: {目的}

    Args:
        session_id: Session ID
        supabase: Supabase client
        llm_service: LLM service instance (抽象化レイヤー)
    """
    try:
        # 1. DB.select() - 前フェーズの結果を取得
        result = supabase.table('business_interview_sessions')\
            .select('...')\
            .eq('id', session_id)\
            .single()\
            .execute()

        # 2. プロンプト生成
        prompt = build_{phase}_prompt(...)

        # 3. プロンプトをDBに保存
        supabase.table('business_interview_sessions').update({
            '{phase}_prompt_v1': prompt
        }).eq('id', session_id).execute()

        # 4. LLM呼び出し（統一インターフェース）
        llm_output = llm_service.generate(prompt)

        # 5. JSON parse（柔軟な対応）
        if llm_output.strip().startswith('{'):
            result_data = json.loads(llm_output)
        else:
            result_data = {'summary': llm_output}

        # 6. DB.update() - 結果を保存
        supabase.table('business_interview_sessions').update({
            '{phase}_result_v1': result_data,
            'updated_at': datetime.now().isoformat()
        }).eq('id', session_id).execute()

    except Exception as e:
        # エラー処理（DB更新含む）
        ...
```

### 2. LLM呼び出しの統一ルール

**絶対禁止**：
```python
# ❌ 直接OpenAI APIを呼び出す
openai_client.chat.completions.create(...)
```

**必須パターン**：
```python
# ✅ 抽象化レイヤーを使用
llm_output = llm_service.generate(prompt)
```

**理由**：
- モデル切り替えが容易（GPT-4o → GPT-4o-mini → GPT-5 Nano）
- プロバイダー切り替えが可能（OpenAI → Anthropic → Groq）
- リトライ・エラーハンドリングが一元管理される

### 3. エンドポイントの統一パターン

```python
@app.post("/api/{phase}")
async def {phase}(
    request: AnalyzeRequest,
    x_api_token: str = Header(None, alias="X-API-Token")
):
    # 1. トークン検証
    if x_api_token != API_TOKEN:
        raise HTTPException(status_code=401, ...)

    # 2. 前提条件チェック（前フェーズの結果が存在するか）
    result = supabase.table('business_interview_sessions')\
        .select('{prev_phase}_result_v1')\
        .eq('id', request.session_id)\
        .single()\
        .execute()

    # データ構造の柔軟な対応（summary wrapper等）
    has_valid_data = validate_{prev_phase}_result(result.data)

    # 3. バックグラウンドスレッド起動
    from services.background_tasks import {phase}_background
    from services.llm_providers import get_current_llm

    llm_service = get_current_llm()  # ← 統一インターフェース

    thread = threading.Thread(
        target={phase}_background,
        args=(request.session_id, supabase, llm_service)
    )
    thread.daemon = True
    thread.start()

    # 4. 即座に202 Acceptedを返す
    return Response(
        status_code=202,
        content='{"status": "processing", "message": "{Phase} started"}',
        media_type="application/json"
    )
```

### 4. モデル管理の統一方針

**現在の設定**（`backend/services/llm_providers.py`）：
```python
CURRENT_PROVIDER = "openai"
CURRENT_MODEL = "gpt-4o"
```

**モデル切り替え方法**：
1. `llm_providers.py`の定数を変更
2. デプロイ

**将来的な拡張**：
- 環境変数による動的切り替え（`LLM_PROVIDER=openai`, `LLM_MODEL=gpt-4o`）
- フェーズごとに異なるモデルを使用（Phase 1はmini、Phase 3はo1-preview等）

---

## 🤖 使用LLMモデル一覧

**2026-01-18時点**

| フェーズ | エンドポイント | 関数名 | 使用モデル | プロバイダー |
|---------|--------------|--------|-----------|------------|
| **Phase 1** | POST /api/analyze | `analyze_background()` | **gpt-4o** | OpenAI |
| **Phase 2** | POST /api/structure-facts | `structure_facts_background()` | **gpt-4o** | OpenAI |
| Phase 3（未実装） | POST /api/assess | `assess_background()` | gpt-4o（予定） | OpenAI |
| Phase 4（未実装） | POST /api/plan/generate | - | - | - |

**モデル選定の方針**：
- **Phase 1-2（事実処理）**: gpt-4o（精度・コスト・速度バランス）
- **Phase 3（専門的判断）**: gpt-4o または o1-preview（複雑な推論が必要な場合）

**コスト試算**（1セッションあたり）：
- Phase 1: 約$0.10（入力15,000 tokens、出力2,000 tokens想定）
- Phase 2: 約$0.03（入力2,500 tokens、出力1,500 tokens想定）
- Phase 3: 約$0.05（入力2,000 tokens、出力3,000 tokens想定）
- **合計**: 約$0.18/セッション

---

## 📊 データベース設計（確定版）

### business_interview_sessions テーブル

**確認日**: 2026-01-18
**確認方法**: Supabase SQL実行結果

```sql
-- 基本情報
id                           UUID PRIMARY KEY DEFAULT gen_random_uuid()
facility_id                  UUID NOT NULL
subject_id                   UUID NOT NULL
support_plan_id              UUID
s3_audio_path                TEXT
staff_id                     UUID
session_type                 TEXT
session_number               INTEGER DEFAULT 1
attendees                    JSONB
duration_seconds             INTEGER

-- Phase 0: 文字起こし
transcription                TEXT
transcription_metadata       JSONB DEFAULT '{}'::jsonb

-- Phase 1: 事実抽出 (fact_extraction)
fact_extraction_prompt_v1    TEXT
fact_extraction_result_v1    JSONB

-- Phase 2: 事実の再構造化 (fact_structuring)
fact_structuring_prompt_v1   TEXT
fact_structuring_result_v1   JSONB

-- ステータス管理
status                       TEXT DEFAULT 'recording'::text
error_message                TEXT

-- タイムスタンプ
recorded_at                  TIMESTAMPTZ DEFAULT now()
created_at                   TIMESTAMPTZ DEFAULT now()
updated_at                   TIMESTAMPTZ DEFAULT now()
```

**Phase 3以降で追加予定**:
- `assessment_prompt_v1` TEXT
- `assessment_result_v1` JSONB
- `plan_html` TEXT
- `plan_pdf_url` TEXT

---

## 🏗️ 実装済みフェーズ

### ✅ Phase 0: 基盤（2026-01-13完了）

**データフロー**:
```
録音（webm） → S3アップロード
  ↓
Lambda: business-audio-upload-handler
  ↓
Speechmatics Batch API（話者分離）
  ↓
business_interview_sessions.transcription 保存
```

**成果物**:
- 文字起こし（話者分離付き）
- 自動実行（Lambda完全自動化）

---

### ✅ Phase 1: fact_extraction（2026-01-17完了）

**目的**: ヒアリング文字起こしから**事実のみを抽出**

**使用モデル**: OpenAI gpt-4o（`backend/services/llm_providers.py`で設定）

**データフロー**:
```
POST /api/analyze
  ↓
analyze_background() (threading)
  ↓
1. DB.select() → session + subject データ取得
2. 事前情報埋め込みプロンプト生成
3. GPT-4o API呼び出し
4. JSON parse
5. DB.update() → fact_extraction_prompt_v1, fact_extraction_result_v1 保存
```

**実装ファイル**:
- `backend/app.py`: POST /api/analyze エンドポイント
- `backend/services/background_tasks.py`: analyze_background()

**出力構造** (`fact_extraction_result_v1`):
```json
{
  "extraction_v1": {
    "basic_info": [{"field": "氏名", "value": "...", "confidence": "high"}],
    "current_state": [...],
    "strengths": [...],
    "challenges": [...],
    "physical_sensory": [...],
    "medical_development": [...],
    "family_environment": [...],
    "parent_intentions": [{"summary": "...", "priority": 1, "confidence": "high"}],
    "staff_notes": [...],
    "administrative_notes": [...],
    "unresolved_items": [{"summary": "...", "reason": "..."}]
  }
}
```

**設計原則**:
- ❌ 原文引用（source）は不要
- ❌ 推論ワード禁止（「可能性」「傾向」など）
- ✅ summary + confidence のみ
- ✅ 判断・評価は絶対にしない

**テスト結果**:
- session_id: `a522ab30-77ca-4599-81b8-48bc8deca835`
- ✅ 全11カテゴリ正常抽出

---

### 🚧 Phase 2: fact_structuring（2026-01-18実装完了・デバッグ中）

**目的**: extraction_v1（11カテゴリの生データ）を、**支援計画用に再分類**

**重要**: Phase 2も**事実のみ**。解釈・評価は一切しない。

**使用モデル**: OpenAI gpt-4o（`backend/services/llm_providers.py`で設定）

**データフロー**:
```
POST /api/structure-facts
  ↓
structure_facts_background() (threading)
  ↓
1. DB.select() → fact_extraction_result_v1.extraction_v1 取得
2. プロンプト生成（fact_clusters_v1用）
3. GPT-4o API呼び出し
4. JSON parse
5. DB.update() → fact_structuring_prompt_v1, fact_structuring_result_v1 保存
```

**実装ファイル**:
- `backend/app.py`: POST /api/structure-facts エンドポイント
- `backend/services/prompts.py`: build_fact_structuring_prompt()
- `backend/services/background_tasks.py`: structure_facts_background()

**出力構造** (`fact_structuring_result_v1`):
```json
{
  "fact_clusters_v1": {
    "child_profile": {
      "name": "松本正弦",
      "age": 5,
      "birth_date": "2019-04-30",
      "gender": "男性",
      "diagnosis": ["ASD", "境界知能"],
      "school_name": "白幡幼稚園",
      "school_type": "幼稚園"
    },
    "cognitive_characteristics": [
      "IQ81（2月測定、境界知能）",
      "ワーキングメモリが少ない",
      "長期記憶は良好",
      "ひらがな2ヶ月で9割習得"
    ],
    "behavior_observations": [
      "静かにすべき場面（幼稚園行事・法事）で落ち着かない",
      "切り替えが困難（興味に集中すると他の話を聞けない）"
    ],
    "social_interactions": [
      "人の気持ちを考えられない・想像できない",
      "おもちゃの取り合いで友達を叩いた"
    ],
    "sensory_motor": [
      "感覚鈍麻・痛みに鈍感",
      "運動能力は同世代より低い",
      "縄跳び・スキップができない"
    ],
    "play_interests": [
      "アスレチック遊具が好き",
      "廃材遊び・ブロック遊びが得意",
      "機械的構造・メカへの関心が高い"
    ],
    "daily_living_skills": [
      "トイレ自立（夜のみオムツ）",
      "食事：好き嫌いなし",
      "納豆・オクラなど大人の味覚を好む"
    ],
    "medical_health": [
      "アレルギー診断なし（傾向あり）",
      "ザイザル（アレルギー緩和薬）2-3年継続服用"
    ],
    "family_context": [
      "一つ上の姉がいる",
      "父・母ともにヒアリング参加"
    ],
    "parent_concerns": [
      {"concern": "対人関係の改善", "priority": 1},
      {"concern": "社会的場面で落ち着くこと", "priority": 2}
    ],
    "parent_intentions": [
      {"speaker": "本人", "intention": "楽しく遊びたい"},
      {"speaker": "保護者", "intention": "場面に合った行動を自分で気付いて行えるようになってほしい"}
    ],
    "service_context": [
      "白幡幼稚園に通園中",
      "コペル（療育教室）検討中（見学未実施）"
    ],
    "unresolved_administrative": [
      {"item": "受給者証取得手続き", "status": "自治体方針不確定"}
    ]
  }
}
```

**設計原則**:
- ❌ 用途を固定しない（`facts_for_support_policy`のような命名禁止）
- ❌ 推論ワード禁止（「可能性」「傾向」など）
- ❌ 因果関係を含めない
- ✅ 中立的な領域別分類（cognitive, behavior, social, etc.）
- ✅ 事実の粒度を保つ

**Phase 2の意義**:
- Phase 3で「どの事実を使うか」を柔軟に選べる
- 事実の配置図（judgment material clusters）

**実装状況**:
- ✅ DBカラム追加完了
- ✅ エンドポイント実装完了
- ✅ プロンプト実装完了
- ✅ Phase 1パターンへのコード統一完了（2026-01-18 19:00）
  - `llm_service.generate()` 使用に統一
  - パラメータ名を `openai_client` → `llm_service` に変更
  - Phase 1と同じエラーハンドリング実装
- 🚧 デプロイ完了・テスト待ち

---

## 🚧 未実装フェーズ

### Phase 3: assessment（解釈・評価・計画策定）

**目的**: fact_clusters_v1 から**個別支援計画の骨子**を生成

**重要**: Phase 3で初めて**解釈・評価・判断**を行う

**データフロー（想定）**:
```
POST /api/assess （新規エンドポイント）
  ↓
assess_background() (threading)
  ↓
1. DB.select() → fact_structuring_result_v1.fact_clusters_v1 取得
2. プロンプト生成（専門的判断を含む）
3. GPT-4o API呼び出し
4. JSON parse
5. DB.update() → assessment_prompt_v1, assessment_result_v1 保存
```

**出力構造** (`assessment_result_v1`) - 想定:
```json
{
  "assessment_v1": {
    "support_policy": {
      "child_understanding": "視覚的な手掛かりの方が理解しやすいと見立てています...",
      "key_approaches": [
        "視覚的スケジュールの活用",
        "事前説明の徹底",
        "絵カード・具体物での意思表示促進"
      ],
      "collaboration_notes": "保育園との情報共有、必要に応じて訪問連携"
    },
    "long_term_goals": [
      {
        "goal": "視覚的なスケジュールを手掛かりに指示を理解し、わからない時には様々なコミュニケーション手段を用いて、大人に聞くことができる",
        "timeline": "6か月後",
        "rationale": "本人の視覚優位な特性を活かし..."
      }
    ],
    "short_term_goals": [
      {
        "goal": "見える化された手順やスケジュールを大人と一緒に確認し、設定活動時に自分で動けるようになる",
        "timeline": "3か月後"
      },
      {
        "goal": "大人が介在する中で、絵カードやイラスト等を用いて、「これで遊びたい」等の具体的な意思を友達に表現できるようになる",
        "timeline": "6か月後"
      }
    ],
    "support_items": [
      {
        "category": "運動・感覚",
        "target": "「どうぞ」と言われてから活動に取り組み、遊具に合わせた体の調整ができるようになる",
        "methods": [
          "活動前に全体を指差しする等を行い、全体を見渡す機会を設けてから声をかける",
          "手の平、足の裏、お尻等体を支えたり、接地している感覚をつかみやすくするため、つかむ・支える・滑る等の要素を取り入れた遊具遊びを提供する"
        ],
        "staff": "作業療法士、保育士",
        "priority": 2,
        "timeline": "6か月後",
        "notes": "専門的支援実施加算については、別紙参照"
      },
      {
        "category": "言語・コミュニケーション",
        "target": "嫌な時やお願いをする時に、身振りやことばで伝えることができる",
        "methods": [
          "具体的な伝え方のモデルを大人が示す",
          "簡単なやり取りを端的に都度促していく（本人がストレスをためこまないように、執拗な繰り返しは行わない）",
          "本人からの表出や要求に可能な限り応え、伝わったことの楽しさを伝えていく"
        ],
        "staff": "心理担当職員",
        "priority": 2,
        "timeline": "6か月後",
        "notes": "保護者に対して具体的な接し方の例を示す時間（5月に心理担当職員による個別面談）を設ける"
      }
    ],
    "family_support": [
      {
        "goal": "日常生活において、本人の意思を大切にしながら、やり取りをする場面を増やす",
        "methods": [
          "本人が自分で考えたり選んだりすることができるように、一呼吸おいてから次の提案をしたり、具体的な選択肢を2つ提示して選ぶ機会を設ける等、具体的な方法をお伝えし、実践していただく",
          "本人のコミュニケーションや判断する仕草等を、個別支援の場面での観察や面談の機会などを通じてお伝えし、共有する"
        ],
        "timeline": "6か月後"
      }
    ]
  }
}
```

**Phase 3の特徴**:
- ✅ 解釈・評価を含む（「見立て」「判断」）
- ✅ 支援方針の言語化
- ✅ 目標設定（長期・短期）
- ✅ 具体的支援項目の策定
- 🔴 Human in the Loop 必須（職員による確認・修正）

**実装予定**:
- DBカラム追加: `assessment_prompt_v1`, `assessment_result_v1`
- エンドポイント: POST /api/assess
- プロンプト設計: リタリコ様式を参考に

---

### Phase 4: PDF生成

**目的**: assessment_v1 から**リタリコ様式のPDF**を生成

**データフロー（想定）**:
```
POST /api/plan/generate （新規エンドポイント）
  ↓
1. DB.select() → assessment_result_v1.assessment_v1 取得
2. HTML生成（テンプレートエンジン）
3. PDF変換（weasyprint）
4. S3アップロード
5. DB.update() → plan_html, plan_pdf_url 保存
```

**実装予定**:
- DBカラム追加: `plan_html`, `plan_pdf_url`
- エンドポイント: POST /api/plan/generate
- PDF生成: weasyprint
- テンプレート: リタリコ様式HTML

---

## 🧪 テスト方法

### 標準テストデータ

**データソース**: `/Users/kaya.matsumoto/Desktop/business_interview_sessions_rows.csv`

- **session_id**: `a522ab30-77ca-4599-81b8-48bc8deca835`
- **対象**: 松本正弦（5歳、ASD、境界知能(IQ81)、白幡幼稚園）
- **transcription**: 15,255語（実際の保護者ヒアリング録音）
- **参加者**: 父・母
- **録音日**: 2026-01-13

**重要**: 本番環境データです。テストでデータが上書きされます。

### テスト実行手順

```bash
# Phase 1: 事実抽出
curl -X POST https://api.hey-watch.me/business/api/analyze \
  -H "X-API-Token: watchme-b2b-poc-2025" \
  -H "Content-Type: application/json" \
  -d '{"session_id": "a522ab30-77ca-4599-81b8-48bc8deca835"}'

# Phase 2: 事実の再構造化
curl -X POST https://api.hey-watch.me/business/api/structure-facts \
  -H "X-API-Token: watchme-b2b-poc-2025" \
  -H "Content-Type: application/json" \
  -d '{"session_id": "a522ab30-77ca-4599-81b8-48bc8deca835"}'

# Supabase Dashboardで結果確認
# - fact_extraction_result_v1
# - fact_structuring_result_v1
```

---

## 🎯 開発の優先順位

| フェーズ | 優先度 | 状態 | 進捗 |
|---------|--------|------|------|
| Phase 0: 基盤 | - | ✅ 完了 | 100% |
| Phase 1: fact_extraction | 最優先 | ✅ 完了 | 100% |
| Phase 2: fact_structuring | 高 | 🚧 実装中 | 90% (テスト中) |
| Phase 3: assessment | 高 | 🔜 次回 | 0% |
| Phase 4: PDF生成 | 中 | 📋 計画中 | 0% |
| Human in the Loop UI | 低 | 📋 計画中 | 0% |

---

## 📝 次のセッションのアクション

### 優先度1: Phase 2完成

1. ✅ テスト実行
2. 🔄 エラー修正（データ構造の互換性）
3. ⏳ 本番デプロイ完了待ち
4. ⏳ 動作確認・品質チェック

### 優先度2: Phase 3設計

1. プロンプト設計
   - リタリコ様式PDF分析
   - assessment_v1 出力構造確定
2. DBカラム追加
3. エンドポイント実装
4. テスト

---

## 📚 参考資料

- `/Users/kaya.matsumoto/projects/watchme/docs/個別支援計画/個別支援計画書（参考記載例）リタリコ.pdf`
- `/Users/kaya.matsumoto/projects/watchme/docs/個別支援計画/ヒアリング_yoridokoro_001.txt`
- `backend/services/background_tasks.py` - Phase 1-2実装
- `backend/services/prompts.py` - Phase 2プロンプト

---

## 🔮 将来の拡張

### Human in the Loop UI

**各フェーズで職員が確認・編集**:
```
Phase 1結果表示 → [編集] [承認]
Phase 2結果表示 → [編集] [承認]
Phase 3結果表示 → [編集] [承認]
Phase 4 PDF表示 → [ダウンロード] [印刷]
```

### 完全自動化（0タッチ）

**理想的なフロー**:
```
S3 Upload → Transcription → extraction → structuring → assessment → PDF
```

**現実的なフロー（当面）**:
```
S3 Upload → Transcription → extraction → structuring
  ↓
Human確認・編集
  ↓
assessment → PDF
```
