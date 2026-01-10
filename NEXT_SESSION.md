# 次のセッション用メモ

最終更新: 2026-01-10

## 🎯 次のセッションでやること

**フロントエンド実装（録音→アップロード→DB保存）**

---

## 🚀 フロントエンド実装タスク

### 0. Vercelデプロイ設定（最初に実施）

**Vercel設定**:
1. https://vercel.com にアクセス
2. GitHub連携: `hey-watchme/business` リポジトリを選択
3. Framework Preset: `Vite` を選択
4. Root Directory: `frontend`
5. 環境変数設定:
   ```
   VITE_API_URL=https://api.hey-watch.me/business
   ```
6. Deploy

**カスタムドメイン設定**:
1. Vercelプロジェクト > Settings > Domains
2. `business.hey-watch.me` を追加
3. Vercelが提示するDNS設定をメモ（例: `cname.vercel-dns.com`）

**Cloudflare DNS設定**:
1. https://dash.cloudflare.com にアクセス
2. `hey-watch.me` ドメインを選択
3. DNS > Records > Add record
   - Type: `CNAME`
   - Name: `business`
   - Target: `cname.vercel-dns.com`（Vercelが提示した値）
   - Proxy status: `DNS only`（⚪グレー雲）← **重要**
4. Save

**確認**:
```bash
# DNS伝播確認（数分待つ）
host business.hey-watch.me

# 期待される出力: business.hey-watch.me is an alias for cname.vercel-dns.com.
```

**アクセス**: https://business.hey-watch.me

---

### 1. ローカル起動

```bash
cd /Users/kaya.matsumoto/projects/watchme/business/frontend
npm install
npm run dev
# → http://localhost:5174/
```

### 2. 環境変数設定

```bash
# frontend/.env
VITE_API_URL=https://api.hey-watch.me/business
```

### 3. 録音機能テスト

**手順**:
1. ブラウザで http://localhost:5174/ を開く
2. 録音ボタンをクリック
3. 1分程度話す
4. 停止ボタンをクリック
5. アップロードボタンをクリック

**確認ポイント**:
- ブラウザのコンソールでエラーがないか
- Networkタブで `/api/upload` リクエストが成功しているか（200 OK）

### 4. curlでアップロードテスト

```bash
cd /Users/kaya.matsumoto/projects/watchme/business
echo "test audio" > test.webm

curl -X POST https://api.hey-watch.me/business/api/upload \
  -H "X-API-Token: watchme-b2b-poc-2025" \
  -F "audio=@test.webm" \
  -F "facility_id=00000000-0000-0000-0000-000000000001" \
  -F "child_id=00000000-0000-0000-0000-000000000002"
```

**期待される出力**:
```json
{
  "success": true,
  "session_id": "uuid-here",
  "s3_path": "recordings/...",
  "message": "Audio uploaded successfully"
}
```

### 5. S3確認

```bash
aws s3 ls s3://watchme-business/recordings/ --recursive --region ap-southeast-2
```

### 6. DB確認

Supabaseダッシュボード:
- https://supabase.com/dashboard/project/qvtlwotzuzbavrzqhyvt
- テーブル: `business_interview_sessions`
- 確認: 新しいレコードが作成されているか

---

## ✅ 完了済み（前回のセッション）

### バックエンドAPI
- FastAPI実装完了（`backend/app.py`）
- S3アップロード機能
- Supabase DB保存機能
- エンドポイント: `GET /health`, `POST /api/upload`, `GET /api/sessions/{session_id}`

### デプロイ
- GitHub Actions CI/CD設定完了
- ECRリポジトリ作成（`watchme-business`）
- EC2デプロイ成功（ポート8052）
- Nginx設定追加（`/business/`）

### 動作確認
```bash
curl https://api.hey-watch.me/business/health
# → {"status":"healthy","service":"watchme-business-api","s3_bucket":"watchme-business","supabase_connected":true}
```

---

## 🔧 現在の構成

**フロントエンド**: `https://business.hey-watch.me` (Vercel)

**API**: `https://api.hey-watch.me/business/`

**EC2**:
- コンテナ: `watchme-business-api`
- ポート: 8052
- ディレクトリ: `/home/ubuntu/watchme-business-api/`

**S3**:
- バケット: `watchme-business`
- リージョン: `ap-southeast-2` (Sydney)

**Supabase**:
- プロジェクト: `qvtlwotzuzbavrzqhyvt`
- テーブル:
  - `business_interview_sessions` - 録音セッション管理
  - `business_transcriptions` - 文字起こし結果（将来）
  - `business_support_plans` - 生成された計画書（将来）
  - `business_api_logs` - APIログ

---

## 📊 進捗状況

| フェーズ | 進捗 | 状態 |
|---------|------|------|
| 企画・設計 | 100% | ✅ 完了 |
| インフラ構築 | 100% | ✅ 完了 |
| バックエンドAPI | 100% | ✅ 完了・稼働中 |
| デプロイ環境 | 100% | ✅ 完了 |
| Nginx設定 | 100% | ✅ 完了 |
| **フロントエンド** | **0%** | **🚧 次のタスク** |
| AI連携 | 0% | ⏸️ 未着手 |

**全体進捗**: 約60%

---

## 💡 コマンド集

```bash
# API健全性確認
curl https://api.hey-watch.me/business/health

# EC2接続
ssh -i ~/watchme-key.pem ubuntu@3.24.16.82

# コンテナログ確認
ssh -i ~/watchme-key.pem ubuntu@3.24.16.82 "docker logs watchme-business-api --tail 50"

# S3確認
aws s3 ls s3://watchme-business/recordings/ --recursive --region ap-southeast-2

# デプロイ状況確認
gh run list --repo hey-watchme/business --limit 3

# フロントエンドローカル起動
cd /Users/kaya.matsumoto/projects/watchme/business/frontend
npm run dev
```

---

## ⚠️ トラブルシューティング

### フロントエンドで CORS エラーが出る場合

1. **APIのCORS設定確認**:
   ```bash
   curl -X OPTIONS https://api.hey-watch.me/business/api/upload \
     -H "Origin: http://localhost:5174" \
     -H "Access-Control-Request-Method: POST"
   ```

2. **Nginx設定確認**:
   ```bash
   ssh ubuntu@3.24.16.82 "grep -A 5 'CORS' /etc/nginx/sites-available/api.hey-watch.me | grep -A 5 'business'"
   ```

### アップロードが失敗する場合

1. **APIトークン確認**:
   ```bash
   # backend/app.py の API_TOKEN を確認
   # フロントエンドのリクエストヘッダーに "X-API-Token: watchme-b2b-poc-2025" が含まれているか
   ```

2. **S3アクセス権限確認**:
   ```bash
   ssh ubuntu@3.24.16.82 "docker exec watchme-business-api printenv | grep AWS"
   ```

3. **ログ確認**:
   ```bash
   docker logs watchme-business-api --tail 100
   ```

---

## 📝 参考情報

**技術仕様**: `IMPLEMENTATION_PLAN.md`

**DB定義**: `infrastructure/supabase/create_tables.sql`

**CI/CD仕様**: `/Users/kaya.matsumoto/projects/watchme/server-configs/docs/CICD_STANDARD_SPECIFICATION.md`

**既存のフロントエンドコード**: `frontend/src/App.tsx`
