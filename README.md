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

**進捗**: 約30% (基盤構築完了)

詳細は [STATUS.md](./STATUS.md) 参照

## 📝 License

Proprietary - WatchMe Inc.