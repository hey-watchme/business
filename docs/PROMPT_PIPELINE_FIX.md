# プロンプトパイプライン修正 - 引き継ぎドキュメント

**作成日**: 2026-02-11
**目的**: プロンプトの生成・保存・使用フローの根本的な修正

---

## 問題の本質

**プロンプトを生成しても DB に保存されないため、実行時に使われない。**

### 現在の壊れたフロー

```
[プロンプト生成ボタン] → GET /api/sessions/{id}/generate-prompt/phase2
  → バックエンドでプロンプト生成
  → レスポンスで返すだけ（DBに保存しない）
  → フロントエンドの React state (editingPrompt) に一時保存
  → ブラウザを閉じたら消える

[Phase再実行ボタン] → POST /api/structure-facts (use_custom_prompt=false)
  → バックエンドで新しくプロンプトを生成（build_*_prompt()）
  → DBに保存してLLM実行
  → ※ユーザーが見ていたプロンプトとは別物が使われる
```

### あるべきフロー

```
[プロンプト生成ボタン] → プロンプト生成 → DBに即座に保存 → UIに表示
  → ユーザーが内容を確認・必要なら編集 → 編集もDBに保存

[Phase再実行ボタン] → DBに保存されているプロンプトを使ってLLM実行
  → use_custom_prompt=true で実行
```

---

## 修正対象ファイルと変更内容

### 修正1: プロンプト生成時にDBに保存する

**ファイル**: `backend/app.py`

**対象エンドポイント**（3箇所）:
- `GET /api/sessions/{session_id}/generate-prompt/phase1` (L826-919)
- `GET /api/sessions/{session_id}/generate-prompt/phase2` (L928-983)
- `GET /api/sessions/{session_id}/generate-prompt/phase3` (存在する場合)

**現在の実装**:
```python
# app.py L905-919 (phase1の例)
prompt = build_fact_extraction_prompt(...)
return {
    "success": True,
    "session_id": session_id,
    "prompt": prompt  # 返すだけ、DBに保存しない
}
```

**修正後**:
```python
prompt = build_fact_extraction_prompt(...)

# DBに保存する
supabase.table('business_interview_sessions').update({
    'fact_extraction_prompt_v1': prompt,
    'updated_at': datetime.now().isoformat()
}).eq('id', session_id).execute()

return {
    "success": True,
    "session_id": session_id,
    "prompt": prompt
}
```

**各Phaseの保存先カラム**:
| Phase | プロンプト保存カラム |
|-------|---------------------|
| Phase 1 | `fact_extraction_prompt_v1` |
| Phase 2 | `fact_structuring_prompt_v1` |
| Phase 3 | `assessment_prompt_v1` |

### 修正2: Phase再実行時にDBのプロンプトを使う

**ファイル**: `frontend/src/pages/SupportPlanCreate.tsx`

**対象箇所**: 個別Phase再実行ロジック (L451-460)

**現在の実装**（前回のセッションで false に変更済み）:
```typescript
if (phase === 1) {
  await api.triggerPhase1(sessionId, false, ...);  // ← false: 新規生成
} else if (phase === 2) {
  await api.triggerPhase2(sessionId, false, ...);
} else if (phase === 3) {
  await api.triggerPhase3(sessionId, false, ...);
}
```

**修正後**: `true` に戻す（DBに保存されたプロンプトを使用）
```typescript
if (phase === 1) {
  await api.triggerPhase1(sessionId, true, ...);  // ← true: DB保存済みを使用
} else if (phase === 2) {
  await api.triggerPhase2(sessionId, true, ...);
} else if (phase === 3) {
  await api.triggerPhase3(sessionId, true, ...);
}
```

**注意**: 修正1（生成時にDB保存）を先に実装してから、この変更を行うこと。
順序を間違えると、旧プロンプトがDBに残ったまま使われる。

### 修正3: Phase 2タブ下部の「次へ」ボタンのフロー

**ファイル**: `frontend/src/pages/SupportPlanCreate.tsx`

Phase 1タブの「次へ: 事実分析プロンプト生成」ボタン（前回のセッションで追加）:
- `handleGeneratePhase2Prompt` を呼ぶ
- この関数は `api.generatePhase2Prompt(sessionId)` を呼ぶ
- 修正1により、この時点でプロンプトがDBに保存される
- Phase 2タブに自動遷移してプロンプトが表示される

同様に Phase 2タブの「次へ」ボタン（Phase 3プロンプト生成）も同じフロー。

---

## 前回セッションで完了した変更

### 1. タブの順序・ラベル変更
- 0: アセスメント → 1: 事実抽出 → 2: 事実分析 → 3: 生成 → 4: 個別支援計画書
- デフォルトタブを 'assessment' に変更

### 2. Phase 2プロンプト全面書き換え（アノテーション方式）
- `backend/services/prompts.py` の `build_fact_structuring_prompt()`
- 旧: 「事実の再配置・整理」→ 新: 「原文保持 + 専門分析の外付け」
- 出力キー: `fact_clusters_v1` → `annotated_facts_v1`
- プロンプト言語: 日本語

### 3. Phase2Display.tsx 全面書き換え
- `frontend/src/components/Phase2Display.tsx`
- 新構造 `annotated_facts_v1` に対応
- 5領域ごとのグルーピング表示
- 旧データ(`fact_clusters_v1`)検出時のフォールバック表示

### 4. Phase 3プロンプト書き換え
- `backend/services/prompts.py` の `build_assessment_prompt()`
- Phase 1直接参照 → Phase 2の `annotated_facts_v1` を使用
- プロンプト言語: 英語（出力は日本語指定）→ **要日本語化**

### 5. Phase 3パイプライン修正
- `backend/services/background_tasks.py`: `input_selector` を `fact_structuring_result_v1` に変更
- `backend/app.py`: バリデーションキーを `annotated_facts_v1` に変更

### 6. Phase 1下部ボタン変更
- 「Phase 3 プロンプト生成」→「次へ: 事実分析プロンプト生成」に変更
- `handleGeneratePhase3Prompt` → `handleGeneratePhase2Prompt` に変更

### 7. CLAUDE.md にローカルサーバー再起動ルール追加

---

## 残タスク

### 最優先: プロンプト保存フロー修正
1. `app.py` の generate-prompt エンドポイント3箇所でDB保存を追加
2. `SupportPlanCreate.tsx` の Phase再実行を `use_custom_prompt=true` に戻す

### その他
- Phase 3プロンプト (`build_assessment_prompt`) の日本語化
- Phase 2タブ下部に「次へ: 生成プロンプト作成」ボタンの確認
- 仕様書 (`INDIVIDUAL_SUPPORT_PLAN_SPEC.md`) の更新（annotated_facts_v1構造の反映）

---

## 関連ファイル一覧

| ファイル | 役割 |
|---------|------|
| `backend/app.py` | APIエンドポイント定義（generate-prompt, structure-facts, assess等） |
| `backend/services/prompts.py` | プロンプト生成関数（build_fact_*_prompt, build_assessment_prompt） |
| `backend/services/background_tasks.py` | Phase実行のバックグラウンドタスク |
| `backend/services/llm_pipeline.py` | 共通LLMパイプライン（execute_llm_phase, validate_previous_phase_result） |
| `frontend/src/pages/SupportPlanCreate.tsx` | メインUI（タブ、プロンプト表示、再実行ボタン） |
| `frontend/src/components/Phase2Display.tsx` | Phase 2結果表示コンポーネント |
| `frontend/src/api/client.ts` | API呼び出し関数 |

## llm_pipeline.py の重要な関数

### execute_llm_phase()
```python
def execute_llm_phase(
    session_id, supabase, llm_service,
    phase_name,          # "fact_extraction" / "fact_structuring" / "assessment"
    prompt_builder,      # build_*_prompt 関数
    input_selector,      # 入力カラム名
    output_column,       # 出力カラム名
    prompt_column,       # プロンプト保存カラム名
    model_used_column,   # モデル記録カラム名
    use_stored_prompt    # True: DB保存済みプロンプト使用, False: 新規生成
):
```
- `use_stored_prompt=True`: DBの `prompt_column` から読み込んで使用
- `use_stored_prompt=False`: `prompt_builder()` で新規生成 → DBに保存 → LLM実行
