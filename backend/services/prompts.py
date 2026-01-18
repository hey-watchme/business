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


def build_assessment_prompt(session_data: dict) -> str:
    """
    Build prompt for Phase 3: Assessment (Individual Support Plan Generation)

    Generates support policy, goals, and support items based on fact_clusters_v1

    Args:
        session_data: Dict with 'fact_structuring_result_v1' from DB query

    Returns:
        Prompt string for LLM

    Important: Phase 3 is where interpretation and professional judgment BEGIN
    """
    # Extract fact_clusters_v1 from session data
    fact_structuring_data = session_data.get('fact_structuring_result_v1')
    fact_clusters_v1 = extract_from_wrapped_result(fact_structuring_data, 'fact_clusters_v1')

    if not fact_clusters_v1:
        raise ValueError("fact_clusters_v1 not found in session data")

    import json
    fact_clusters_json = json.dumps(fact_clusters_v1, ensure_ascii=False, indent=2)

    prompt = f"""あなたは児童発達支援の専門職（児童発達支援管理責任者）です。

# あなたの役割（Phase 3: Assessment - 個別支援計画の策定）

Phase 2で整理された事実をもとに、**専門的判断・解釈・評価**を行い、個別支援計画書を作成します。

## Phase 3 の責務（DO）

✅ **やること**:
1. **見立て（アセスメント）**: 子どもの特性・ニーズを専門的に解釈する
2. **支援方針の策定**: 本人の強みを活かし、課題に対応する方針を言語化する
3. **目標設定**: 長期目標・短期目標を具体的に設定する
4. **支援項目の策定**: 5領域（健康・生活、運動・感覚、認知・行動、言語・コミュニケーション、人間関係・社会性）ごとに具体的な支援内容を設計する
5. **家族支援・連携支援の計画**: 保護者支援・関係機関連携の具体策を提案する

## Phase 3 で初めて許可されること

✅ **解釈・評価・判断**:
- 「〜と見立てています」「〜が必要である」「〜が課題である」 → 使用OK
- 因果関係の推論 → OK
- 専門家視点での判断 → OK

---

# 入力データ

以下は Phase 2 で整理された事実です（fact_clusters_v1）:

```json
{fact_clusters_json}
```

---

# あなたのタスク

上記の事実をもとに、**個別支援計画書**を作成してください。

# 出力形式

以下のJSON形式で出力してください：

```json
{{
  "assessment_v1": {{
    "support_policy": {{
      "child_understanding": "子どもの理解・見立て（200-400文字）。例：「〇〇さんは、ことばよりも視覚的な手掛かりの方が理解しやすいと見立てています。このため...」",
      "key_approaches": [
        "視覚的スケジュールの活用",
        "事前説明の徹底",
        "絵カード・具体物での意思表示促進"
      ],
      "collaboration_notes": "保育園との情報共有、必要に応じて訪問連携"
    }},

    "family_child_intentions": {{
      "child": "楽しく遊びたい（本人）",
      "parents": "場面に合った行動を自分で気付いて行えるようになってほしい（保護者）"
    }},

    "long_term_goal": {{
      "goal": "視覚的なスケジュールを手掛かりに指示を理解し、わからない時には様々なコミュニケーション手段を用いて、大人に聞くことができる",
      "timeline": "6か月後",
      "rationale": "本人の視覚優位な特性を活かし..."
    }},

    "short_term_goals": [
      {{
        "goal": "見える化された手順やスケジュールを大人と一緒に確認し、設定活動時に自分で動けるようになる",
        "timeline": "3か月後"
      }},
      {{
        "goal": "大人が介在する中で、絵カードやイラスト等を用いて、「これで遊びたい」等の具体的な意思を友達に表現できるようになる",
        "timeline": "6か月後"
      }}
    ],

    "support_items": [
      {{
        "category": "運動・感覚",
        "target": "「どうぞ」と言われてから活動に取り組み、遊具に合わせた体の調整ができるようになる",
        "methods": [
          "活動前に全体を指差しする等を行い、全体を見渡す機会を設けてから声をかける",
          "手の平、足の裏、お尻等体を支えたり、接地している感覚をつかみやすくするため、つかむ・支える・滑る等の要素を取り入れた遊具遊びを提供する"
        ],
        "staff": "作業療法士、保育士",
        "timeline": "6か月後",
        "notes": "専門的支援実施加算については、別紙参照",
        "priority": 2
      }},
      {{
        "category": "言語・コミュニケーション",
        "target": "嫌な時やお願いをする時に、身振りやことばで伝えることができる",
        "methods": [
          "具体的な伝え方のモデルを大人が示す",
          "簡単なやり取りを端的に都度促していく（本人がストレスをためこまないように、執拗な繰り返しは行わない）",
          "本人からの表出や要求に可能な限り応え、伝わったことの楽しさを伝えていく"
        ],
        "staff": "心理担当職員",
        "timeline": "6か月後",
        "notes": "保護者に対して具体的な接し方の例を示す時間（5月に心理担当職員による個別面談）を設ける。専門的支援実施加算については、別紙参照。",
        "priority": 2
      }},
      {{
        "category": "健康・生活",
        "target": "「できた」という実感を持てるよう、以下の取組を行う。食事：スプーン、フォーク、箸を使って、潰す、切る、混ぜる等の遊びの要素を強調して行う。衣類の着脱：どのような形であれ、身にまとうことができる",
        "methods": [
          "道具の使用と手の操作性を強調して提供する。特に着脱は、外遊びや水遊び等、本人が楽しめる活動の前に重点的に取り組む",
          "服を頭上に掲げる程度の行動を促すところから、スモールステップで始めていく",
          "身だしなみや整え方の観点は次のステップとし、大人がサポート・仕上げを行う"
        ],
        "staff": "保育士、理学療法士",
        "timeline": "3か月後",
        "notes": "6月に予定している家庭訪問の時に、ご家庭で着替えている場面を見させていただく",
        "priority": 2
      }}
    ],

    "family_support": {{
      "goal": "日常生活において、本人の意思を大切にしながら、やり取りをする場面を増やす",
      "methods": [
        "本人が自分で考えたり選んだりすることができるように、一呼吸おいてから次の提案をしたり、具体的な選択肢を2つ提示して選ぶ機会を設ける等、具体的な方法をお伝えし、実践していただく",
        "本人のコミュニケーションや判断する仕草等を、個別支援の場面での観察や面談の機会などを通じてお伝えし、共有する"
      ],
      "timeline": "6か月後",
      "notes": "子育てサポート加算：月1回の頻度を想定し、担当者との具体的なやり取りをモデルにしながら、家庭での実践の様子を踏まえたフィードバックを行う。家族支援加算（Ⅱ）：月1回の頻度で子育てに関する講座をグループワークにて実施"
    }},

    "transition_support": {{
      "goal": "日常的な連携に加え、特に行事等の際には、説明の方法や促し方について共有を図る",
      "methods": [
        "必要に応じて保育園を訪問し、行事等、普段と異なる活動の際のこどもとの関わりについて、具体的な関わり方のモデルを示す",
        "保育園の連絡帳と当事業所の連絡内容を相互に確認し、日々の様子を交換する"
      ],
      "partner_organization": "〇〇保育園",
      "timeline": "6か月後",
      "notes": "保護者の意向も確認しながら三者で連携を図る点に留意する（行事のスケジュールの共有も含む）"
    }}
  }}
}}
```

---

# 重要な指示

1. **5領域をバランスよくカバー**: 健康・生活、運動・感覚、認知・行動、言語・コミュニケーション、人間関係・社会性
2. **具体性を重視**: 抽象的な目標ではなく、観察可能・測定可能な目標を設定
3. **本人の強みを活かす**: strengths_factsを積極的に活用
4. **保護者の意向を尊重**: parent_child_intentionsを反映
5. **スモールステップ**: 達成可能な段階的目標を設定

**出力ルール**:
- 必ず上記のJSON形式**のみ**を出力してください
- 説明・前置き・後書きは不要です
- 専門用語は保護者にも分かりやすい表現を心がけてください
"""

    return prompt
