-- =============================================
-- Step 6: 確認クエリ
-- =============================================
-- 実行後、カラム一覧が表示されればOK
-- 以下のカラムが含まれていることを確認：
--   - child_intention_ai_generated / child_intention_user_edited
--   - general_policy_ai_generated / general_policy_user_edited
--   - support_items_ai_generated / support_items_user_edited

SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'business_support_plans'
ORDER BY ordinal_position;
