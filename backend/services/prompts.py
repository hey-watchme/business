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

    prompt = f"""あなたは児童発達支援の事実整理アシスタントです。

【重要な原則】
1. 解釈・推論は絶対に行わない
2. 因果関係を含めない
3. 「可能性」「傾向」「～しやすい」などの推論ワードは使用禁止
4. 事実のみを中立的な領域別に再分類する

【入力データ】
以下は保護者ヒアリングから抽出された事実です（extraction_v1）:

```json
{extraction_v1}
```

【タスク】
上記の事実を、以下の構造に再分類してください。
各項目は「観察された事実」のみを記述し、解釈を加えないでください。

【出力形式】
以下のJSON形式で出力してください：

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

    "cognitive_characteristics": [
      "IQ値の測定結果（数値・時期）",
      "記憶・学習に関する観察事実",
      "学習成果の具体例（期間・達成内容）"
    ],

    "behavior_observations": [
      "具体的な場面での行動（場所・状況・行動内容）",
      "繰り返し観察される行動パターン",
      "特定の状況下での反応"
    ],

    "social_interactions": [
      "対人関係での具体的エピソード",
      "友達・大人との関わり方の観察",
      "コミュニケーション場面での事実"
    ],

    "sensory_motor": [
      "感覚に関する観察事実",
      "運動能力の具体例",
      "身体的特徴の観察"
    ],

    "play_interests": [
      "好きな遊び・活動の具体例",
      "興味・関心の対象",
      "遊びの展開方法"
    ],

    "daily_living_skills": [
      "食事・排泄・着替えなどの自立度",
      "日常生活での習慣",
      "生活スキルの具体例"
    ],

    "medical_health": [
      "診断名・測定値",
      "服薬状況",
      "通院状況"
    ],

    "family_context": [
      "家族構成",
      "家庭での様子",
      "兄弟姉妹との関係"
    ],

    "parent_concerns": [
      {{
        "concern": "保護者が述べた懸念内容（原文に近い表現）",
        "priority": number
      }}
    ],

    "parent_intentions": [
      {{
        "speaker": "本人 | 保護者",
        "intention": "述べられた希望・意向（原文に近い表現）"
      }}
    ],

    "service_context": [
      "通園先・併用サービスの名称",
      "利用予定・検討中のサービス",
      "連絡方法の希望"
    ],

    "unresolved_administrative": [
      {{
        "item": "未解決の事務事項",
        "status": "現在の状況"
      }}
    ]
  }}
}}
```

【禁止事項の例】
❌ 「視覚的な手掛かりの方が理解しやすい可能性がある」
✅ 「ひらがな読めない状態から2ヶ月で9割習得」

❌ 「空気が読めないことで対人トラブルになる」
✅ 「空気が読めない」 + 「対人関係でいざこざ」（別々に記述）

❌ 「感覚鈍麻が原因で痛みを感じにくい」
✅ 「痛みには鈍感（保護者観察）」

必ず上記のJSON形式のみを出力してください。説明や前置きは不要です。
"""

    return prompt
