# LLM分析機能 実装計画書

**作成日**: 2026-01-11
**対象プロジェクト**: WatchMe Business API
**現在の状況**: 文字起こし完了
**次のステップ**: GPT-4による個別支援計画生成

---

## 📋 現状

### ✅ 完了済み
1. 録音 → S3アップロード → DB保存
2. POST /api/transcribe → Deepgram Nova-2文字起こし
3. transcriptionカラムに保存

### 🎯 次の実装
GPT-4で個別支援計画書を生成

---

## 🏗️ アーキテクチャ設計

### データフロー

```
Business Backend (:8052)
  ↓ POST /api/analyze (新規エンドポイント)
  ↓ 1. DB.select() → transcription取得
  ↓ 2. プロンプト生成（services/prompt_generator.py）
  ↓ 3. DB.update() → analysis_prompt保存
  ↓ 4. GPT-4 API呼び出し
  ↓ 5. DB.update() → analysis_result保存
Supabase
  ✅ transcription: "文字起こし結果"
  ✅ analysis_prompt: "生成したプロンプト"（新規）
  ✅ analysis_result: JSONB（新規）
```

### なぜプロンプトをDB保存するか

**理由**:
1. **試行錯誤が必要**: 1時間の音声 → 大量テキスト → プロンプト最適化が重要
2. **デバッグしやすい**: 何を送ったか見える
3. **改善しやすい**: プロンプトの履歴が残る
4. **将来の多段階処理**: Phase 2で分類→分析→まとめの複数ステップに進化

---

## 📊 テーブル設計

### DBカラム追加

```sql
ALTER TABLE public.business_interview_sessions
ADD COLUMN analysis_prompt TEXT,
ADD COLUMN analysis_result JSONB;

COMMENT ON COLUMN business_interview_sessions.analysis_prompt IS 'Generated prompt sent to GPT-4';
COMMENT ON COLUMN business_interview_sessions.analysis_result IS 'GPT-4 analysis result in JSON format';
```

### analysis_result のJSON構造（想定）

```json
{
  "child_intention": "本人の意向",
  "family_intention": "家族の意向",
  "general_policy": "総合的な支援方針",
  "current_status": "現在の状況",
  "long_term_goal": "長期目標",
  "short_term_goals": [
    {
      "goal": "短期目標1",
      "support_details": "支援内容"
    }
  ],
  "generated_at": "2026-01-11T12:00:00Z",
  "model": "gpt-4o",
  "processing_time": 3.45
}
```

---

## 🔧 実装ステップ

### Step 1: DBカラム追加

**Supabase SQL Editor**で実行:
```sql
ALTER TABLE public.business_interview_sessions
ADD COLUMN analysis_prompt TEXT,
ADD COLUMN analysis_result JSONB;
```

### Step 2: プロンプトジェネレーター作成

**ファイル**: `backend/services/prompt_generator.py`

```python
def generate_support_plan_prompt(transcription: str) -> str:
    """
    Generate prompt for individual support plan

    Args:
        transcription: Interview transcription text

    Returns:
        Formatted prompt for GPT-4
    """

    prompt = f"""あなたは児童発達支援の専門家です。
保護者とのヒアリング内容から、個別支援計画書を作成してください。

# ヒアリング内容
{transcription}

# 出力形式（JSON）
以下の形式でJSONを出力してください：

{{
  "child_intention": "本人の意向（子どもが何を望んでいるか）",
  "family_intention": "家族の意向（保護者が何を望んでいるか）",
  "general_policy": "総合的な支援方針",
  "current_status": "現在の状況分析",
  "long_term_goal": "長期目標（6ヶ月程度）",
  "short_term_goals": [
    {{
      "goal": "短期目標（1-2ヶ月）",
      "support_details": "具体的な支援内容"
    }}
  ]
}}

# 重要
- 専門用語は適度に使用
- 具体的で実現可能な目標を設定
- ヒアリング内容に基づいて記述
"""

    return prompt
```

### Step 3: app.pyにエンドポイント追加

**追加するモデル**:
```python
class AnalyzeRequest(BaseModel):
    session_id: str

class AnalyzeResponse(BaseModel):
    success: bool
    session_id: str
    analysis_result: dict
    processing_time: float
    message: str
```

**エンドポイント**:
```python
@app.post("/api/analyze", response_model=AnalyzeResponse)
async def analyze_interview(
    request: AnalyzeRequest,
    x_api_token: str = Header(None, alias="X-API-Token")
):
    # 1. Get transcription from DB
    # 2. Generate prompt
    # 3. Save prompt to DB
    # 4. Call GPT-4
    # 5. Save result to DB
    # 6. Return response
```

### Step 4: requirements.txt確認

**既にインストール済み**:
- `openai==1.14.0` ✅

### Step 5: 環境変数確認

**既に設定済み（OPENAI_API_KEY）** - 確認必要

---

## 🧪 テスト計画

### ローカルテスト
```bash
# 構文チェック
python3 -m py_compile backend/services/prompt_generator.py
python3 -m py_compile backend/app.py
```

### 本番テスト
```bash
# 1. 文字起こし実行
curl -X POST "https://api.hey-watch.me/business/api/transcribe" \
  -H "Content-Type: application/json" \
  -H "X-API-Token: watchme-b2b-poc-2025" \
  -d '{"session_id": "SESSION_ID"}'

# 2. 分析実行
curl -X POST "https://api.hey-watch.me/business/api/analyze" \
  -H "Content-Type: application/json" \
  -H "X-API-Token: watchme-b2b-poc-2025" \
  -d '{"session_id": "SESSION_ID"}'

# 3. 結果確認
curl -X GET "https://api.hey-watch.me/business/api/sessions/SESSION_ID" \
  -H "X-API-Token: watchme-b2b-poc-2025"
```

---

## 📝 次のセッションのアクション

1. **Supabase SQL Editor**でカラム追加
2. `services/prompt_generator.py`作成
3. `app.py`に`/api/analyze`エンドポイント追加
4. OPENAI_API_KEY環境変数確認
5. デプロイ＆テスト

---

## 🔮 Phase 2への進化（将来）

現在は1回のGPT-4呼び出しですが、将来は多段階処理に進化：

```
Step 1: 情報分類
  transcription → GPT-4 → 構造化データ

Step 2: 詳細分析
  構造化データ → GPT-4 → 支援計画骨子

Step 3: 計画書生成
  支援計画骨子 → GPT-4 → 最終計画書
```

これにより、1時間の音声データも高精度に処理可能。
