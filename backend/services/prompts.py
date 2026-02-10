"""
Prompt templates for LLM-based analysis pipeline

All prompt builders follow the same interface:
- Input: session_data (dict from DB query)
- Output: prompt (str)

Phase 1: build_fact_extraction_prompt()  - Fact extraction from transcription
Phase 2: build_fact_structuring_prompt() - Fact restructuring for support plan
Phase 3: build_assessment_prompt()       - Individual support plan generation
"""

from services.llm_pipeline import extract_from_wrapped_result


def build_fact_extraction_prompt(
    transcription: str,
    subject: dict = None,
    age_text: str = "不明",
    attendees: dict = None,
    staff_name: str = "不明",
    recorded_at: str = "不明"
) -> str:
    """
    Build prompt for Phase 1: Fact Extraction

    Extracts facts from transcription into 11 categories.
    NO interpretation, inference, or evaluation.

    Args:
        transcription: Transcription text from ASR
        subject: Subject info dict (name, birth_date, gender, diagnosis, etc.)
        age_text: Pre-calculated age string (e.g. "5歳")
        attendees: Attendees dict (father, mother flags)
        staff_name: Interviewer name
        recorded_at: Interview date/time

    Returns:
        Prompt string for LLM
    """
    if not subject:
        subject = {}
    if not attendees:
        attendees = {}

    parent_str = ""
    if attendees.get('father'):
        parent_str += "父"
    if attendees.get('mother'):
        parent_str += ("・母" if parent_str else "母")
    if not parent_str:
        parent_str = "不明"

    diagnosis_str = ', '.join(subject.get('diagnosis', [])) if subject.get('diagnosis') else '不明'

    prompt = f"""あなたは児童発達支援の専門アセスメント担当者です。

# あなたの役割（Phase 1: Fact Extraction）

個別支援計画書を作成するために、保護者ヒアリングから「支援の根拠となる事実」を抽出します。

【事前情報】
■ 支援対象者（Subject）
- 氏名: {subject.get('name', '不明')}
- 生年月日: {subject.get('birth_date', '不明')}
- 年齢: {age_text}
- 性別: {subject.get('gender', '不明')}
- 診断: {diagnosis_str}
- 通園・通学先: {subject.get('school_name', '不明') if subject.get('school_name') else '不明'}
- 学校種別: {subject.get('school_type', '不明')}
- 特性・認知タイプ: {subject.get('cognitive_type', '不明')}

■ 参加者
- 保護者: {parent_str}

■ インタビュアー
- 氏名: {staff_name}

■ 実施情報
- 日時: {recorded_at}

---

# 除外対象（IGNORE）

以下のトピックは個別支援計画書には不要です。**完全に無視してください。**

- 契約手続き、利用料金、支払い方法（おやつ代、教材費等）
- 連絡用アプリ（コドモン等）の設定、写真購入、受給者証の申請手続き
- 当日の持ち物、服装（スモック等）、送迎ルート
- ハンコ・訂正印・書類の受け渡し等の事務的やり取り
- 施設案内、見学時の雑談

---

# 抽出対象（MUST KEEP）

以下の5領域に該当する**具体的なエピソード・数値・発言**を抽出してください。

## 1. 本人の特性・行動
- 診断名、検査結果（IQ値等の数値データ）
- 興味関心（好きなもの・夢中になること）
- 得意なこと・不得意なこと
- 身体の動き・運動面の特徴
- 認知特性（視覚優位等）

## 2. 対人関係・社会性
- 友達との関わり方（具体的な場面）
- 集団での様子（園・学校）
- コミュニケーションの特徴
- トラブルの具体的エピソード

## 3. 健康・生活習慣
- 食事（好き嫌い、食べ方、偏食）
- 排泄（オムツ、トイレトレーニングの状況）
- 服薬状況、アレルギー
- 睡眠、着替え、身の回りの自立度

## 4. 本人の意向
- 体験の感想（「楽しかった」等）
- やりたいこと、好きな遊び
- 本人が表現した気持ち

## 5. 保護者の意向・課題
- 将来の不安（就学等）
- 優先して解決したい問題
- 家庭での困りごと
- 支援への期待・希望

---

# ルール

## やること（DO）
✅ 事実・発言・観察内容のみを抽出する
✅ 具体的なエピソードを保持する（例：「友達の作品を壊す」「スキップができない」）
✅ 場面情報（いつ・どこで）をセットで残す（例：「家庭では〜」「幼稚園では〜」「療育では〜」）
✅ 数値データは正確に記録する（IQ値、年齢、期間等）
✅ 曖昧な場合は confidence を "low" にして残す

## やってはいけないこと（DON'T）
❌ 判断・評価・目標設定・支援計画の作成
❌ 推測や一般論による補完
❌ 事務連絡・契約関連の情報を含めること
❌ 因果関係の推論（「〜のため」「〜が原因で」）

## 迷ったら残す原則
⚠️ **判断に迷う発言は、削除せずに抽出してください。**
- 要約せず、可能な限り発言のニュアンスを維持した形で抽出すること
- confidence を "low" に設定し、後段（Phase 2-3）に判断を委ねること

---

# 出力形式

以下のJSON形式で出力してください。
原文引用（source）は含めないでください。

{{
  "extraction_v1": {{
    "basic_info": [
      {{
        "field": "項目名",
        "value": "値",
        "confidence": "high/medium/low"
      }}
    ],
    "current_state": [
      {{
        "summary": "現在の状況の要約",
        "confidence": "high/medium/low"
      }}
    ],
    "strengths": [
      {{
        "summary": "強みの要約",
        "confidence": "high/medium/low"
      }}
    ],
    "challenges": [
      {{
        "summary": "課題の要約",
        "confidence": "high/medium/low"
      }}
    ],
    "physical_sensory": [
      {{
        "summary": "身体・感覚の要約",
        "confidence": "high/medium/low"
      }}
    ],
    "medical_development": [
      {{
        "summary": "医療・発達の要約",
        "confidence": "high/medium/low"
      }}
    ],
    "family_environment": [
      {{
        "summary": "家族・環境の要約",
        "confidence": "high/medium/low"
      }}
    ],
    "parent_intentions": [
      {{
        "summary": "保護者の希望",
        "priority": 1,
        "confidence": "high/medium/low"
      }}
    ],
    "staff_notes": [
      {{
        "summary": "スタッフの観察・メモ",
        "confidence": "high/medium/low"
      }}
    ],
    "administrative_notes": [
      {{
        "summary": "事務的な内容",
        "confidence": "high/medium/low"
      }}
    ],
    "unresolved_items": [
      {{
        "summary": "未解決・保留事項",
        "reason": "理由"
      }}
    ]
  }}
}}

**出力ルール**:
- 必ず上記のJSON形式**のみ**を出力してください
- 説明・前置き・後書きは不要です

【ヒアリングのトランスクリプション】
{transcription}
"""

    return prompt


def build_fact_structuring_prompt(session_data: dict) -> str:
    """
    Build prompt for Phase 2: Fact Structuring + Professional Formulation

    Reorganizes extraction_v1 (11 categories) into fact_clusters_v1
    with professional interpretation (iceberg model, strengths analysis).

    Phase 2 = "preparation for plan writing"
    - Reorganize facts by domain with setting info
    - Analyze behavioral backgrounds (iceberg model)
    - Identify strengths and their potential use in support
    - Tag priorities based on parent needs
    - Do NOT write goals, methods, or schedules (Phase 3's job)

    Args:
        session_data: Dict with 'fact_extraction_result_v1' from DB query

    Returns:
        Prompt string for LLM
    """
    # Extract extraction_v1 from session data
    fact_extraction_data = session_data.get('fact_extraction_result_v1')
    extraction_v1 = extract_from_wrapped_result(fact_extraction_data, 'extraction_v1')

    if not extraction_v1:
        raise ValueError("extraction_v1 not found in session data")

    prompt = f"""あなたは児童発達支援の専門アセスメント担当者です。

# あなたの役割（Phase 2: Fact Structuring + Professional Formulation）

Phase 1で抽出された事実を**5領域に整理**し、**専門的な見立て（背景の分析・強みの特定）**を行います。
Phase 3が「目標」と「支援内容」を書くための **"下ごしらえ"を完成させる** 工程です。

---

## Phase 2 の責務（DO）

✅ **事実を5領域に整理する**
- Phase 1の事実を、支援計画書の5領域に再配置する
- 文脈的に近い事実を束ねる

✅ **場面（setting）を明記する**
- 各事実に「家庭」「園」「療育」「全般」等の場面情報を付加する
- 同じ行動でも場面によって異なる場合は、別々の事実として記録する
- 例: 「幼稚園では友達と遊べる」「家庭では一人遊びが多い」

✅ **氷山モデル的思考：行動の背景を分析する**
- 表面的な行動だけでなく、その背景にある特性・機能を推測する
- 例: 「友達の作品を壊す」→ 背景:「他者への関わり方が分からず、反応を引き出す手段として選択している可能性」
- 例: 「じっとしていられない」→ 背景:「環境への注意散漫（特性）」かつ「高い好奇心（強み）」

✅ **強みの活用可能性を特定する**
- 本人の強みが支援でどう活かせるかのヒントを記載する
- 例: 「メカが好き」→ 活用:「集中力の持続」「対人交流や共同制作のきっかけ」

✅ **優先度タグを付与する**
- 保護者のニーズと直結する課題に "high" タグを付ける
- 例: 保護者が「小学校でのトラブルが一番心配」→ 関連する課題に priority: "high"

---

## Phase 2 でやってはいけないこと（DON'T）

❌ **Phase 1に存在しない事実を捏造しない**
- 推測・一般論の挿入は禁止
- 背景分析は事実から合理的に導かれるものに限る

❌ **具体的な支援方法・目標・スケジュールを書かない**
- 「〜を目標にする」「〜という支援を行う」→ Phase 3の責務
- あくまで「見立て」と「材料の整理」まで

❌ **事実を要約しすぎない**
- 具体的なエピソード・数値は保持する
- 情報量を減らす目的ではない

---

## 成功条件（自己チェック）

出力前に以下を確認してください：

1. このデータを見て「なぜこの行動が起きるか」の仮説があるか？ → YES
2. 「この子の強みをどう使うか」のヒントが見えるか？ → YES
3. しかし具体的な「目標文」や「支援方法」はまだ書いていないか？ → YES

**3つ全て YES なら Phase 2 は成功です。**

---

# 入力データ

以下は Phase 1 で抽出された事実です（extraction_v1）:

```json
{extraction_v1}
```

---

# あなたのタスク

上記の事実を、以下の構造に**整理・分析**してください。
各事実に場面情報と専門的な見立て（背景・強みの活用可能性）を付加します。

# 出力形式

以下のJSON形式で出力してください。

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
      {{
        "fact": "得意なこと・できること（具体例・エピソード）",
        "setting": "家庭 | 園 | 療育 | 全般",
        "strength_use": "この強みを支援でどう活かせるかのヒント"
      }}
    ],

    "challenges_facts": [
      {{
        "fact": "難しいこと・苦手なこと（具体例・状況）",
        "setting": "家庭 | 園 | 療育 | 全般",
        "background": "氷山モデル：この行動の背景にある特性・機能の推測",
        "priority": "high | normal"
      }}
    ],

    "cognitive_facts": [
      {{
        "fact": "IQ値・発達検査の測定結果（数値・時期）、認知特性の観察",
        "setting": "家庭 | 園 | 療育 | 全般",
        "background": "認知特性の背景分析（該当する場合）"
      }}
    ],

    "behavior_facts": [
      {{
        "fact": "具体的な場面での行動（状況・内容）",
        "setting": "家庭 | 園 | 療育 | 全般",
        "background": "氷山モデル：行動の背景にある特性・機能"
      }}
    ],

    "social_communication_facts": [
      {{
        "fact": "対人関係での具体的エピソード、コミュニケーション場面の観察",
        "setting": "家庭 | 園 | 療育 | 全般",
        "background": "社会性・コミュニケーション特性の背景分析"
      }}
    ],

    "physical_sensory_facts": [
      {{
        "fact": "感覚に関する観察、運動能力の具体例",
        "setting": "家庭 | 園 | 療育 | 全般",
        "background": "感覚・運動特性の背景分析（該当する場合）"
      }}
    ],

    "daily_living_facts": [
      {{
        "fact": "食事・排泄・着替えなどの自立度、生活習慣",
        "setting": "家庭 | 園 | 療育 | 全般",
        "background": "生活スキルの背景分析（該当する場合）"
      }}
    ],

    "medical_facts": [
      {{
        "fact": "診断名・測定値、服薬・通院状況、アレルギー",
        "setting": "全般"
      }}
    ],

    "family_context": [
      {{
        "fact": "家族構成、家庭での様子・関係性",
        "setting": "家庭"
      }}
    ],

    "parent_child_intentions": [
      {{
        "speaker": "本人 | 保護者（父） | 保護者（母）",
        "intention": "述べられた希望・意向（原文に近い表現）",
        "priority": "high | normal"
      }}
    ],

    "service_administrative_facts": [
      {{
        "fact": "通園先・併用サービスの名称、利用予定",
        "setting": "全般"
      }}
    ]
  }}
}}
```

---

# 具体例

## 氷山モデルの記述例

✅ **良い例**:
```json
{{
  "fact": "友達の作品を壊してしまう",
  "setting": "園・制作活動中",
  "background": "他者への関わり方が分からず、反応を引き出す手段として破壊行動を選択している可能性。感覚鈍麻により力の加減が難しい可能性もある",
  "priority": "high"
}}
```

## 強みの活用例

✅ **良い例**:
```json
{{
  "fact": "メカや廃材遊びに強い集中力を発揮する",
  "setting": "家庭・園",
  "strength_use": "興味対象を対人交流や共同制作のきっかけに活用可能。集中力の持続を他の学習場面にも転用できる"
}}
```

---

**出力ルール**:
- 必ず上記のJSON形式**のみ**を出力してください
- 説明・前置き・後書きは不要です
- background や strength_use は Phase 1 の事実から合理的に導かれるものに限定してください
"""

    return prompt


def build_assessment_prompt(session_data: dict) -> str:
    """
    Build prompt for Phase 3: Assessment (Individual Support Plan Generation)

    Translates Phase 2's professional formulation (background analysis,
    strengths profile) into a structured individual support plan.

    Phase 3 = "translate formulation into plan format"
    - Use Phase 2's background/strength_use as basis for goals and methods
    - Map support items to 5 domains
    - Write actionable, measurable goals
    - Maintain priority alignment with parent needs

    Args:
        session_data: Dict with 'fact_structuring_result_v1' from DB query

    Returns:
        Prompt string for LLM
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

Phase 2で整理・分析された事実と見立て（背景分析・強みの活用可能性）を、
**個別支援計画書のフォーマットに翻訳する** 工程です。

Phase 2で完了していること：
- 事実の5領域への分類
- 氷山モデルによる行動の背景分析（background）
- 強みの活用可能性の特定（strength_use）
- 保護者ニーズに基づく優先度タグ（priority）

あなたの仕事は、これらの分析結果を **具体的な目標と支援内容** に変換することです。

---

## Phase 3 の責務（DO）

✅ **Phase 2の分析結果を計画書に翻訳する**
- background（背景分析）→ 「支援が必要な理由（根拠）」として活用
- strength_use（強みの活用可能性）→ 「具体的な支援の手立て（手法）」に変換
- priority: high の項目 → 長期目標・総合的な支援の方針の核心に反映

✅ **5領域への支援項目マッピング**
- 各支援項目を5領域（健康・生活、運動・感覚、認知・行動、言語・コミュニケーション、人間関係・社会性）に分類
- 支援者の具体的アクションで記述（「〜を促す」「〜を提示する」「〜を提供する」）

✅ **氷山モデルに基づく支援内容の設計**
- 問題行動の制止ではなく、背景にあるニーズを満たすアプローチを設計
- 代替行動の学習、環境調整（構造化）を支援内容に含める
- 例: 「作品を壊す」→ 背景:反応を求めている → 支援:適切な関わり方のモデルを示す

✅ **保護者の意向を計画の軸にする**
- parent_child_intentions の内容を長期目標のストーリーに組み込む
- 保護者の願い（例: 小学校への適応）を最終ゴールとして設定

---

## Phase 3 でやってはいけないこと（DON'T）

❌ **Phase 2に存在しない事実や分析を捏造しない**
- background や strength_use に記載されていない推測は行わない

❌ **抽象的・テンプレート的な目標を書かない**
- 「社会性を向上させる」→ NG
- 「大人が介在する中で、絵カードを用いて友達に意思を表現できる」→ OK

❌ **情報不足を一般論で補完しない**
- ヒアリングから得られなかった情報は「情報が取得できませんでした」と記載

---

## 計画生成の論理構造

以下の順序で思考し、計画書を作成してください：

1. **意向の反映**: 保護者の願い（parent_child_intentions）を長期目標の柱とする
2. **根拠に基づく目標**: Phase 2の background を引用し、「なぜこの目標が必要か」が伝わる文章にする
3. **強み活用の支援案**: strength_use を具体的な支援方法に変換する
4. **5領域の網羅**: 各支援項目に該当する領域を明記する
5. **優先度の反映**: priority: high の課題を計画書の中心に据える

---

## 執筆スタイル

- **「専門的」かつ「温かい」表現** を用いる
- **本人の到達目標**（「〜ができる」）と **支援者のアクション**（「〜を行う」）を明確に分ける
- **具体的な数値・エピソード** を適宜引用し、個別性を高める（IQ値、具体的な行動エピソード等）
- **スモールステップ**: 達成可能な段階的目標を設定する

---

# 入力データ

以下は Phase 2 で整理・分析された事実です（fact_clusters_v1）:

```json
{fact_clusters_json}
```

---

# あなたのタスク

上記の分析結果をもとに、**個別支援計画書**を作成してください。

# 出力形式

以下のJSON形式で出力してください：

```json
{{
  "assessment_v1": {{
    "support_policy": {{
      "child_understanding": "子どもの理解・見立て（200-400文字）。Phase 2のbackground分析を統合し、この子の全体像を専門的に記述する。具体的な数値やエピソードを引用して個別性を高める。",
      "key_approaches": [
        "Phase 2のstrength_useに基づく具体的アプローチ",
        "背景分析に基づく環境調整・構造化のアプローチ",
        "代替行動の学習を促すアプローチ"
      ],
      "collaboration_notes": "関係機関との連携方針"
    }},

    "family_child_intentions": {{
      "child": "本人の意向（Phase 2のparent_child_intentionsから）",
      "parents": "保護者の意向（Phase 2のparent_child_intentionsから）"
    }},

    "long_term_goal": {{
      "goal": "保護者の願いを軸にした長期目標。priority: highの課題を中心に据える",
      "timeline": "6か月後",
      "rationale": "Phase 2のbackground分析に基づく根拠。なぜこの目標が必要かを専門的に説明"
    }},

    "short_term_goals": [
      {{
        "goal": "長期目標に向けたスモールステップ。観察可能・測定可能な表現で記述",
        "timeline": "3か月後"
      }}
    ],

    "support_items": [
      {{
        "category": "健康・生活 | 運動・感覚 | 認知・行動 | 言語・コミュニケーション | 人間関係・社会性",
        "target": "本人の到達目標（「〜ができる」）",
        "methods": [
          "支援者の具体的アクション（「〜を促す」「〜を提示する」）。Phase 2のstrength_useやbackgroundに基づく",
          "氷山モデルに基づくアプローチ：問題行動の制止ではなく、背景ニーズを満たす代替行動・環境調整を記述"
        ],
        "staff": "担当職種",
        "timeline": "達成時期",
        "notes": "専門的支援実施加算や配慮事項。留意事項がない場合は「特記事項なし」",
        "priority": 1
      }}
    ],

    "family_support": {{
      "goal": "家族支援の目標",
      "methods": [
        "具体的な家族支援の方法"
      ],
      "timeline": "6か月後",
      "notes": "加算情報等"
    }},

    "transition_support": {{
      "goal": "移行支援・地域連携の目標",
      "methods": [
        "具体的な連携方法"
      ],
      "partner_organization": "連携先機関名",
      "timeline": "6か月後",
      "notes": "留意事項"
    }}
  }}
}}
```

---

# 重要な指示

1. **5領域を必ず網羅**: 健康・生活、運動・感覚、認知・行動、言語・コミュニケーション、人間関係・社会性の全てについて support_items を生成すること
2. **Phase 2の分析結果をフル活用**: background → 支援の根拠、strength_use → 支援の手法として必ず組み込む
3. **priority: high を計画の中心に**: 保護者が最も心配している課題を長期目標・支援方針の核心にする
4. **氷山モデルに基づく支援**: 問題行動そのものではなく、背景にあるニーズへのアプローチを設計する
5. **情報不足時の対応**: ヒアリングから十分な情報が得られない項目は「情報が取得できませんでした」と記載。特に以下に注意：
   - family_child_intentions.child/parents: 本人・保護者の発言がない場合
   - transition_support.partner_organization: 連携先機関の情報がない場合
6. **notes フィールドは必須**: 各 support_item に notes フィールドを必ず含める

**出力ルール**:
- 必ず上記のJSON形式**のみ**を出力してください
- 説明・前置き・後書きは不要です
- 専門用語は保護者にも分かりやすい表現を心がけてください
"""

    return prompt
