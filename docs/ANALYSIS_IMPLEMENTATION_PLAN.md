# LLM分析機能 実装計画書

**最終更新**: 2026-01-17
**対象プロジェクト**: WatchMe Business API
**現在のフェーズ**: Phase 1 - extraction_v1 完了 ✅
**次のフェーズ**: Phase 2 - 構造化サマリー生成

---

## 📋 実装状況

### ✅ Phase 0: 基盤完成（2026-01-13）
1. 録音 → S3アップロード → DB保存
2. POST /api/transcribe → Speechmatics Batch API文字起こし（話者分離）
3. `transcription` カラムに保存
4. 完全自動化（S3 Upload → Lambda → Transcription → DB保存）

### ✅ Phase 1: extraction_v1 完成（2026-01-17）

**目的**: ヒアリング文字起こしから構造化された情報を抽出

**実装内容**:
- POST /api/analyze エンドポイント（既存）
- バックグラウンド処理（threading）
- extraction_v1 プロンプト（JSON形式）
- 事前情報の自動埋め込み（subjects テーブルから取得）

**成果物**:
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
      {"summary": "対人関係の改善", "priority": 1, "confidence": "high"}
    ],
    "staff_notes": [...],
    "administrative_notes": [...],
    "unresolved_items": [
      {"summary": "受給者証取得", "reason": "自治体方針不確定"}
    ]
  }
}
```

**設計思想**:
1. ❌ **source（原文引用）は不要** - LLMが改変するリスク、法的証拠として弱い
2. ✅ **summary + confidence のみ** - 要約と信頼度で十分
3. ✅ **エビデンスは transcription_id** - 必要なら全文検索で確認
4. ✅ **判断・評価・計画は絶対にしない** - 事実のみ抽出

---

## 🏗️ アーキテクチャ設計

### データフロー（Phase 1完了）

```
S3 Upload (webm音声)
  ↓
Lambda: business-audio-upload-handler
  ↓
Speechmatics API (話者分離付き文字起こし)
  ↓
business_transcriptions テーブル保存
  ↓
POST /api/analyze ← Phase 1
  ↓
analyze_background() (threading)
  ↓
1. DB.select() → session + support_plan + subject 取得（1回のクエリ）
2. 事前情報を埋め込んだプロンプト生成
3. DB.update() → fact_extraction_prompt_v1 保存
4. GPT-4o API呼び出し
5. JSON parse → DB.update() → fact_extraction_result_v1 保存
  ↓
business_interview_sessions テーブル
  ✅ transcription: "文字起こし結果"
  ✅ fact_extraction_prompt_v1: "生成したプロンプト"
  ✅ fact_extraction_result_v1: JSONB（extraction_v1）
```

---

## 📊 テーブル設計

### 既存テーブル

**business_interview_sessions**:
```sql
id                           UUID PRIMARY KEY
facility_id                  UUID
subject_id                   UUID → subjects(subject_id)
support_plan_id              UUID → business_support_plans(id)
transcription                TEXT
transcription_metadata       JSONB
fact_extraction_prompt_v1    TEXT  -- Phase 1: 事実抽出プロンプト
fact_extraction_result_v1    JSONB -- Phase 1: 事実抽出結果
attendees                    JSONB
status                       TEXT  -- uploaded/transcribing/transcribed/analyzing/completed/failed
created_at                   TIMESTAMPTZ
updated_at                   TIMESTAMPTZ
```

**subjects**（Phase 1で拡張）:
```sql
subject_id      UUID PRIMARY KEY
name            TEXT
gender          TEXT
birth_date      DATE          -- 追加（年齢計算用）
diagnosis       TEXT[]        -- 追加（例: ["ASD", "境界知能"]）
school_name     TEXT          -- 追加（例: "白幡幼稚園"）
school_type     TEXT          -- 追加（例: "kindergarten"）
guardians       JSONB         -- 追加（父母情報）
```

**guardians JSONB 構造**:
```json
{
  "father": {"name": "松本一郎", "relationship": "父"},
  "mother": {"name": "松本花子", "relationship": "母"}
}
```

**attendees JSONB 構造**:
```json
{
  "father": true,
  "mother": true
}
```

---

## 🔧 Phase 1 実装の詳細

### 1. プロンプト設計

**ファイル**: `backend/services/background_tasks.py:164-279`

**プロンプト構造**:
```
【事前情報】
■ 支援対象児
- 氏名: {subject.name}
- 年齢: {計算値}歳
- 性別: {subject.gender}
- 診断: {subject.diagnosis}
- 通園先: {subject.school_name}

■ 参加者
- 保護者: {attendees から生成}

■ インタビュアー
- 氏名: 山田太郎（児発管）

■ 実施情報
- 日時: {session.recorded_at}

【重要なルール】
- 判断・評価・目標設定・支援計画の作成は絶対にしない
- 事実・発言・観察内容のみを抽出
- 原文の引用は不要（要約のみ）
- 曖昧な場合は confidence を "low" にする

【出力形式】
JSON形式（11カテゴリ）
```

### 2. バグ修正履歴（2026-01-17）

**発見・修正した10個の問題**:

| # | 問題 | 重要度 | 修正内容 |
|---|------|--------|---------|
| 1 | datetime重複インポート | 🔴 Critical | Line 165の`from datetime import datetime`を削除 |
| 2 | 変数スコープエラー | 🔴 Critical | 変数初期化をifブロック外に移動 |
| 3 | 変数未初期化 | 🔴 Critical | subject/attendees/age_textをデフォルト値で初期化 |
| 4 | 保護者表示の論理エラー | 🟡 Medium | `("父" if ... else "") + ... or "不明"`に修正 |
| 5 | Bare except | 🟡 Medium | `except (ValueError, TypeError, KeyError)`に修正 |
| 6 | 重複DBクエリ | 🟡 Medium | 2回のクエリを1回に統合 |
| 7 | 変数名の不一致 | 🟡 Medium | `session`に統一 |
| 8 | JSON構造エラー | 🔴 Critical | `json.loads()`でパース処理追加 |
| 9 | transcription参照 | 🟢 Low | 問題なし（確認済み） |
| 10 | LLMエラーハンドリング | 🟡 Medium | try-except追加、空レスポンス検証 |

**根本原因**:
- Pythonの関数スコープの仕様：関数内のどこかで変数を代入すると、その関数全体でローカル変数として扱われる
- ローカルインポート（Line 165）により、グローバルの`datetime`が上書きされ`UnboundLocalError`が発生

**教訓**:
1. ✅ インポートは必ずファイル冒頭に集約
2. ✅ データ取得は1回のクエリで完結させる
3. ✅ エラーは必ず記録する（Silent failureの禁止）
4. ✅ 変数は使用前に初期化
5. ✅ **デプロイ後は必ず `docker logs` でエラー確認**

---

## 🧪 テスト方法（実データ使用）

### 標準テストデータ

**データソース**: `/Users/kaya.matsumoto/Desktop/business_interview_sessions_rows.csv`

- **session_id**: `a522ab30-77ca-4599-81b8-48bc8deca835`
- **対象**: 松本正弦（5歳、ASD、境界知能(IQ81)、白幡幼稚園）
- **transcription**: 15,255語（実際の保護者ヒアリング録音の文字起こし）
- **参加者**: 父・母
- **インタビュアー**: 山田太郎（児発管）
- **録音日**: 2026-01-13

**重要**: このデータは本番環境で実際に使用しているデータです。テストはこのデータで行い、精度を判定します。

### テスト実行コマンド

```bash
# Phase 1: extraction_v1 のテスト
curl -X POST https://api.hey-watch.me/business/api/analyze \
  -H "X-API-Token: watchme-b2b-poc-2025" \
  -H "Content-Type: application/json" \
  -d '{"session_id": "a522ab30-77ca-4599-81b8-48bc8deca835"}'
```

**注意**:
- 本番環境のデータが**上書き**されます
- テスト後は`fact_extraction_result_v1`カラムの内容を確認して精度を判定してください

### テスト結果（2026-01-17）

```json
{
  "status": "completed",
  "updated_at": "2026-01-17T15:34:09.155037+00:00",
  "fact_extraction_result_v1": {
    "extraction_v1": {
      "basic_info": [5件],
      "current_state": [1件],
      "strengths": [1件],
      "challenges": [1件],
      "physical_sensory": [1件],
      "medical_development": [1件],
      "family_environment": [1件],
      "parent_intentions": [2件、priority付き],
      "staff_notes": [1件],
      "administrative_notes": [1件],
      "unresolved_items": [1件、reason付き]
    }
  }
}
```

✅ **全項目が正しく抽出された**

---

## 🚧 未実装（Phase 2以降）

### Phase 2: 構造化サマリー生成

**目的**: extraction_v1 から個別支援計画の骨子を生成

**入力**: extraction_v1（JSON）
**出力**: structured_summary（JSON）

**期待される出力**:
```json
{
  "support_policy": {
    "overview": "〇〇さんは、視覚的な手掛かりの方が理解しやすいと見立てています...",
    "key_approaches": [
      "視覚的スケジュールの活用",
      "事前説明の徹底"
    ]
  },
  "long_term_goals": ["集団の中で大きなトラブルなく過ごせる"],
  "short_term_goals": [
    {
      "domain": "人間関係・社会性",
      "goal": "嫌な時に手が出る前に、身振りやことばで伝える",
      "priority": 1,
      "timeline": "6か月後"
    }
  ],
  "support_items": [
    {
      "category": "人間関係・社会性",
      "target": "友達との適切なやり取り",
      "methods": ["具体的な伝え方のモデルを大人が示す"],
      "staff": "心理担当職員",
      "priority": 1,
      "timeline": "6か月後"
    }
  ]
}
```

**実装方針**:
- 新規エンドポイント: POST /api/summary/structured
- 入力: extraction_id
- LLMプロンプト: extraction_v1 から支援方針・目標を生成
- DBテーブル: business_structured_summaries

---

### Phase 3: フォーマットマッピング

**目的**: structured_summary からリタリコ様式の個別支援計画書（PDF）を生成

**入力**: structured_summary（JSON）
**出力**: 個別支援計画書（HTML/PDF）

**参考**: `/Users/kaya.matsumoto/projects/watchme/docs/個別支援計画/個別支援計画書（参考記載例）リタリコ.pdf`

**実装方針**:
- 新規エンドポイント: POST /api/plan/generate
- PDF生成: `weasyprint` または `reportlab`
- DBテーブル: business_support_plans（plan_html, plan_pdf_url）

---

## 📝 次のセッションのアクション

### Phase 2 実装タスク

1. **プロンプト設計**
   - extraction_v1 → structured_summary のプロンプト作成
   - 参考資料：リタリコ個別支援計画書

2. **DBテーブル作成**
   ```sql
   CREATE TABLE business_structured_summaries (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     extraction_id UUID REFERENCES business_extractions(id),
     summary_data JSONB NOT NULL,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );
   ```

3. **APIエンドポイント実装**
   - POST /api/summary/structured
   - バックグラウンド処理（threading）

4. **テスト**
   - extraction_v1 のデータを使って structured_summary 生成
   - 出力の妥当性確認

---

## 🔮 将来の拡張

### Human in the Loop UI

**Phase 1-3 の各段階で職員が確認・編集できるUI**:

```
1. extraction_v1 表示
   [課題] 対人関係での衝動的行動 (confidence: high)
   [編集] [承認] ボタン

2. structured_summary 表示
   [支援方針] 視覚的スケジュールの活用...
   [編集] [承認] ボタン

3. 最終PDF表示
   [ダウンロード] [印刷] ボタン
```

### 完全自動化（0タッチ）

**理想的なフロー**:
```
S3 Upload
  ↓（自動）
Transcription
  ↓（自動）
extraction_v1
  ↓（自動）
structured_summary
  ↓（自動）
PDF生成
  ↓
✅ 個別支援計画書完成
```

---

## 📚 参考資料

- `/Users/kaya.matsumoto/projects/watchme/docs/個別支援計画/個別支援計画書（参考記載例）リタリコ.pdf`
- `/Users/kaya.matsumoto/projects/watchme/docs/個別支援計画/ヒアリング_yoridokoro_001.txt`
- `/Users/kaya.matsumoto/projects/watchme/business/backend/services/background_tasks.py`

---

## 🎯 開発の優先順位

| フェーズ | 優先度 | 状態 | 備考 |
|---------|--------|------|------|
| Phase 0: 基盤 | - | ✅ 完了 | S3 → Transcription |
| Phase 1: extraction_v1 | 最優先 | ✅ 完了 | 情報抽出 |
| Phase 2: structured_summary | 高 | 🚧 未着手 | 支援計画骨子生成 |
| Phase 3: PDF生成 | 中 | 🚧 未着手 | 最終出力 |
| Human in the Loop UI | 低 | 🚧 未着手 | 編集機能 |
| 完全自動化 | 最低 | 🚧 未着手 | 0タッチ |

**まずは Phase 2 の実装に集中する**
