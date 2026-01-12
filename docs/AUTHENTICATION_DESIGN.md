# 認証・アカウント設計

**作成日**: 2026-01-13
**最終更新**: 2026-01-13
**ステータス**: 設計中（実装前）

---

## 📊 目次

1. [背景と方針](#背景と方針)
2. [アカウント体系](#アカウント体系)
3. [データベース設計](#データベース設計)
4. [認証フロー](#認証フロー)
5. [アクセス制御](#アクセス制御)
6. [実装ロードマップ](#実装ロードマップ)

---

## 背景と方針

### なぜ既存のauth.users/public.usersを拡張するのか

#### ✅ 採用する理由

1. **データ連携の必要性**
   - B2C（保護者）とB2B（事業所職員）でデータ共有の可能性
   - 同じ認証基盤（Supabase Auth）を使用
   - 重複管理を避ける

2. **構造の類似性**
   - User → Device → Observedという基本構造は共通
   - Organization/Facilityという「所属概念」を追加するだけで対応可能

3. **実装の効率化**
   - 既存の認証フローを再利用
   - Supabase RLSポリシーの一貫性

#### ❌ user_typeは使わない

- ユーザーは**ニュートラルな存在**
- 事業所に紐付いている → B2B機能が使える
- 紐付け解除 → 個人ユーザーに戻る
- 権限管理はRoleベースで行う

---

## アカウント体系

### 概念整理

#### WatchMe（既存C2C）

| 概念 | 説明 | テーブル |
|------|------|---------|
| **User** | 保護者 | `auth.users`, `public.users` |
| **Subject** | 観測対象（子ども） | `public.subjects` |
| **Device** | 観測デバイス | `public.devices` |

**関係性**:
```
User (保護者)
  └─ owns → Device (観測デバイス)
       └─ observes → Subject (子ども)
```

#### WatchMe Business（B2B）

| 概念 | 説明 | 対応するC2C概念 |
|------|------|----------------|
| **User** | 職員（または保護者） | User |
| **Organization** | 企業・自治体・教育機関 | ❌ 新規概念 |
| **Facility** | 事業所・支所・センター | ❌ 新規概念 |
| **Child** | 観測対象（児童） | Subject |
| **Device** | 録音デバイス | Device |

**関係性**:
```
Organization (企業・自治体・教育機関)
  └─ contains → Facility (事業所・支所)
       ├─ employs → User (職員)
       ├─ manages → Device (録音デバイス)
       └─ serves → Child (児童)
```

### Organization - Facility の階層構造

#### なぜ2層構造が必要か

| ユースケース | 説明 |
|------------|------|
| **民間企業** | 本社（Organization）+ 全国の支所（Facility） |
| **地方自治体** | 市区町村（Organization）+ 複数の療育センター（Facility） |
| **教育機関** | 学校法人（Organization）+ 複数のキャンパス（Facility） |
| **小規模事業所** | Organization = Facility（1対1でもOK） |

#### 用語選定の理由

| 用語 | 理由 |
|------|------|
| **Organization** | 企業・自治体・教育機関すべてに対して違和感のない汎用的な呼称 |
| **Facility** | 事業所・センター・支所すべてに対応可能 |

---

## データベース設計

### テーブル構造

#### 1. `public.organizations`（新規）

```sql
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  organization_type TEXT, -- 'company', 'government', 'education', 'npo', etc.
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 2. `public.facilities`（新規）

```sql
CREATE TABLE public.facilities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  facility_type TEXT, -- 'daycare', 'therapy_center', 'school', etc.
  address TEXT,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 3. `public.users`（拡張）

```sql
-- 既存カラム
- user_id (UUID, PRIMARY KEY, references auth.users)
- email TEXT
- display_name TEXT
- created_at TIMESTAMPTZ
- updated_at TIMESTAMPTZ

-- 追加カラム（拡張）
ALTER TABLE public.users
  ADD COLUMN primary_role TEXT DEFAULT 'individual'; -- 'individual', 'staff', 'parent', etc.

-- Note: facility紐付けは user_facilities テーブルで管理（多対多）
```

#### 4. `public.user_facilities`（新規・多対多関係）

```sql
CREATE TABLE public.user_facilities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  role TEXT NOT NULL, -- 'admin', 'staff', 'viewer', etc.
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  UNIQUE(user_id, facility_id)
);
```

**なぜ多対多か**:
- 1人の職員が複数の事業所に所属する可能性
- 退職・異動時に紐付けを解除するだけでOK
- 再招待も容易

#### 5. `public.children`（新規）

```sql
CREATE TABLE public.children (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  birth_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 6. `public.devices`（拡張）

```sql
-- 既存カラムに追加
ALTER TABLE public.devices
  ADD COLUMN facility_id UUID REFERENCES public.facilities(id);
```

#### 7. `business_interview_sessions`（修正）

```sql
-- 現在のカラム
- session_id UUID
- facility_id UUID  -- UUIDのみ（リレーションなし）
- child_id UUID     -- UUIDのみ（リレーションなし）
- staff_id UUID     -- 存在しない

-- 修正後
ALTER TABLE business_interview_sessions
  ADD CONSTRAINT fk_facility FOREIGN KEY (facility_id) REFERENCES public.facilities(id),
  ADD CONSTRAINT fk_child FOREIGN KEY (child_id) REFERENCES public.children(id),
  ADD CONSTRAINT fk_staff FOREIGN KEY (staff_id) REFERENCES public.users(user_id);
```

---

## 認証フロー

### 認証方式

#### Supabase Auth（既存WatchMeと同じ）

| 方式 | 説明 | 優先度 |
|------|------|-------|
| **Googleログイン** | ソーシャルログイン（推奨） | ⭐⭐⭐ |
| **メール/パスワード** | 事業所でGoogle使えない場合 | ⭐⭐ |
| **Appleログイン** | iOS向け（将来） | ⭐ |

#### 認証フロー

```
1. ユーザーがログイン → Supabase Auth
   ↓
2. auth.users にアカウント作成
   ↓
3. public.users にレコード作成（初回のみ）
   ↓
4. JWT取得（user_id含む）
   ↓
5. フロントエンド：user_facilitiesを確認
   - 事業所に紐付いている → Business管理画面
   - 紐付きなし → 個人ダッシュボード（または招待待ち）
```

### 招待フロー

```
1. 管理者が職員を招待
   - メールアドレスを登録
   ↓
2. user_facilities にレコード作成（accepted_at = NULL）
   ↓
3. 招待メール送信
   ↓
4. 職員がログイン
   ↓
5. 招待確認画面 → 承認
   ↓
6. accepted_at を更新
   ↓
7. 事業所データへのアクセス権限付与
```

---

## アクセス制御

### Supabase RLS（Row Level Security）ポリシー

#### `public.facilities`

```sql
-- 自分が所属する事業所のみ閲覧可能
CREATE POLICY "Users can view their facilities"
  ON public.facilities FOR SELECT
  USING (
    id IN (
      SELECT facility_id FROM public.user_facilities
      WHERE user_id = auth.uid()
      AND accepted_at IS NOT NULL
      AND revoked_at IS NULL
    )
  );
```

#### `public.children`

```sql
-- 自分が所属する事業所の児童のみ閲覧可能
CREATE POLICY "Users can view children in their facilities"
  ON public.children FOR SELECT
  USING (
    facility_id IN (
      SELECT facility_id FROM public.user_facilities
      WHERE user_id = auth.uid()
      AND accepted_at IS NOT NULL
      AND revoked_at IS NULL
    )
  );
```

#### `business_interview_sessions`

```sql
-- 自分が所属する事業所のセッションのみ閲覧可能
CREATE POLICY "Users can view sessions in their facilities"
  ON business_interview_sessions FOR SELECT
  USING (
    facility_id IN (
      SELECT facility_id FROM public.user_facilities
      WHERE user_id = auth.uid()
      AND accepted_at IS NOT NULL
      AND revoked_at IS NULL
    )
  );
```

### Role-Based Access Control

| Role | 説明 | 権限 |
|------|------|------|
| **admin** | 管理者 | 全権限（職員招待・削除、デバイス管理、データ閲覧・編集） |
| **staff** | 職員 | データ閲覧・録音・編集 |
| **viewer** | 閲覧者 | データ閲覧のみ |

---

## 実装ロードマップ

### Phase 1: データベース構築（最優先）

**タスク**:
1. ✅ テーブル設計確定
2. ⏸️ `public.organizations` テーブル作成
3. ⏸️ `public.facilities` テーブル作成
4. ⏸️ `public.users` 拡張（primary_role追加）
5. ⏸️ `public.user_facilities` テーブル作成
6. ⏸️ `public.children` テーブル作成
7. ⏸️ `public.devices` 拡張（facility_id追加）
8. ⏸️ `business_interview_sessions` 外部キー制約追加
9. ⏸️ RLSポリシー設定

**期間**: 1-2日

### Phase 2: 認証フロー実装

**タスク**:
1. ⏸️ フロントエンド：ログイン画面
2. ⏸️ Supabase Auth統合（Google/メール）
3. ⏸️ JWT検証ミドルウェア（バックエンド）
4. ⏸️ 事業所判定ロジック
5. ⏸️ ダッシュボード分岐（個人 vs 事業所）

**期間**: 2-3日

### Phase 3: 管理画面実装

**タスク**:
1. ⏸️ 事業所一覧表示
2. ⏸️ デバイス管理
3. ⏸️ 児童管理
4. ⏸️ 職員招待機能
5. ⏸️ 録音セッション一覧

**期間**: 3-5日

---

## 📝 備考

### 既存データの扱い

- **現状**: `business_interview_sessions`のfacility_id/child_idは単なるUUID
- **方針**: 全てテストデータのため、構造確定後に全削除してOK
- **移行計画**: 不要（0ベーススタート）

### 今後の検討事項

1. **Organization管理画面**
   - 複数Facilityの統合管理
   - 組織全体のレポート

2. **保護者アカウント連携**
   - 保護者が事業所データを閲覧できる仕組み
   - 保護者アプリとの統合

3. **請求・契約管理**
   - OrganizationレベルでのSaaS契約
   - 利用料金管理

---

## ✅ 次のステップ

**このドキュメント確定後**:

1. データベーススキーマ実装（SQL実行）
2. バックエンドAPI修正（外部キー対応）
3. フロントエンド認証実装
