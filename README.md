# WatchMe Business API

児童発達支援事業所向け個別支援計画自動生成ツール

## 📋 プロジェクト概要

保護者ヒアリング音声から、AIを活用して個別支援計画書を自動生成するB2B向けサービス。

## 🏗️ 構成

```
business/
├── backend/               # FastAPI (Python 3.11) - Port 8052
├── frontend/              # React PWA (TypeScript) - Port 5176
├── infrastructure/        # インフラ設定
│   └── supabase/         # DB定義
└── docs/                 # ドキュメント
```

## 🌐 ポート番号

- **Backend API**: 8052
- **Frontend**: 5176

## 📚 ドキュメント

### アーキテクチャ・設計

- **[システムアーキテクチャ](./docs/ARCHITECTURE.md)** - 全体構成・データフロー・技術仕様
- **[認証・アカウント設計](./docs/AUTHENTICATION_DESIGN.md)** - Organization/Facility設計・認証体系
- **[実装計画書](./docs/IMPLEMENTATION_PLAN.md)** - 初期実装計画（参考）

### 実装ドキュメント

- **[文字起こし実装](./docs/TRANSCRIPTION_IMPLEMENTATION_PLAN.md)** - ASR実装詳細
- **[分析実装](./docs/ANALYSIS_IMPLEMENTATION_PLAN.md)** - LLM分析実装詳細
- **[ASRアーキテクチャ](./docs/ASR_ARCHITECTURE_PLAN.md)** - ASRプロバイダー選定・実装

### 運用ドキュメント

- **[テストガイド](./docs/TESTING_GUIDE.md)** - テスト手順
- **[開発進捗](./docs/NEXT_SESSION.md)** - 現在の進捗・次のタスク

### データベース

- **[DB定義](./infrastructure/supabase/create_tables.sql)** - Supabaseテーブル定義

## 🚀 技術スタック

- **Frontend**: React + TypeScript + Vite + PWA
- **Backend**: FastAPI (Python 3.11)
- **Storage**: AWS S3 (watchme-business)
- **Database**: Supabase (`business_*` テーブル)
- **ASR (文字起こし)**: Speechmatics Batch API（話者分離対応）
- **LLM (分析)**: OpenAI GPT-4o
- **Deploy**: GitHub Actions → ECR → EC2 (Sydney)

### 🎙️ ASR（文字起こし）プロバイダー

**現在の設定**: Speechmatics（デフォルト）

| プロバイダー | 状態 | 話者分離精度 | 処理速度 |
|------------|------|------------|---------|
| **Speechmatics** | ✅ 採用中 | **高精度**（3名検出） | 普通（26秒/30秒音声） |
| Deepgram | 待機中 | 普通（2名検出） | 高速 |
| Google Speech | 保留 | 未サポート | - |

#### プロバイダー切り替え方法

**環境変数で指定**:
```env
# デフォルト（指定なしでもSpeechmaticsが使われます）
ASR_PROVIDER=speechmatics

# Deepgramに変更する場合
ASR_PROVIDER=deepgram
```

**実装箇所**: `backend/app.py` の `get_asr_provider()` 関数

**切り替え手順**:
1. ローカルの`.env`に `ASR_PROVIDER=deepgram` を追加
2. 本番環境は自動的にSpeechmaticsを使用（環境変数未設定のため）
3. 本番でも変更する場合：
   - GitHub Secrets に `ASR_PROVIDER` を追加
   - `.github/workflows/deploy-to-ecr.yml` の env セクションに追加
   - docker-compose.prod.yml に環境変数を追加

## 🔧 開発状況

**進捗**: 約50% (トランスクリプション・分析機能完了)

詳細は [NEXT_SESSION.md](./NEXT_SESSION.md) 参照

---

## ⚠️ ローカル開発環境について

**現在、ローカルでのテストは不可**

- ローカルDocker環境は未整備
- フロントエンド⇔バックエンド間でCORSエラーが発生
- **テスト・動作確認は本番環境（EC2）で実施すること**

### 開発フロー

1. コード修正（ローカル）
2. 構文チェックのみ実施
   ```bash
   python3 -m py_compile backend/app.py
   ```
3. GitHub経由でデプロイ
   ```bash
   git push origin main
   ```
4. 本番環境で動作確認
   - Frontend: https://business.hey-watch.me
   - Backend: https://api.hey-watch.me/business

---

## 🧪 テスト音源

### S3パス

```
s3://watchme-business/samples/
├── full_raw.wav           # フル版（87MB・約15分）
├── section001_raw.wav     # 抜粋版・生音声（3.1MB・約30秒）★推奨
└── section001_clean.wav   # 抜粋版・ノイズ除去（3.1MB）
```

### テストスクリプト（推奨）

**自動テスト実行:**
```bash
# プロジェクトルートで実行
./test-transcription.sh section001_raw.wav
./test-transcription.sh full_raw.wav
```

このスクリプトは以下を自動実行します：
1. S3からテスト音源ダウンロード
2. `/api/upload` でアップロード（DB登録・S3保存）
3. `/api/transcribe` でトランスクリプション実行
4. 結果をJSON形式で表示

**本番同様のフルフローをテスト可能**（録音以外のすべてのプロセス）

### 手動テスト

**ローカルにダウンロード:**
```bash
aws s3 cp s3://watchme-business/samples/section001_raw.wav . \
  --region ap-southeast-2
```

**署名付きURL生成（1時間有効）:**
```bash
aws s3 presign s3://watchme-business/samples/section001_raw.wav \
  --region ap-southeast-2 --expires-in 3600
```

### 音源について

- **シチュエーション**: 保護者ヒアリング（児童発達支援）
- **録音日**: 2025-05-08
- **推奨**: `section001_raw.wav`（スマホ録音・ノイズ除去なし）

---

## 📝 License

Proprietary - WatchMe Inc.