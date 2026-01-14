# WatchMe/Business 統合アーキテクチャ設計書

最終更新: 2026-01-14

## 📌 概要

WatchMeとWatchMe Businessを統合的なエコシステムとして設計し、観測対象（subjects）を中心としたデータ共有と相互連携を実現する。

## 🎯 基本コンセプト

### WatchMe（B2C）
- **利用者**: 子どもの発達に悩む親、セルフケアを行う個人
- **目的**: 日常的な観測とモニタリング
- **観測対象**: 子ども、または自分自身

### WatchMe Business（B2B）
- **利用者**: 療育施設・児童発達支援事業所のスタッフ
- **目的**: 業務改善、個別支援計画の作成
- **観測対象**: 施設利用者（子ども）

### 統合の利点
- **データ連携**: 同一の観測対象を親と施設スタッフが異なる視点でモニタリング
- **精度向上**: 観測データの蓄積により、分析精度が向上
- **シームレスな体験**: 統一されたデータモデルで一貫性のある体験

## 🏗️ システムアーキテクチャ

### アカウント体系

```
users（共通アカウントテーブル）
├─ role: parent     → WatchMeアプリを利用
├─ role: staff      → WatchMe BusinessとWatchMeアプリ両方を利用可能
├─ role: admin      → 管理者権限
└─ role: self       → 自己観測者
```

### 観測対象の中心性

```
subjects（観測対象）
    ↑
    ├─ WatchMeアプリ: 親による観測
    ├─ WatchMeアプリ: 本人による自己観測
    └─ Business: 施設スタッフによる観測（個別支援計画）
```

## 📊 データモデル

### 1. 既存テーブルの活用

#### users テーブル（拡張）
```sql
-- 既存のusersテーブルにロールとファシリティIDを追加
ALTER TABLE users ADD COLUMN IF NOT EXISTS
  role text DEFAULT 'parent' CHECK (role IN ('parent', 'staff', 'admin', 'self'));

ALTER TABLE users ADD COLUMN IF NOT EXISTS
  facility_id UUID REFERENCES facilities(id);
```

#### subjects テーブル（既存活用）
- 観測対象の中心となるテーブル
- WatchMe/Business共通で使用
- 必要に応じてBusiness向けカラムを追加検討

### 2. 新規テーブル

#### business_support_plans（個別支援計画）
```sql
CREATE TABLE business_support_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES facilities(id),
  subject_id UUID NOT NULL REFERENCES subjects(subject_id),
  title text NOT NULL,
  plan_number text, -- 計画番号（施設の管理番号）
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'archived')),
  created_by UUID REFERENCES users(user_id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### subject_relations（観測対象との関係性）
```sql
CREATE TABLE subject_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES subjects(subject_id),
  user_id UUID NOT NULL REFERENCES users(user_id),
  relation_type text NOT NULL CHECK (relation_type IN
    ('parent', 'self', 'staff', 'therapist', 'teacher')),
  can_view boolean DEFAULT true,
  can_edit boolean DEFAULT false,
  is_primary boolean DEFAULT false, -- 主担当/主保護者フラグ
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(subject_id, user_id)
);
```

### 3. 既存テーブルの改修

#### business_interview_sessions
```sql
-- 支援計画IDを追加
ALTER TABLE business_interview_sessions
  ADD COLUMN support_plan_id UUID REFERENCES business_support_plans(id);

-- child_idをsubject_idに変更（統一性のため）
ALTER TABLE business_interview_sessions
  RENAME COLUMN child_id TO subject_id;

-- セッションタイプを追加
ALTER TABLE business_interview_sessions
  ADD COLUMN session_type text CHECK (session_type IN
    ('initial_planning', 'mid_review', 'periodic_review', 'revision', 'consultation'));
```

## 🔄 データフローとユースケース

### ケース1: 親と施設の連携

```
1. 施設スタッフが支援計画を作成
   └─ subject（子ども）を登録/選択

2. 親にWatchMeアプリへの招待
   └─ subject_relationsで関係性を設定（parent）

3. 並行観測
   ├─ 親: WatchMeアプリで日常観測
   └─ スタッフ: Businessで施設での様子を記録

4. データ統合
   └─ 同一subjectの多角的なデータが蓄積
```

### ケース2: セルフケア利用者

```
1. 個人がWatchMeアプリに登録
   └─ subject = 自分自身
   └─ subject_relationsで関係性を設定（self）

2. 自己観測データの蓄積
```

### ケース3: 施設単独利用

```
1. 施設がBusiness導入
2. 利用者（subject）を登録
3. 支援計画作成・ヒアリング実施
4. 保護者は連絡先のみ登録（アカウントなし）
```

## 🔐 権限管理

### ロールベース権限

| ロール | WatchMe | Business | 管理機能 |
|-------|---------|----------|---------|
| parent | ✅ | ❌ | ❌ |
| staff | ✅ | ✅ | ❌ |
| admin | ✅ | ✅ | ✅ |
| self | ✅ | ❌ | ❌ |

### データアクセス権限

subject_relationsテーブルで細かい権限制御：
- `can_view`: 観測データの閲覧権限
- `can_edit`: 観測データの編集権限
- `is_primary`: 主担当/主保護者フラグ

## 🚀 実装フェーズ

### Phase 1: 最小限実装（MVP）
1. DBスキーマ作成
   - business_support_plans
   - subject_relations
   - business_interview_sessionsの改修
2. Backend API
   - 支援計画CRUD
   - セッション管理の改修
3. Frontend
   - 支援計画一覧UI
   - セッション階層表示

### Phase 2: 権限管理
1. ロールベース認証実装
2. subject_relationsによる権限制御
3. 施設間データ分離

### Phase 3: WatchMe連携
1. 共通コンポーネント開発
2. データ同期機能
3. 通知連携

### Phase 4: 高度な機能
1. 6ヶ月レビューサイクル管理
2. レポート生成
3. 分析精度向上

## 📈 将来的な拡張性

### 考慮事項
- **マルチテナント**: 複数施設の完全分離
- **API連携**: 外部システムとの連携
- **モバイルアプリ**: スタッフ向けモバイル版
- **AI分析**: 蓄積データを活用した高度な分析

### スケーラビリティ
- 観測対象中心の設計により、データ量増加に対応
- ロールベース権限で組織規模の拡大に対応
- マイクロサービス化も視野に

## 🔍 技術的な決定事項

### なぜ統合アーキテクチャか
1. **データの価値最大化**: 同一対象の多角的観測
2. **開発効率**: 共通基盤の再利用
3. **ユーザー価値**: シームレスな体験

### なぜ観測対象中心か
1. **ドメインの本質**: 「観測」がコアバリュー
2. **柔軟性**: 様々な関係性に対応
3. **拡張性**: 新サービス追加が容易

## 📝 注意事項

- プライバシー保護を最優先
- 施設間のデータ分離を厳格に
- 段階的な実装でリスク最小化

---

このドキュメントは生きたドキュメントとして、実装の進捗に応じて更新される。