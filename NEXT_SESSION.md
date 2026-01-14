# 次セッションへの引き継ぎ

最終更新: 2026-01-14

## ✅ 今回のセッションで完了した作業

### 1. データベースマイグレーション完了 🎉

**問題**:
- `auth.users`と`public.users`の区別が曖昧
- 古い`business_children`, `business_facilities`テーブルが残存
- 統合アーキテクチャへの移行が未完了

**解決策**:
- すべてのSQLファイルで`public.`スキーマを明示化
- 既存DBの状態を確認し、古いテーブルを削除
- 新しい統合アーキテクチャでテーブルを再作成

**実施内容**:
1. `000_base_tables.sql`: `public.`スキーマで統一
2. `001a_alter_existing_tables.sql`: `users`に`role`, `facility_id`追加
3. `002_cleanup_and_final_setup.sql`: 古いテーブル削除、新規作成
   - `business_support_plans`: 個別支援計画テーブル
   - `subject_relations`: 観測対象との関係性テーブル
   - RLSポリシー、トリガー、ビュー設定

**結果**:
- データベースは統合アーキテクチャで正常に動作
- `auth.users`と`public.users`の区別が明確
- すべてGitHubにプッシュ済み

---

## 📋 現在のデータベース構造

### テーブル一覧

#### 統合された共通テーブル
- `users`: ユーザーマスタ（`role`, `facility_id`追加済み）
- `subjects`: 観測対象マスタ（B2C/B2B共通）
- `facilities`: 施設マスタ（B2C/B2B共通）

#### Business専用テーブル
- `business_support_plans`: 個別支援計画
- `business_interview_sessions`: ヒアリングセッション
- `subject_relations`: 観測対象との関係性（権限管理）

#### B2C専用テーブル
- `audio_files`, `spot_features`, `spot_results`, `daily_results`, `weekly_results` 等

### 重要な外部キー関係

```
business_support_plans
  ├─ facility_id → facilities(id)
  ├─ subject_id → subjects(subject_id)
  └─ created_by → users(user_id)

business_interview_sessions
  ├─ facility_id → facilities(id)
  ├─ subject_id → subjects(subject_id)
  └─ support_plan_id → business_support_plans(id)

subject_relations
  ├─ subject_id → subjects(subject_id)
  └─ user_id → users(user_id)
```

---

## 🚀 次のセッションで行うべき作業

### Phase 1: Backend API実装（優先度：高）

#### 1. Support Plans API
- [ ] `GET /api/support-plans`: 支援計画一覧取得
- [ ] `POST /api/support-plans`: 新規支援計画作成
- [ ] `GET /api/support-plans/:id`: 支援計画詳細取得
- [ ] `PUT /api/support-plans/:id`: 支援計画更新
- [ ] `DELETE /api/support-plans/:id`: 支援計画削除

**注意点**:
- RLSポリシーで施設単位のデータ分離を確認
- `facility_id`は現在ログイン中のユーザーから取得
- `subject_id`は既存の`subjects`テーブルから参照

#### 2. Subject Relations API
- [ ] `GET /api/subjects/:id/relations`: 観測対象の関係者一覧
- [ ] `POST /api/subjects/:id/relations`: 関係者追加
- [ ] `PUT /api/subjects/:id/relations/:relationId`: 権限更新
- [ ] `DELETE /api/subjects/:id/relations/:relationId`: 関係者削除

#### 3. Session API の更新
- [ ] `GET /api/sessions`: セッション一覧に`support_plan_id`でフィルタ追加
- [ ] `POST /api/sessions`: `support_plan_id`を含める
- [ ] `PUT /api/sessions/:id`: `support_plan_id`の更新

**実装場所**: `/Users/kaya.matsumoto/projects/watchme/business/backend/app.py`

---

### Phase 2: Frontend UI実装（優先度：中）

#### 1. 支援計画一覧画面
- [ ] 支援計画一覧の表示
- [ ] 施設・観測対象でフィルタリング
- [ ] ステータス（draft/active/completed/archived）表示
- [ ] 新規作成ボタン

#### 2. 支援計画詳細画面
- [ ] 支援計画の基本情報表示
- [ ] 紐づくセッション一覧表示
- [ ] セッション追加ボタン
- [ ] 支援計画編集ボタン

#### 3. 支援計画作成/編集画面
- [ ] タイトル入力
- [ ] 観測対象選択（`subjects`から）
- [ ] 計画番号入力
- [ ] ステータス選択

**実装場所**: `/Users/kaya.matsumoto/projects/watchme/business/frontend/src/`

---

### Phase 3: 権限管理実装（優先度：中）

#### 1. ロールベース認証
- [ ] `users.role`に基づいたアクセス制御
- [ ] `parent`: WatchMeアプリのみ
- [ ] `staff`: WatchMe + Business両方
- [ ] `admin`: 全権限

#### 2. Subject Relations による権限制御
- [ ] `can_view`: 閲覧権限チェック
- [ ] `can_edit`: 編集権限チェック
- [ ] `is_primary`: 主担当/主保護者の識別

---

## 🔍 確認が必要な事項

### 1. 既存の`business_interview_sessions`のデータ
```sql
SELECT COUNT(*) FROM business_interview_sessions;
```
現在16件のデータが存在。これらの`subject_id`と`facility_id`が正しく参照されているか確認済み。

### 2. `subjects`テーブルと`users`テーブルの連携
- B2Cでは`subjects`は既に使用されている
- B2Bでも同じ`subjects`テーブルを使用する
- 両者の整合性を保つ必要がある

### 3. `facilities`テーブルのデータ
テスト用施設データが1件存在：
```sql
SELECT * FROM facilities WHERE id = '00000000-0000-0000-0000-000000000001';
-- 結果: 'テスト療育施設'
```

---

## ⚠️ 注意事項

### 1. データベース操作
- **auth.usersへの直接参照は絶対禁止**
- すべて`public.users(user_id)`を使用
- RLSポリシーで`auth.uid()`を使うのは正しい（Supabase認証関数）

### 2. マイグレーション
- すでに実行済みのため、再実行不要
- 新しい変更は新しいマイグレーションファイルを作成

### 3. テストデータ
- 現在のデータは削除可能だったため削除済み
- 新しいテストデータが必要な場合は作成が必要

---

## 📚 参考ドキュメント

### プロジェクト内
- `/Users/kaya.matsumoto/projects/watchme/business/docs/INTEGRATED_ARCHITECTURE.md`: 統合アーキテクチャ設計書
- `/Users/kaya.matsumoto/projects/watchme/business/infrastructure/supabase/migrations/README.md`: マイグレーション実行手順
- `/Users/kaya.matsumoto/projects/watchme/business/infrastructure/supabase/migrations/002_cleanup_and_final_setup.sql`: 実行済みSQL

### WatchMe全体
- `/Users/kaya.matsumoto/projects/watchme/CLAUDE.md`: WatchMeプロジェクト全体のルール
- `/Users/kaya.matsumoto/CLAUDE.md`: 開発全般の基本方針

---

## 🎯 次セッションの最優先タスク

**1. Backend API実装を開始**
- まず`GET /api/support-plans`の実装から開始
- RLSポリシーが正しく機能するか確認
- Postmanまたはcurlでテスト

**2. フロントエンドで一覧画面を作成**
- 支援計画一覧を表示
- バックエンドAPIと連携して動作確認

**3. 実際のワークフローをテスト**
1. 施設を作成
2. 観測対象（subject）を作成
3. 支援計画を作成
4. セッションを紐づけ

---

## 💡 今回のセッションで学んだこと

1. **既存DBの状態確認が最重要**
   - 推測せず、必ず`information_schema`で確認
   - テーブル構造、データ件数、外部キー関係を把握

2. **段階的な実行が重要**
   - 一度に全SQLを実行せず、ステップバイステップ
   - エラーが出たら、その箇所を特定して修正

3. **記録を残す**
   - 実行した手順をSQLファイルに記録
   - READMEに実行状況を記載

---

## 🔗 関連リンク

- GitHub Repo: https://github.com/hey-watchme/business
- Supabase Dashboard: https://app.supabase.com
- Frontend (dev): http://localhost:5176
- Backend (dev): http://localhost:8052
- Frontend (prod): https://business.hey-watch.me
- Backend (prod): https://api.hey-watch.me/business
