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

### 🔍 処理フローを知りたい方へ

**👉 [システムアーキテクチャ](./docs/ARCHITECTURE.md)** を参照してください

- 録音からLLM分析までの全体フロー
- イベント駆動型の非同期処理
- ステータス遷移（uploaded → transcribing → transcribed → analyzing → completed）
- API仕様・AWS構成・環境変数

### 🧪 テスト方法を知りたい方へ

**👉 [テストガイド](./docs/TESTING_GUIDE.md)** を参照してください

⚠️ **注意**: このドキュメントは一部古い内容を含みます（Deepgram前提、現在はSpeechmaticsがデフォルト）

### その他のドキュメント

- **[認証・アカウント設計](./docs/AUTHENTICATION_DESIGN.md)** - Organization/Facility設計・認証体系
- **[実装計画書](./docs/IMPLEMENTATION_PLAN.md)** - 初期実装計画（参考）
- **[分析実装](./docs/ANALYSIS_IMPLEMENTATION_PLAN.md)** - LLM分析実装詳細
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

### 🎤 録音形式

**フロントエンド録音形式**: `audio/webm`

| 項目 | 詳細 |
|------|------|
| **録音形式** | WebM（ブラウザ標準） |
| **API** | MediaRecorder API |
| **変換** | なし（webmのまま送信） |
| **理由** | 転送パフォーマンス重視 |

#### なぜwebmを使用するのか

✅ **転送パフォーマンス**:
- wavより圧縮効率が高い（ファイルサイズ小）
- モバイル・Web環境で高速転送
- ネットワーク帯域の節約

✅ **ブラウザ標準**:
- MediaRecorder APIのデフォルト形式
- 追加ライブラリ不要
- クロスブラウザ対応

✅ **ASR互換性**:
- Deepgram・Speechmatics両方がwebmをネイティブサポート
- API側で自動的に最適な形式に変換
- wav変換不要

#### wav 16kHz モノラル変換は不要

**現在の設計では変換不要**:
- ASR APIが内部で最適な形式に自動変換
- フロントエンドで変換すると、ブラウザ負荷＋転送サイズ増加
- webmのまま送る方がパフォーマンス向上

**処理フロー**:
```
フロントエンド (MediaRecorder)
  → audio/webm 録音
  → そのままアップロード (app.py:137)
  → S3保存 (webm)
  → ASR API送信 (webm)
  → ASR側で自動変換
  → 文字起こし結果
```

## ⚙️ Lambda関数（イベント駆動型）

| 関数名 | トリガー | 処理 | 状態 |
|--------|---------|------|------|
| `business-audio-upload-handler` | S3 Upload | 文字起こし自動開始 | ✅ 実装完了（未デプロイ） |
| `business-transcription-completed-handler` | SQS | 分析自動開始 | ✅ デプロイ済み |

詳細: [lambda/audio-upload-handler/README.md](./lambda/audio-upload-handler/README.md)

## 🔧 開発状況

**進捗**: 約60% (トランスクリプション・分析・自動化完了)

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