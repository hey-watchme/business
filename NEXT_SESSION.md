# 次のセッション用メモ

最終更新: 2026-01-11

## 🚨 現在の課題（優先度順）

### 🔴 Issue 1: Vercel環境変数が反映されていない

**問題**:
- フロントエンド（Vercel）が `localhost:8052` に接続しようとしてエラー
- `VITE_API_URL` 環境変数がビルドに含まれていない

**原因**:
- Vercelで環境変数を設定したが、その**後**に再デプロイしていない
- 環境変数はビルド時に埋め込まれるため、設定後の再デプロイが必須

**解決方法**:
1. ✅ **完了**: Vercel Project Settings → Environment Variablesで `VITE_API_URL=https://api.hey-watch.me/business` を設定済み
2. ⏳ **待機中**: 最新のデプロイ（commit: 9b3d1a9）が完了するまで待つ
3. ✅ **確認方法**: デプロイ完了後、https://business-f914.vercel.app で録音テスト

**確認コマンド**:
```bash
# Vercelデプロイ状況確認
# → Vercel Dashboard > Deployments タブで確認

# デプロイ完了後、環境変数が反映されているか確認
curl -s https://business-f914.vercel.app/ | grep -i "api.hey-watch.me" && echo "環境変数反映済み" || echo "まだ反映されていない"
```

---

### 🟡 Issue 2: カスタムドメイン設定

**状況**:
- ✅ Vercel自動生成URL: `business-f914.vercel.app` → 動作OK
- ✅ DNS設定: `business.hey-watch.me` → `103e6ba9ee1a92b6.vercel-dns-017.com` (CNAME) → 設定済み
- ⏳ SSL証明書: Vercel側で発行中（通常5-10分）

**確認方法**:
```bash
# DNS確認
dig business.hey-watch.me @1.1.1.1 +short
# → 103e6ba9ee1a92b6.vercel-dns-017.com. が返ればOK

# HTTPSアクセス確認
curl -I https://business.hey-watch.me
# → HTTP/2 200 が返ればOK
```

---

### 🟢 Issue 3: バックエンドCORS設定

**状況**:
- ✅ `business.hey-watch.me` をCORS許可リストに追加済み
- ✅ バックエンドデプロイ済み（commit: 856a98f）

**確認済み**:
```bash
curl https://api.hey-watch.me/business/health
# → {"status":"healthy",...} OK
```

---

## 📋 次のセッションでやること

### 1. デプロイ完了確認（最優先）

```bash
# Vercelダッシュボードで確認
# Deployments タブ → 最新デプロイが "Ready" になっているか

# 完了後、録音テスト
# https://business-f914.vercel.app または https://business.hey-watch.me
```

### 2. 録音機能の動作確認

**テスト手順**:
1. ブラウザで https://business-f914.vercel.app を開く
2. ブラウザの開発者ツール（F12）→ **Network**タブを開く
3. 「🎤 録音開始」をクリック
4. マイクアクセスを許可
5. 数秒話す
6. 「⬛ 録音停止」をクリック
7. **Networkタブ**で `/api/upload` リクエストを確認

**期待される結果**:
- Network: `POST https://api.hey-watch.me/business/api/upload` → `200 OK`
- 画面: 「アップロード成功！」メッセージ

**エラーが出た場合の確認ポイント**:
```bash
# 1. Consoleタブのエラーメッセージ
# 2. Networkタブの失敗したリクエスト
#    - Status code（401, 422, 500など）
#    - Response body（エラー詳細）
#    - Request payload（送信データ）
```

### 3. S3 & DB確認

```bash
# S3にファイルがアップロードされているか
aws s3 ls s3://watchme-business/recordings/ --recursive --region ap-southeast-2

# Supabaseでレコードが作成されているか
# → https://supabase.com/dashboard/project/qvtlwotzuzbavrzqhyvt
# → business_interview_sessions テーブル
```

---

## ✅ 完了済み（今回のセッション）

### Vercelデプロイ設定
- ✅ GitHubリポジトリ連携（`hey-watchme/business`）
- ✅ Root Directory設定（`frontend`）
- ✅ TypeScript設定修正（`types: ["vite/client", "node"]`）
- ✅ 環境変数設定（`VITE_API_URL`）
- ✅ ビルド成功

### Cloudflare DNS設定
- ✅ `business.hey-watch.me` → `103e6ba9ee1a92b6.vercel-dns-017.com` (CNAME)
- ✅ Proxy status: DNS only（⚪グレー雲）

### バックエンドCORS修正
- ✅ `business.hey-watch.me` を許可リストに追加
- ✅ デプロイ成功

### フロントエンド実装
- ✅ 録音UI実装
- ✅ S3アップロード機能
- ✅ 環境変数対応

---

## 🔧 現在の構成

**フロントエンド**:
- Vercel URL: `https://business-f914.vercel.app`
- カスタムドメイン: `https://business.hey-watch.me`（設定中）
- 環境変数: `VITE_API_URL=https://api.hey-watch.me/business`

**バックエンド**:
- API: `https://api.hey-watch.me/business/`
- EC2 コンテナ: `watchme-business-api` (ポート8052)
- CORS: `localhost:5173`, `localhost:5174`, `*.vercel.app`, `business.hey-watch.me`

**ストレージ**:
- S3: `watchme-business` (ap-southeast-2)
- Supabase: プロジェクト `qvtlwotzuzbavrzqhyvt`

---

## 🐛 トラブルシューティング

### 環境変数が反映されない場合

**症状**: フロントエンドが `localhost:8052` に接続しようとする

**解決方法**:
```bash
# 1. Vercel環境変数を確認
# Project Settings → Environment Variables
# VITE_API_URL が設定されているか確認

# 2. 再デプロイ（キャッシュなし）
# Vercel Dashboard → Deployments → 最新デプロイの ... → Redeploy
# ✅ "Use existing Build Cache" のチェックを外す

# 3. GitHubから再デプロイ
git commit --allow-empty -m "chore: force redeploy"
git push origin main
```

### 録音時にエラーが出る場合

**422 Unprocessable Entity**:
- フォームデータのフィールド名が間違っている
- 期待: `audio`, `facility_id`, `child_id`
- ブラウザのNetworkタブ → Payload で確認

**400 Bad Request "File must be audio format"**:
- Content-Type が `audio/*` でない
- ブラウザのNetworkタブ → Headers → Request Payload で確認

**401 Unauthorized**:
- APIトークンが間違っている
- 期待: `X-API-Token: watchme-b2b-poc-2025`

---

## 💡 よく使うコマンド

```bash
# Vercelデプロイ確認
# → Vercel Dashboard > Deploymentsで確認

# バックエンドAPI確認
curl https://api.hey-watch.me/business/health

# DNS確認
dig business.hey-watch.me @1.1.1.1 +short

# S3確認
aws s3 ls s3://watchme-business/recordings/ --recursive --region ap-southeast-2

# バックエンドログ
ssh -i ~/watchme-key.pem ubuntu@3.24.16.82 "docker logs watchme-business-api --tail 50"
```

---

## 📊 進捗状況

| フェーズ | 進捗 | 状態 |
|---------|------|------|
| 企画・設計 | 100% | ✅ 完了 |
| インフラ構築 | 100% | ✅ 完了 |
| バックエンドAPI | 100% | ✅ 完了・稼働中 |
| フロントエンド構築 | 90% | 🚧 Vercel再デプロイ待ち |
| **Step 1: 録音→S3→DB** | **90%** | **🚧 動作確認待ち** |
| Step 2: Transcription | 0% | ⏸️ 未着手 |
| Step 3: GPT統合 | 0% | ⏸️ 未着手 |
| Step 4: UI表示 | 0% | ⏸️ 未着手 |
| Step 5: Excel/PDF出力 | 0% | ⏸️ 未着手 |

**全体進捗**: 約70%
