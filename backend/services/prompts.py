"""
Prompt templates for LLM-based analysis pipeline

All prompt builders follow the same interface:
- Input: session_data (dict from DB query)
- Output: prompt (str)
"""

from services.llm_pipeline import extract_from_wrapped_result


def build_fact_structuring_prompt(session_data: dict) -> str:
    """
    Build prompt for Phase 2: Fact Structuring

    Converts extraction_v1 (11 categories of raw facts)
    into fact_clusters_v1 (domain-neutral fact groups)

    Args:
        session_data: Dict with 'fact_extraction_result_v1' from DB query

    Returns:
        Prompt string for LLM

    Important principles:
    - NO interpretation or inference
    - NO causal relationships
    - NO words like "possibility", "tendency", "seems"
    - Only reorganize facts into neutral clusters
    """
    # Extract extraction_v1 from session data
    fact_extraction_data = session_data.get('fact_extraction_result_v1')
    extraction_v1 = extract_from_wrapped_result(fact_extraction_data, 'extraction_v1')

    if not extraction_v1:
        raise ValueError("extraction_v1 not found in session data")

    prompt = f"""あなたは事実整理の専門アシスタントです。

# あなたの役割（Phase 2: Fact Structuring）

あなたは **「判断をしない代わりに、判断しやすさを最大化する工程」** を担当します。

## Phase 2 の責務（DO）

✅ **やること（これだけ）**:
1. Phase 1 で抽出された事実を、後段（Phase 3）が判断しやすい形に **再配置・集積する**
2. 支援計画書で使われる観点ごとに **整理する**
3. 文脈的に近い事実を **束ねる**（同じカテゴリに集約）
4. Phase 3 が参照しやすい **"判断材料セット"** を作る

## Phase 2 で絶対にやってはいけないこと（DON'T）

❌ **解釈・評価をしない**
- 「〜と考えられる」「〜が必要である」「〜が課題である」 → 全て禁止

❌ **因果関係を作らない**
- 「〜のため」「〜が原因で」 → 事実に含まれていない限り禁止

❌ **専門家視点・支援者視点に立たない**
- 医療的・教育的な判断をしない
- あくまで「事実の整理係」

❌ **Phase 1 に存在しない情報を補完しない**
- 推測・一般論の挿入は禁止

❌ **事実を要約しすぎない**
- 情報量を減らす目的ではない
- 同義表現の軽微な整理は可

## 成功条件（自己チェック）

出力前に以下を確認してください：

1. このデータだけを見て「支援方針を書け」と言われても、まだ書けないか？ → YES なら正しい
2. しかし「何を材料に書くか」は明確か？ → YES であること

両方を満たしていれば Phase 2 は成功です。

---

# 入力データ

以下は Phase 1 で抽出された事実です（extraction_v1）:

```json
{extraction_v1}
```

---

# あなたのタスク

上記の事実を、以下の構造に **再分類** してください。
**新しい意味・評価・提案は一切加えず**、事実を整理するだけです。

# 出力形式

以下のJSON形式で出力してください。
**キー名は Phase 3 が「どこを使えばいいか」直感的に分かるように設計されています。**

```json
{{
  "fact_clusters_v1": {{
    "child_profile": {{
      "name": "string",
      "age": number,
      "birth_date": "YYYY-MM-DD",
      "gender": "string",
      "diagnosis": ["string"],
      "school_name": "string",
      "school_type": "string"
    }},

    "strengths_facts": [
      "得意なこと・できること（具体例・エピソード）",
      "学習・成長の成果（期間・達成内容）",
      "本人が好きなこと・興味があること"
    ],

    "challenges_facts": [
      "難しいこと・苦手なこと（具体例・状況）",
      "繰り返し観察される行動上の困難",
      "保護者が懸念している事項"
    ],

    "cognitive_facts": [
      "IQ値・発達検査の測定結果（数値・時期）",
      "記憶・学習・理解に関する観察",
      "認知特性に関する具体例"
    ],

    "behavior_facts": [
      "具体的な場面での行動（場所・状況・内容）",
      "行動パターン・習慣",
      "特定の状況下での反応"
    ],

    "social_communication_facts": [
      "対人関係での具体的エピソード",
      "友達・大人との関わり方",
      "コミュニケーション場面での観察"
    ],

    "physical_sensory_facts": [
      "感覚に関する観察（視覚・聴覚・触覚・痛覚等）",
      "運動能力の具体例",
      "身体的特徴"
    ],

    "daily_living_facts": [
      "食事・排泄・着替えなどの自立度",
      "日常生活での習慣・スキル",
      "生活リズム"
    ],

    "medical_facts": [
      "診断名・測定値",
      "服薬状況・通院状況",
      "アレルギー・既往歴"
    ],

    "family_context": [
      "家族構成",
      "家庭での様子・関係性",
      "兄弟姉妹との関わり"
    ],

    "parent_child_intentions": [
      {{
        "speaker": "本人 | 保護者（父） | 保護者（母）",
        "intention": "述べられた希望・意向（原文に近い表現）",
        "priority": number
      }}
    ],

    "service_administrative_facts": [
      "通園先・併用サービスの名称",
      "利用予定・検討中のサービス",
      "未解決の事務事項・手続き状況"
    ]
  }}
}}
```

---

# 禁止事項の具体例

以下は **絶対にやってはいけない** 記述例です：

❌ **解釈・評価を含む表現**:
- 「視覚的な手掛かりの方が理解しやすい可能性がある」
- 「対人スキルの向上が必要である」
- 「切り替えが課題である」

✅ **正しい表現（事実のみ）**:
- 「ひらがな読めない状態から2ヶ月で9割習得」
- 「空気が読めない」
- 「切り替えが困難（興味に集中すると他の話を聞けない）」

❌ **因果関係を作る表現**:
- 「空気が読めないことで対人トラブルになる」
- 「感覚鈍麻が原因で痛みを感じにくい」

✅ **正しい表現（別々に記述）**:
- 「空気が読めない」 + 「対人関係でいざこざ」（別カテゴリに分離）
- 「痛みには鈍感（保護者観察）」

---

**出力ルール**:
- 必ず上記のJSON形式**のみ**を出力してください
- 説明・前置き・後書きは不要です
- 中立・列挙型の文体を維持してください
"""

    return prompt
