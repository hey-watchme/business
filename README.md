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

- **[個別支援計画生成システム 技術仕様書](./docs/INDIVIDUAL_SUPPORT_PLAN_SPEC.md)** - Phase 0-3 完全仕様（★最重要）
- **[認証・アカウント設計](./docs/AUTHENTICATION_DESIGN.md)** - Organization/Facility設計・認証体系
- **[実装計画書](./docs/IMPLEMENTATION_PLAN.md)** - 初期実装計画（参考）
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

| プロバイダー | 状態 | 話者分離精度 | 処理速度（実績） |
|------------|------|------------|-----------------|
| **Speechmatics** | ✅ 採用中 | **高精度**（3名検出） | **10.6倍速**（47分→4.5分） |
| Deepgram | 待機中 | 普通（2名検出） | 高速 |
| Google Speech | 保留 | 未サポート | - |

**Speechmaticsの処理速度実績**:
- 30秒の音声: 約26秒（ほぼリアルタイム）
- 47分27秒の音声: 4分28秒（**約10.6倍速**）

#### Speechmatics 料金体系

**API料金（従量課金）**:
- **Transcription Batch Enhanced（高精度バッチ処理）**: $0.40/時間
- **Transcription Batch Standard（標準バッチ処理）**: $0.24/時間

**Free Tier（無料プラン）**:
- **月間2時間まで無料**（Enhanced/Standard両方含む）
- 2時間を超えると上記の従量課金が適用

**重要**:
- **「Time used」は音源の再生時間**であり、処理にかかった時間ではありません
- 例：1時間45分の音源をEnhancedで処理 → 約$0.70（$0.40 × 1.75時間）
- 現在のプロジェクト設定：Enhanced モード使用中
- Free Tierの残り時間に注意（ダッシュボードで確認可能）

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

## ⚙️ Lambda関数（イベント駆動型）✅ 完全自動化

| 関数名 | トリガー | 処理 | 状態 |
|--------|---------|------|------|
| `business-audio-upload-handler` | S3 Upload | 文字起こし自動開始 | ✅ **デプロイ済み（2026-01-13）** |
| `business-transcription-completed-handler` | SQS | 分析自動開始 | ✅ デプロイ済み |

**録音から分析まで完全自動**: S3アップロード後、手動操作なしで文字起こし・LLM分析まで自動実行されます。

詳細: [lambda/audio-upload-handler/README.md](./lambda/audio-upload-handler/README.md)

## 🔧 開発状況

**進捗**: 約75% (Phase 0-3完了、Phase 4未実装)

**✅ 完了機能:**
- Phase 0: 音声アップロード・自動文字起こし（Speechmatics、話者分離）
- Phase 1: 事実抽出（11カテゴリ、約5-7秒）
- Phase 2: 事実整理（支援計画用に再分類、約6-7秒）
- Phase 3: 個別支援計画生成（5領域の支援項目、約17秒）
- イベント駆動型完全自動化（Lambda）
- DRY原則に基づく統一実装パターン

**🚧 未実装:**
- Phase 4: PDF生成（リタリコ様式）

詳細は **[個別支援計画生成システム 技術仕様書](./docs/INDIVIDUAL_SUPPORT_PLAN_SPEC.md)** 参照

---

## 💻 ローカル開発環境の起動方法
 
 ローカル環境での開発・動作確認が可能です。
 
 ### 1. バックエンド (Backend)
 
 1. ディレクトリ移動
    ```bash
    cd backend
    ```
 
 2. 仮想環境の作成と有効化（推奨）
    ```bash
    python3 -m venv venv
    source venv/bin/activate
    ```
 
 3. 依存ライブラリのインストール
    ```bash
    pip install -r requirements.txt
    ```
 
 4. サーバー起動
    ```bash
    python3 app.py
    ```
    - サーバーは `http://localhost:8052` で起動します。
    - APIドキュメント: `http://localhost:8052/docs`
 
 ### 2. フロントエンド (Frontend)
 
 1. ディレクトリ移動
    ```bash
    cd frontend
    ```
 
 2. 依存ライブラリのインストール
    ```bash
    npm install
    ```
 
 3. 開発サーバー起動
    ```bash
    npm run dev
    ```
    - ブラウザで自動的に開かない場合は `http://localhost:5173` にアクセスしてください。
 
 ### 3. 動作確認
 
 ローカルサーバー起動後、ブラウザで `http://localhost:5173`（または表示されたURL）にアクセスして動作を確認してください。
 フロントエンドはローカルのバックエンドAPI（`http://localhost:8052`）に接続するように設定されています。

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