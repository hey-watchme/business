-- =============================================
-- Step 5: RLSポリシー設定（開発用シンプル版）
-- =============================================
-- 実行後、「Success. No rows returned」と表示されればOK

-- RLS有効化
ALTER TABLE business_support_plans ENABLE ROW LEVEL SECURITY;

-- 既存ポリシーを削除
DROP POLICY IF EXISTS "Users can view support plans in their facility" ON business_support_plans;
DROP POLICY IF EXISTS "Users can insert support plans in their facility" ON business_support_plans;
DROP POLICY IF EXISTS "Users can update support plans in their facility" ON business_support_plans;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON business_support_plans;
DROP POLICY IF EXISTS "Allow all for service role" ON business_support_plans;

-- 開発用: 認証済みユーザーに全権限
CREATE POLICY "Allow all for authenticated users"
ON business_support_plans FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- サービスロール（バックエンドAPI）に全権限
CREATE POLICY "Allow all for service role"
ON business_support_plans FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');
