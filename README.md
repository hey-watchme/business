# WatchMe Business API

児童発達支援事業所向け個別支援計画自動生成ツール

## 📋 プロジェクト概要

保護者ヒアリング音声から、AIを活用して個別支援計画書を自動生成するB2B向けサービス。

## 🏗️ 構成

```
business/
├── backend/               # FastAPI (Python 3.11)
├── frontend/              # React PWA (TypeScript)
├── infrastructure/        # インフラ設定
│   └── supabase/         # DB定義
└── docs/                 # ドキュメント
```

## 📚 ドキュメント

- **[実装計画書](./IMPLEMENTATION_PLAN.md)** - 全体設計・技術仕様
- **[開発進捗](./STATUS.md)** - 現在の進捗・次のタスク
- **[DB定義](./infrastructure/supabase/create_tables.sql)** - Supabaseテーブル定義

## 🚀 技術スタック

- **Frontend**: React + TypeScript + Vite + PWA
- **Backend**: FastAPI (Python 3.11)
- **Storage**: AWS S3 (watchme-business)
- **Database**: Supabase (`business_*` テーブル)
- **AI**: Groq Whisper v3 + OpenAI GPT-4o
- **Deploy**: GitHub Actions → ECR → EC2 (Sydney)

## 🔧 開発状況

**進捗**: 約50% (トランスクリプション・分析機能完了)

詳細は [NEXT_SESSION.md](./NEXT_SESSION.md) 参照

---

## 🧪 テスト音源

### S3パス（watchme-vault バケット）

```
s3://watchme-vault/test-audio/parent-interview-yoridokoro/
├── full_raw.wav           # フル版（87MB・約15分）
├── section001_raw.wav     # 抜粋版・生音声（3.1MB・約30秒）★推奨
└── section001_clean.wav   # 抜粋版・ノイズ除去（3.1MB）
```

### ローカルにダウンロード

```bash
# 推奨: 本番環境に最も近い
aws s3 cp s3://watchme-vault/test-audio/parent-interview-yoridokoro/section001_raw.wav . \
  --region ap-southeast-2

# または署名付きURL生成（1時間有効）
aws s3 presign s3://watchme-vault/test-audio/parent-interview-yoridokoro/section001_raw.wav \
  --region ap-southeast-2 --expires-in 3600
```

### テストAPI呼び出し

```bash
# 1. DBにテストセッション作成（手動またはフロントエンド）
# 2. トランスクリプション実行
curl -X POST https://api.hey-watch.me/business/api/transcribe \
  -H "Content-Type: application/json" \
  -H "X-API-Token: watchme-b2b-poc-2025" \
  -d '{"session_id": "YOUR_SESSION_ID"}'

# 3. 分析実行（日本語で返ってくる）
curl -X POST https://api.hey-watch.me/business/api/analyze \
  -H "Content-Type: application/json" \
  -H "X-API-Token: watchme-b2b-poc-2025" \
  -d '{"session_id": "YOUR_SESSION_ID"}'
```

**音源について**:
- シチュエーション: 保護者ヒアリング（児童発達支援）
- 録音日: 2025-05-08
- 推奨: `section001_raw.wav`（スマホ録音・ノイズ除去なし）

---

## 📝 License

Proprietary - WatchMe Inc.