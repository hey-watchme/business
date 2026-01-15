# 実際のデータベーススキーマ（正式版）

生成日: 2026-01-15
取得方法: 本番環境から直接取得

## ⚠️ 重要な発見
- **child_id ではなく subject_id を使用**
- 多くの分析用カラムが既に存在

## business_interview_sessions

| カラム名 | データ型 | 説明 |
|---------|---------|------|
| id | str (UUID) | プライマリキー |
| facility_id | str (UUID) | 施設ID |
| **subject_id** | str (UUID) | **子供ID（child_idではない！）** |
| s3_audio_path | str | S3上の音声ファイルパス |
| transcription | str/None | 文字起こし結果 |
| status | str | 処理状態 |
| duration_seconds | int | 録音時間（秒） |
| staff_id | str/None | スタッフID |
| recorded_at | str (timestamp) | 録音日時 |
| created_at | str (timestamp) | 作成日時 |
| updated_at | str (timestamp) | 更新日時 |
| analysis_prompt | str/None | 分析用プロンプト |
| analysis_result | str/None | LLM分析結果 |
| error_message | str/None | エラーメッセージ |
| transcription_metadata | dict | 文字起こしメタデータ |
| support_plan_id | str/None | 支援計画ID |
| session_type | str/None | セッションタイプ |
| session_number | int | セッション番号 |

## business_facilities

| カラム名 | データ型 | 説明 |
|---------|---------|------|
| id | str (UUID) | プライマリキー |
| name | str | 施設名 |
| created_at | str (timestamp) | 作成日時 |

## business_children

| カラム名 | データ型 | 説明 |
|---------|---------|------|
| id | str (UUID) | プライマリキー |
| facility_id | str (UUID) | 施設ID（外部キー） |
| name | str | 子供の名前 |
| created_at | str (timestamp) | 作成日時 |

## APIとDBのマッピング

```python
# APIパラメータ → DBカラム
{
    "child_id": "subject_id",  # APIではchild_id、DBではsubject_id
    "facility_id": "facility_id",  # そのまま
}
```

## 今後の注意点
1. APIインターフェースは `child_id` を維持（後方互換性）
2. 内部実装では `subject_id` にマッピング
3. 新機能追加時は既存カラムを確認（重複作成を避ける）