# SQLマイグレーション実行手順

最終更新: 2026-01-14

## ⚠️ 重要事項

WatchMeプロジェクトでは以下のルールが絶対です：
- **`auth.users` への直接参照は禁止**
- **すべて `public.users` を使用する**
- **RLSポリシーで `auth.uid()` を使用するのは正しい**（Supabase認証関数）

## 📁 マイグレーションファイル

| ファイル | 説明 | 実行順 |
|---------|------|--------|
| `000_base_tables.sql` | 基本テーブル作成（users, subjects, facilities等） | 1 |
| `001a_alter_existing_tables.sql` | 既存テーブルへのカラム追加 | 2 |
| `001b_support_plans_tables.sql` | 新規テーブル作成（business_support_plans等） | 3 |

## 🚀 実行手順

### 1. Supabase SQLエディタにアクセス
1. [Supabase Dashboard](https://app.supabase.com) にログイン
2. 該当プロジェクトを選択
3. 左メニューから「SQL Editor」を選択

### 2. マイグレーションの実行

**⚠️ 必ずこの順序で実行してください：**

#### Step 1: 基本テーブルの作成（既に実行済みならスキップ）
```sql
-- 000_base_tables.sql の内容を実行
-- ✅ 前回のセッションで実行済みの場合はスキップ
```

#### Step 2: 既存テーブルの拡張
```sql
-- 001a_alter_existing_tables.sql の内容をコピー&ペースト
-- public.usersテーブルにroleとfacility_idカラムを追加
-- business_interview_sessionsテーブルを拡張
```

#### Step 3: 新規テーブル作成
```sql
-- 001b_support_plans_tables.sql の内容をコピー&ペースト
-- business_support_plansテーブルを作成
-- subject_relationsテーブルを作成
-- ビューを作成
```

## 🔍 実行前の確認事項

### テーブルの存在確認
```sql
-- public.users テーブルの確認
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'users';

-- public.subjects テーブルの確認
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'subjects';

-- public.facilities テーブルの確認
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'facilities';
```

## ❌ よくあるエラーと対処法

### エラー: column "facility_id" does not exist
**原因**: `001a_alter_existing_tables.sql` を実行せずに `001b_support_plans_tables.sql` を実行した

**対処**:
1. まず `001a_alter_existing_tables.sql` を実行
2. その後 `001b_support_plans_tables.sql` を実行

### エラー: relation "users" does not exist
**原因**: スキーマが指定されていない、または `auth.users` を参照しようとしている

**対処**: すべての参照を `public.users` に修正済み

### エラー: duplicate key value violates unique constraint
**原因**: 既に同じマイグレーションが実行されている

**対処**: 既存のデータを確認し、必要に応じて `IF NOT EXISTS` 句を活用

## ✅ 実行後の確認

### 作成されたテーブルの確認
```sql
-- business_support_plans テーブル
SELECT * FROM business_support_plans LIMIT 1;

-- subject_relations テーブル
SELECT * FROM subject_relations LIMIT 1;

-- ビューの確認
SELECT * FROM v_support_plans_with_sessions LIMIT 1;
SELECT * FROM v_user_subjects LIMIT 1;
```

### カラムの確認
```sql
-- public.users の新しいカラム確認
SELECT user_id, role, facility_id
FROM public.users
LIMIT 5;

-- business_interview_sessions の新しいカラム確認
SELECT id, support_plan_id, session_type, subject_id
FROM business_interview_sessions
LIMIT 5;
```

## 📝 注意事項

1. **本番環境での実行前にバックアップを取る**
2. **開発環境で十分にテストしてから本番に適用**
3. **RLSポリシーが正しく設定されていることを確認**
4. **`auth.uid()` は現在ログイン中のユーザーIDを返すSupabase関数**

## 🔄 ロールバック手順

万が一問題が発生した場合：

```sql
-- 新規作成したテーブルを削除
DROP TABLE IF EXISTS business_support_plans CASCADE;
DROP TABLE IF EXISTS subject_relations CASCADE;

-- ビューを削除
DROP VIEW IF EXISTS v_support_plans_with_sessions;
DROP VIEW IF EXISTS v_user_subjects;

-- 追加したカラムを削除（注意：データが失われます）
ALTER TABLE public.users
  DROP COLUMN IF EXISTS role,
  DROP COLUMN IF EXISTS facility_id;

ALTER TABLE business_interview_sessions
  DROP COLUMN IF EXISTS support_plan_id,
  DROP COLUMN IF EXISTS session_type,
  DROP COLUMN IF EXISTS session_number;
```

## 📞 サポート

問題が発生した場合は、エラーメッセージの詳細を含めて報告してください。