-- =============================================
-- Step 4: トリガー設定（updated_at自動更新）
-- =============================================
-- 実行後、「Success. No rows returned」と表示されればOK

-- 関数作成（既存でも上書き）
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- トリガー削除（存在する場合）
DROP TRIGGER IF EXISTS update_support_plans_updated_at ON business_support_plans;

-- トリガー作成
CREATE TRIGGER update_support_plans_updated_at
    BEFORE UPDATE ON business_support_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
