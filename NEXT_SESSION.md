# 次のセッション用メモ

最終更新: 2026-01-11

## ✅ CORS問題解決完了！

### 🎉 解決した問題
- NginxでOPTIONSを直接204返却していた → FastAPIに処理を委譲
- FastAPIでワイルドカード使用 → 具体的なドメインに変更
- **録音機能が正常に動作するようになった**

---

## 📋 現在の実装状況

### ✅ 完了済み（Step 1）
- 録音機能 → S3アップロード → DB保存
- 3件のテスト録音データがS3に保存済み
- CORS問題を解決（トラブルシューティング手法を文書化）

### 🚀 次の実装：Step 2 - 文字起こし機能

**実装計画書**: `/Users/kaya.matsumoto/projects/watchme/business/TRANSCRIPTION_IMPLEMENTATION_PLAN.md`

---

## 🎯 文字起こし機能の実装ステップ

### アーキテクチャ
```
Business Backend (:8052)
  ↓ POST /api/transcribe (新規エンドポイント)
  ↓ 1. DB.select() → s3_audio_path取得
  ↓ 2. S3.get_object() → 音声ダウンロード
  ↓ 3. Deepgram API呼び出し（nova-2）
  ↓ 4. DB.update() → transcription保存
Supabase
  ✅ transcription: "文字起こし結果"
  ✅ status: 'transcribed'
```

### 実装タスク

#### 1. パッケージ追加
```bash
# requirements.txt に追加
deepgram-sdk==3.7.0
tenacity>=8.2.0
```

#### 2. ASRサービスモジュール作成
```
新規ファイル: backend/services/asr_provider.py
- DeepgramASRService クラス
- transcribe_audio() メソッド（リトライ機能付き）
```

#### 3. エンドポイント追加
```
backend/app.py に追加:
- POST /api/transcribe
- TranscribeRequest/Response モデル
- S3ダウンロード → Deepgram呼び出し → DB保存
```

#### 4. 環境変数設定（3箇所セット）
```
✅ GitHub Secrets: DEEPGRAM_API_KEY
✅ docker-compose.prod.yml: environment追加
✅ .github/workflows/deploy-to-ecr.yml: env追加
```

---

## 📝 重要な参考資料

### 既存の実装
- **Deepgram実装**: `/Users/kaya.matsumoto/projects/watchme/api/vibe-analysis/transcriber-v2/app/asr_providers.py`
- **使用モデル**: Deepgram Nova-2（日本語対応）
- **SDK**: deepgram-sdk==3.7.0

### 環境変数管理
- **CLAUDE.md**: 環境変数追加時は必ず3箇所セットで設定
- **参考**: CICD_STANDARD_SPECIFICATION.md の環境変数セクション

---

## ⚠️ 注意事項

### 開発フロー
1. ローカルでコード作成
2. 構文チェック（`python3 -m py_compile`, `file`コマンド）
3. GitHub push → 自動デプロイ
4. 本番環境でテスト

### コーディング規約
- コード内コメント: 英語のみ
- ドキュメント: 日本語OK
- エンコーディング検証を必ず実施

---

## 📊 進捗状況

| フェーズ | 進捗 | 状態 |
|---------|------|------|
| 企画・設計 | 100% | ✅ 完了 |
| インフラ構築 | 100% | ✅ 完了 |
| バックエンドAPI | 100% | ✅ 完了 |
| フロントエンド構築 | 100% | ✅ 完了 |
| **Step 1: 録音→S3→DB** | **100%** | **✅ 完了** |
| **Step 2: Transcription** | **0%** | **🚧 次のタスク** |
| Step 3: GPT統合 | 0% | ⏸️ 未着手 |
| Step 4: UI表示 | 0% | ⏸️ 未着手 |
| Step 5: Excel/PDF出力 | 0% | ⏸️ 未着手 |

**全体進捗**: 約50%（基盤完成、文字起こしから実装開始）

---

## 🔗 参考リンク

- **実装計画書**: `/Users/kaya.matsumoto/projects/watchme/business/TRANSCRIPTION_IMPLEMENTATION_PLAN.md`
- **Vercel**: https://vercel.com/dashboard
- **Supabase**: https://supabase.com/dashboard/project/qvtlwotzuzbavrzqhyvt
- **GitHub Actions**: https://github.com/hey-watchme/business/actions
- **S3バケット**: s3://watchme-business/

---

## 💡 次のセッションの最初のアクション

1. **実装計画書を確認**
   ```bash
   cat /Users/kaya.matsumoto/projects/watchme/business/TRANSCRIPTION_IMPLEMENTATION_PLAN.md
   ```

2. **ステップバイステップで実装開始**
   - Step 1: requirements.txt にパッケージ追加
   - Step 2: services/asr_provider.py 作成
   - Step 3: app.py にエンドポイント追加
   - Step 4: 環境変数設定（3箇所）
   - Step 5: デプロイ＆テスト

3. **テストデータ**
   ```
   既存の録音データ:
   - session_id: 8f512662-6881-49dd-ba2f-a280f0206822
   - S3パス: recordings/.../2026-01-11/8f512662-6881-49dd-ba2f-a280f0206822.webm
   ```
