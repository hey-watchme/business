# 次のセッションへの引き継ぎ事項

**最終更新**: 2026-01-18 23:45 JST
**現在の状態**: Phase 0-3 完全稼働、管理画面実装待ち

---

## ✅ 現在の完成状況

### Phase 0-3 完全実装完了

| Phase | 状態 | 処理時間 | エンドポイント |
|-------|------|---------|--------------|
| Phase 0 | ✅ 稼働中 | 約4.5分 | Lambda自動実行 |
| Phase 1 | ✅ 稼働中 | 5-7秒 | POST /api/analyze |
| Phase 2 | ✅ 稼働中 | 6-7秒 | POST /api/structure-facts |
| Phase 3 | ✅ 稼働中 | 17秒 | POST /api/assess |

**テスト結果**: すべて成功（session_id: `a522ab30-77ca-4599-81b8-48bc8deca835`）

### データベース構造

**business_interview_sessions テーブル**に以下のカラムが存在：

```
-- Phase 0
transcription                TEXT
transcription_metadata       JSONB

-- Phase 1
fact_extraction_prompt_v1    TEXT
fact_extraction_result_v1    JSONB (extraction_v1)

-- Phase 2
fact_structuring_prompt_v1   TEXT
fact_structuring_result_v1   JSONB (fact_clusters_v1)

-- Phase 3
assessment_prompt_v1         TEXT
assessment_result_v1         JSONB (assessment_v1)
```

---

## 🎯 次のタスク: 管理画面に全プロセスを表示

### 目的

個別支援計画の詳細画面に、**3つのパイプライン（Phase 1-3）の結果とプロセスをすべて表示**する。

### 要件

1. **すべてのデータを一旦表示**
   - Phase 1の結果（extraction_v1）
   - Phase 2の結果（fact_clusters_v1）
   - Phase 3の結果（assessment_v1）
   - **各フェーズのプロンプトも表示**（`*_prompt_v1`カラム）

2. **段階的な整理**
   - まずは全データを表示して、どう見えるか確認
   - その後、不要な部分は非表示・下階層化
   - 最終的に見やすい形に調整

3. **アプローチ**
   - 完成形を目指さず、途中経過として全部出す
   - 実際に見てから判断する

### 実装の方針

#### フロントエンド（React）

**ファイル**: `frontend/src/pages/SessionDetail.tsx` （想定）

**表示内容**:
```
📄 Session Detail

基本情報
- セッションID
- 対象児童
- 録音日時
- ステータス

Phase 0: 文字起こし
- transcription（折りたたみ可）
- 文字数

Phase 1: 事実抽出（extraction_v1）
├─ プロンプト表示（折りたたみ可）
└─ 結果
   ├─ basic_info
   ├─ strengths
   ├─ challenges
   └─ ... (全11カテゴリ)

Phase 2: 事実整理（fact_clusters_v1）
├─ プロンプト表示（折りたたみ可）
└─ 結果
   ├─ child_profile
   ├─ strengths_facts
   ├─ challenges_facts
   └─ ... (全11カテゴリ)

Phase 3: 個別支援計画（assessment_v1）
├─ プロンプト表示（折りたたみ可）
└─ 結果
   ├─ support_policy
   ├─ long_term_goal
   ├─ short_term_goals
   ├─ support_items（5領域）
   ├─ family_support
   └─ transition_support
```

#### バックエンド（API）

**必要なエンドポイント**:

```
GET /api/sessions/{session_id}/full-detail
```

**レスポンス例**:
```json
{
  "session": {
    "id": "...",
    "subject_id": "...",
    "recorded_at": "...",
    "status": "completed"
  },
  "phase0": {
    "transcription": "...",
    "metadata": {...}
  },
  "phase1": {
    "prompt": "...",
    "result": {
      "extraction_v1": {...}
    }
  },
  "phase2": {
    "prompt": "...",
    "result": {
      "fact_clusters_v1": {...}
    }
  },
  "phase3": {
    "prompt": "...",
    "result": {
      "assessment_v1": {...}
    }
  }
}
```

### 実装の優先順位

1. **バックエンドAPI実装**（30分）
   - GET /api/sessions/{session_id}/full-detail エンドポイント追加
   - すべてのカラムを返す
   - プロンプトも含める

2. **フロントエンド実装**（2-3時間）
   - SessionDetail ページ作成
   - Accordion/Collapse コンポーネントで折りたたみ表示
   - JSON Viewer コンポーネント（react-json-view等）
   - プロンプト表示（code block）

3. **確認・調整**（1時間）
   - 実際に見て判断
   - 不要な部分を非表示化
   - UIの微調整

---

## 📁 関連ファイル

### ドキュメント

- **技術仕様書**: `/Users/kaya.matsumoto/projects/watchme/business/docs/INDIVIDUAL_SUPPORT_PLAN_SPEC.md`
- **README**: `/Users/kaya.matsumoto/projects/watchme/business/README.md`

### バックエンド

- **API**: `backend/app.py`
- **バックグラウンド処理**: `backend/services/background_tasks.py`
- **プロンプト**: `backend/services/prompts.py`
- **共通処理**: `backend/services/llm_pipeline.py`

### フロントエンド

- **Pages**: `frontend/src/pages/` （SessionDetail.tsx を追加予定）
- **API Client**: `frontend/src/lib/api.ts` （API呼び出し定義）

### データベース

- **テーブル**: `business_interview_sessions`
- **テストデータ session_id**: `a522ab30-77ca-4599-81b8-48bc8deca835`

---

## 💡 実装のヒント

### 1. バックエンドAPI実装例

```python
@app.get("/api/sessions/{session_id}/full-detail")
async def get_session_full_detail(
    session_id: str,
    x_api_token: str = Header(None, alias="X-API-Token")
):
    """
    Get full session details including all phases
    """
    if x_api_token != API_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid API token")

    result = supabase.table('business_interview_sessions')\
        .select('*')\
        .eq('id', session_id)\
        .single()\
        .execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Session not found")

    session = result.data

    return {
        "session": {
            "id": session.get('id'),
            "subject_id": session.get('subject_id'),
            "recorded_at": session.get('recorded_at'),
            "status": session.get('status'),
            "duration_seconds": session.get('duration_seconds')
        },
        "phase0": {
            "transcription": session.get('transcription'),
            "metadata": session.get('transcription_metadata')
        },
        "phase1": {
            "prompt": session.get('fact_extraction_prompt_v1'),
            "result": session.get('fact_extraction_result_v1')
        },
        "phase2": {
            "prompt": session.get('fact_structuring_prompt_v1'),
            "result": session.get('fact_structuring_result_v1')
        },
        "phase3": {
            "prompt": session.get('assessment_prompt_v1'),
            "result": session.get('assessment_result_v1')
        }
    }
```

### 2. フロントエンド実装例

```tsx
// frontend/src/pages/SessionDetail.tsx
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import ReactJson from 'react-json-view';

export default function SessionDetail() {
  const { sessionId } = useParams();
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch(`/api/sessions/${sessionId}/full-detail`, {
      headers: { 'X-API-Token': 'watchme-b2b-poc-2025' }
    })
      .then(res => res.json())
      .then(setData);
  }, [sessionId]);

  if (!data) return <div>Loading...</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Session Detail</h1>

      {/* Phase 0 */}
      <details className="border p-4 rounded">
        <summary className="font-bold cursor-pointer">
          Phase 0: 文字起こし
        </summary>
        <pre className="mt-4 whitespace-pre-wrap">
          {data.phase0.transcription}
        </pre>
      </details>

      {/* Phase 1 */}
      <details className="border p-4 rounded">
        <summary className="font-bold cursor-pointer">
          Phase 1: 事実抽出
        </summary>
        <details className="mt-4">
          <summary>プロンプト表示</summary>
          <pre className="mt-2 text-xs bg-gray-100 p-2">
            {data.phase1.prompt}
          </pre>
        </details>
        <ReactJson
          src={data.phase1.result}
          collapsed={1}
          displayDataTypes={false}
        />
      </details>

      {/* Phase 2, Phase 3 も同様の構造 */}
    </div>
  );
}
```

### 3. 必要なnpmパッケージ

```bash
npm install react-json-view
```

---

## ⚠️ 注意事項

1. **プロンプトは長文**
   - Phase 3のプロンプトは特に長い（数千文字）
   - デフォルトで折りたたみ表示必須

2. **JSONデータの表示**
   - `react-json-view` 等のライブラリを使用
   - 折りたたみ・展開機能必須

3. **パフォーマンス**
   - 初回は全データ取得で問題なし
   - 将来的にはページング・遅延読み込みを検討

4. **デザイン**
   - 完成度は気にしない
   - まずは全部見えることが重要

---

## 🚀 次のステップ（管理画面実装後）

1. **Phase 4: PDF生成**
   - assessment_v1 → リタリコ様式PDF
   - HTML生成（Jinja2）
   - PDF変換（weasyprint）

2. **Human in the Loop UI**
   - 各フェーズの結果を編集可能に
   - 承認フロー

3. **完全自動化**
   - S3アップロード → Phase 3まで自動実行

---

## 📊 現在の進捗

**全体進捗**: 75%

- ✅ Phase 0-3 実装・テスト完了
- ✅ 技術仕様書完成
- 🔜 管理画面実装（次タスク）
- 📋 Phase 4 PDF生成（未着手）

---

## 📝 重要なメモ

- **DRY原則**: Phase 1-3は統一パターン（各約30行）
- **共通処理**: `llm_pipeline.py` の `execute_llm_phase()`
- **LLMモデル**: すべて OpenAI gpt-4o
- **コスト**: 約$0.18/セッション
- **処理時間**: Phase 0-3で約5分30秒

---

**次のセッション開始時**: まずバックエンドAPIエンドポイント追加から着手してください。
