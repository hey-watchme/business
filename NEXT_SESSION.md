# 次セッションへの引き継ぎ

最終更新: 2026-01-14

## ✅ 今回のセッションで完了した作業

### 1. Support Plans CRUD API 実装完了 🎉

**実装内容**:
- Pydanticモデル定義（SupportPlanCreate, SupportPlanUpdate, SupportPlanResponse）
- POST /api/support-plans（新規作成）
- GET /api/support-plans（一覧取得、session_count付き）
- GET /api/support-plans/:id（詳細取得、sessions配列付き）
- PUT /api/support-plans/:id（更新）
- DELETE /api/support-plans/:id（削除）
- GET /api/sessions に support_plan_id フィルタ追加

**対応した問題**:
1. **RLSエラー**: `SUPABASE_KEY` → `SUPABASE_SERVICE_ROLE_KEY` に変更
   - CI/CD設定3箇所を更新（docker-compose.prod.yml, deploy-to-ecr.yml x2）
2. **subject_id NOT NULL制約**: `ALTER TABLE` で NULL 許可に変更
3. **created_by 外部キー制約**: ダミーUUIDではなく `None` に変更

**動作確認済み**:
```bash
# テスト成功
curl -X POST "https://api.hey-watch.me/business/api/support-plans" \
  -H "X-API-Token: watchme-b2b-poc-2025" \
  -H "Content-Type: application/json" \
  -d '{"title":"田中太郎くん 2025年度 個別支援計画","plan_number":"2025-001","status":"draft"}'

# 結果
{
  "id": "23bc674a-177a-4346-8e03-5f48243598e0",
  "title": "田中太郎くん 2025年度 個別支援計画",
  "plan_number": "2025-001",
  "status": "draft",
  "subject_id": null,
  "session_count": 0
}
```

**コミット履歴**:
- `cade0c6`: feat: add Support Plans CRUD API
- `9376b79`: fix: use SUPABASE_SERVICE_ROLE_KEY for backend
- `247db03`: fix: add SUPABASE_SERVICE_ROLE_KEY to CI/CD config
- `f06a514`: fix: set created_by to None to avoid FK constraint

---

## 📋 現在のデータベース構造

### テーブル一覧

#### 統合された共通テーブル
- `users`: ユーザーマスタ（`role`, `facility_id`追加済み）
- `subjects`: 観測対象マスタ（B2C/B2B共通）
- `facilities`: 施設マスタ（B2C/B2B共通）

#### Business専用テーブル
- `business_support_plans`: 個別支援計画（**subject_id は NULL 許可**、**created_by は NULL 許可**）
- `business_interview_sessions`: ヒアリングセッション
- `subject_relations`: 観測対象との関係性（権限管理）

### 重要な外部キー関係

```
business_support_plans
  ├─ facility_id → facilities(id)
  ├─ subject_id → subjects(subject_id) [NULL許可]
  └─ created_by → users(user_id) [NULL許可]

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

### Phase 1: Backend API実装（残タスク）

#### 1. Subjects API（未実装）
- [ ] `GET /api/subjects`: サブジェクト一覧取得
- [ ] `POST /api/subjects`: 新規サブジェクト作成
- [ ] `GET /api/subjects/:id`: サブジェクト詳細取得
- [ ] `PUT /api/subjects/:id`: サブジェクト更新

#### 2. Subject Relations API（未実装）
- [ ] `GET /api/subjects/:id/relations`: 観測対象の関係者一覧
- [ ] `POST /api/subjects/:id/relations`: 関係者追加
- [ ] `PUT /api/subjects/:id/relations/:relationId`: 権限更新
- [ ] `DELETE /api/subjects/:id/relations/:relationId`: 関係者削除

---

### Phase 2: Frontend UI実装（最優先）

#### 1. 個別支援計画一覧画面（SupportPlanCreate.tsx 改修）

**現状**: セッション一覧を表示
**変更後**: 支援計画一覧を表示

**実装内容**:
- [ ] API統合：`GET /api/support-plans` を呼び出し
- [ ] 支援計画カードの表示
  - タイトル
  - 計画番号
  - ステータス
  - セッション数
  - 作成日時
- [ ] 「新規作成」ボタン
- [ ] カードクリック → 詳細画面（右スライド）表示

**ファイル**: `/Users/kaya.matsumoto/projects/watchme/business/frontend/src/pages/SupportPlanCreate.tsx`

#### 2. 個別支援計画作成モーダル

**実装内容**:
- [ ] モーダルコンポーネント作成
- [ ] タイトル入力フィールド
- [ ] 計画番号入力フィールド（オプション）
- [ ] ステータス選択（draft/active）
- [ ] API統合：`POST /api/support-plans`
- [ ] 作成成功後、一覧を再取得

#### 3. 個別支援計画詳細画面（右スライド）

**現状**: セッション詳細を表示
**変更後**: 支援計画詳細を表示

**実装内容**:
- [ ] 基本情報表示
  - タイトル
  - 計画番号
  - ステータス
  - サブジェクト（未設定 or 名前）
  - 作成日時
- [ ] 「+ 支援対象を追加」ボタン（subject_id が null の場合）
- [ ] 紐づくセッション一覧
- [ ] 「セッション開始」ボタン
- [ ] 「編集」ボタン

---

### Phase 3: API Client の作成

#### Frontend API Client（`frontend/src/api/client.ts`）

**追加が必要なAPI**:
- [ ] `getSupportPlans()`: 支援計画一覧取得
- [ ] `createSupportPlan(data)`: 支援計画作成
- [ ] `getSupportPlan(id)`: 支援計画詳細取得
- [ ] `updateSupportPlan(id, data)`: 支援計画更新
- [ ] `deleteSupportPlan(id)`: 支援計画削除

---

## ⚠️ 重要な注意事項

### 1. Supabase Key の使い分け

- **Backend**: `SUPABASE_SERVICE_ROLE_KEY` を使用（RLSをバイパス）
- **Frontend**: `SUPABASE_ANON_KEY` を使用（RLSが適用される）

**現在の設定**:
- `backend/app.py`: `SUPABASE_SERVICE_ROLE_KEY` 使用中 ✅
- CI/CD: 3箇所更新済み ✅

### 2. 環境変数追加時のルール

**CICD_STANDARD_SPECIFICATION.md** に従い、必ず3箇所を更新：
1. GitHub Secrets
2. `.github/workflows/deploy-to-ecr.yml` (env: + echo)
3. `docker-compose.prod.yml` (environment:)

### 3. データベース操作

- **auth.usersへの直接参照は絶対禁止**
- すべて`public.users(user_id)`を使用
- RLSポリシーで`auth.uid()`を使うのは正しい（Supabase認証関数）

### 4. UI/UX の設計方針

**ユーザー体験フロー**:
1. 「個別支援計画作成」ボタンをクリック
2. モーダル表示（タイトル・計画番号入力）
3. 支援計画作成（subject_id は null）
4. 詳細画面で「+ 支援対象を追加」ボタン
5. サブジェクト選択/新規作成
6. 「セッション開始」ボタンでセッション録音

**重要**: 現在16件の既存セッションは `support_plan_id` が null のため、一覧に表示されない。

---

## 📚 参考ドキュメント

### プロジェクト内
- `/Users/kaya.matsumoto/projects/watchme/business/docs/INTEGRATED_ARCHITECTURE.md`: 統合アーキテクチャ設計書
- `/Users/kaya.matsumoto/projects/watchme/business/backend/app.py`: Backend API実装（L388-610）
- `/Users/kaya.matsumoto/projects/watchme/business/frontend/src/pages/SupportPlanCreate.tsx`: Frontend UI

### WatchMe全体
- `/Users/kaya.matsumoto/projects/watchme/CLAUDE.md`: WatchMeプロジェクト全体のルール
- `/Users/kaya.matsumoto/CLAUDE.md`: 開発全般の基本方針
- `/Users/kaya.matsumoto/projects/watchme/server-configs/docs/CICD_STANDARD_SPECIFICATION.md`: CI/CD標準仕様

---

## 🎯 次セッションの最優先タスク

**1. Frontend: 支援計画一覧画面の実装**
- `SupportPlanCreate.tsx` を改修
- API統合（`GET /api/support-plans`）
- 支援計画カード表示
- 新規作成モーダル実装

**2. Frontend: 支援計画詳細画面の実装**
- 右スライドで詳細表示
- 基本情報 + 紐づくセッション一覧
- 「+ 支援対象を追加」ボタン

**3. API Client の作成**
- `frontend/src/api/client.ts` に Support Plans API を追加

---

## 💡 今回のセッションで学んだこと

1. **権限エラーは最初に疑う**
   - RLSエラー → Supabase Key の種類を確認
   - Backend は `SERVICE_ROLE_KEY`、Frontend は `ANON_KEY`

2. **環境変数は3箇所セットで更新**
   - GitHub Secrets だけでは不十分
   - CI/CD 設定（2箇所）+ docker-compose も必須

3. **外部キー制約は慎重に**
   - ダミー値を使う場合、実際にテーブルに存在する必要がある
   - NULL 許可が適切な場合も多い

4. **ユーザーに聞くことを躊躇しない**
   - 推測で進めない
   - 不明点があれば即座に STOP して質問

---

## 🔗 関連リンク

- GitHub Repo: https://github.com/hey-watchme/business
- Supabase Dashboard: https://app.supabase.com
- Frontend (dev): http://localhost:5176
- Backend (dev): http://localhost:8052
- Frontend (prod): https://business.hey-watch.me
- Backend (prod): https://api.hey-watch.me/business

---

## 🧪 テスト用エンドポイント

```bash
# 支援計画作成
curl -X POST "https://api.hey-watch.me/business/api/support-plans" \
  -H "X-API-Token: watchme-b2b-poc-2025" \
  -H "Content-Type: application/json" \
  -d '{"title":"テスト支援計画","plan_number":"2025-999","status":"draft"}'

# 支援計画一覧取得
curl "https://api.hey-watch.me/business/api/support-plans" \
  -H "X-API-Token: watchme-b2b-poc-2025"

# 支援計画詳細取得
curl "https://api.hey-watch.me/business/api/support-plans/23bc674a-177a-4346-8e03-5f48243598e0" \
  -H "X-API-Token: watchme-b2b-poc-2025"
```
