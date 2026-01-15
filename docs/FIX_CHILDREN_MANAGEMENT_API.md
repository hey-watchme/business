# 児童管理API修正タスク

作成日: 2026-01-15

## 🚨 問題の概要

児童管理ページの実装で、間違ったテーブルを使用してしまった。

### 間違った実装
- **使用したテーブル**: `business_children`
- **カラム**: id, facility_id, name, created_at （4カラムのみ）

### 正しい仕様
- **使用すべきテーブル**: `subjects`
- **カラム**: subject_id, name, age, gender, avatar_url, notes, created_by_user_id, created_at, updated_at, prefecture, city, cognitive_type

## 📋 原因

1. **不完全な調査ツールを信用した**
   - `inspect_database.sh` が `subjects` テーブルを表示しなかった
   - ハードコードされたリストに `subjects` が含まれていなかった
   - 「データベースファースト」と偽って、実際には一部のテーブルしか見えていなかった

2. **ドキュメントを最初に確認しなかった**
   - `/Users/kaya.matsumoto/projects/watchme/business/docs/INTEGRATED_ARCHITECTURE.md` に正しい仕様が書かれていた
   - `/Users/kaya.matsumoto/projects/watchme/business/docs/AUTHENTICATION_DESIGN.md` にも `public.subjects` が記載されていた

## ✅ 修正方法

### 1. Backend API修正 (`/Users/kaya.matsumoto/projects/watchme/business/backend/app.py`)

#### 修正箇所1: GET /api/subjects

**現在（間違い）**:
```python
query = supabase.table('business_children').select('*')
```

**正しい実装**:
```python
query = supabase.table('subjects').select('*')
```

**レスポンス構造も修正**:
```python
subjects.append({
    "id": subject.get('subject_id'),  # ← business_childrenのidではなく、subject_id
    "facility_id": subject.get('facility_id'),
    "name": subject.get('name'),
    "age": subject.get('age'),  # ← 実際に存在する
    "gender": subject.get('gender'),  # ← 実際に存在する
    "avatar_url": subject.get('avatar_url'),  # ← 実際に存在する
    "notes": subject.get('notes'),  # ← 実際に存在する
    "prefecture": subject.get('prefecture'),  # ← 実際に存在する
    "city": subject.get('city'),  # ← 実際に存在する
    "cognitive_type": subject.get('cognitive_type'),  # ← 実際に存在する
    "created_at": subject.get('created_at'),
    "updated_at": subject.get('updated_at')  # ← 実際に存在する
})
```

**統計情報も正しく計算**:
```python
# 実際のデータに基づいて計算（全てNullではない）
male_count = sum(1 for s in subjects if s.get('gender') == 'male')
female_count = sum(1 for s in subjects if s.get('gender') == 'female')
# 年齢分布も実データで計算
```

#### 修正箇所2: GET /api/subjects/{subject_id}

**現在（間違い）**:
```python
result = supabase.table('business_children').select('*').eq('id', subject_id)
```

**正しい実装**:
```python
result = supabase.table('subjects').select('*').eq('subject_id', subject_id)
```

### 2. Frontend (TypeScript型定義は既に正しい)

`frontend/src/api/client.ts` の Subject インターフェースは既に正しく定義されているので、修正不要。

### 3. 既存データの確認

実際のデータベース確認結果：
```bash
ssh -i ~/watchme-key.pem ubuntu@3.24.16.82 "docker exec watchme-business-api python3 -c \"
import os
from supabase import create_client
supabase = create_client(
    os.getenv('SUPABASE_URL'),
    os.getenv('SUPABASE_SERVICE_ROLE_KEY')
)
result = supabase.table('subjects').select('*').limit(1).execute()
print(result.data)
\""
```

**結果**: subjects テーブルは存在し、1件データがある。

## 📝 修正手順

1. `backend/app.py` の該当箇所を修正
2. 構文チェック: `python3 -m py_compile backend/app.py`
3. コミット: `git add . && git commit -m "fix: 児童管理APIをsubjectsテーブルに修正"`
4. プッシュ: `git push origin main`
5. デプロイ確認: `gh run watch --repo hey-watchme/business`
6. 動作確認: `https://business.hey-watch.me` で児童管理ページをチェック

## 🎓 今後の教訓

1. **ドキュメントを最初に確認する**
   - INTEGRATED_ARCHITECTURE.md
   - AUTHENTICATION_DESIGN.md
   - 既存のSQL定義ファイル

2. **不完全なツールに頼らない**
   - `inspect_database.sh` は削除済み
   - 必要に応じてSupabase Dashboardで直接確認

3. **仕様が不明な場合は直接確認**
   - `docker exec` でPythonを実行して直接テーブルにアクセス
   - `supabase.table('table_name').select('*').limit(1).execute()`

## 🔗 関連ファイル

- 仕様: `/Users/kaya.matsumoto/projects/watchme/business/docs/INTEGRATED_ARCHITECTURE.md`
- Backend: `/Users/kaya.matsumoto/projects/watchme/business/backend/app.py`
- Frontend: `/Users/kaya.matsumoto/projects/watchme/business/frontend/src/api/client.ts`
- Component: `/Users/kaya.matsumoto/projects/watchme/business/frontend/src/pages/ChildrenList.tsx`
