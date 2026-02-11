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
    Build prompt for Phase 2: Fact Annotation (Professional Analysis)

    Annotates each Phase 1 fact with professional analysis while
    preserving the original text verbatim. No summarization or merging.

    Phase 2 = "annotate facts with expert commentary"
    - Keep original fact text exactly as-is (identity preservation)
    - Add professional analysis (iceberg model background, strength potential)
    - Classify into 5 support domains
    - Tag setting and priority
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

    import json
    extraction_json = json.dumps(extraction_v1, ensure_ascii=False, indent=2)

    prompt = f"""あなたは児童発達支援の専門アセスメント担当者です。

# あなたの役割（Phase 2: 事実アノテーション）

あなたは**アノテーター**です。Phase 1で抽出された各事実に対して、
原文を**一切変更せずに**専門的な分析コメントを付加するのがあなたの仕事です。

Phase 1で完了していること：
- ヒアリング文字起こしからの事実抽出（11カテゴリ）
- 具体的なエピソード・数値・詳細の保持
- 保護者の意向・優先度の記録

あなたの仕事：
1. **全ての事実を原文のまま保持する**（コピー＆ペースト、言い換え禁止）
2. **各事実を5領域のいずれかに分類する**
3. **専門的な分析を付加する**（背景分析・強みの活用可能性・優先度）

---

## 絶対ルール（原文保持）

**ルール1: original_fact = Phase 1の summary の完全コピー**
- Phase 1の `summary` フィールドの内容をそのまま `original_fact` にコピーすること
- 要約・言い換え・短縮・意訳は一切禁止
- 複数の事実を1つにまとめることも禁止

**ルール2: 1対1対応**
- Phase 1の1アイテムに対し、必ずPhase 2の1アイテムを出力する
- 入力アイテム数 = 出力アイテム数
- Phase 1に25件の事実があれば、Phase 2も25件のアノテーション付きアイテムを出力する

**ルール3: 情報の欠落禁止**
- Phase 1の全ての事実が出力に含まれていること
- 些細に見える事実でもスキップ・省略してはならない

---

## 各事実に付加する内容（専門的分析）

各事実に以下を付加する：

1. **source_category**: Phase 1のどのカテゴリから来た事実か
   （例: "current_state", "strengths", "challenges" 等）

2. **category**: 5領域のいずれかに分類する：
   - `social_communication`（人間関係・社会性）
   - `cognitive_behavior`（認知・行動）
   - `health_daily_living`（健康・生活）
   - `motor_sensory`（運動・感覚）
   - `language_communication`（言語・コミュニケーション）

3. **setting**: この事実が観察された場面
   - "home"（家庭） / "school"（園） / "therapy"（療育） / "general"（全般）

4. **professional_analysis**:
   - `background`: 氷山モデル分析 - この行動の背景にある特性やニーズは何か？（簡潔に1〜2文）
   - `strength_potential`: この事実を支援の中でどう強みとして活かせるか？（該当しない場合はnull）
   - `priority`: 保護者の懸念に直結する場合は "high"、それ以外は "normal"

---

## やってはいけないこと（DON'T）

❌ 原文の書き換え・言い換え禁止
❌ 複数の事実を1つにまとめることの禁止
❌ Phase 1に存在しない事実の追加禁止
❌ 目標・支援方法・スケジュールの記述禁止（Phase 3の責務）
❌ 事実から合理的に導けない背景分析の捏造禁止

---

## 出力前の自己チェック

1. Phase 1の全ての事実が annotated_items に含まれているか？ → YES
2. original_fact は Phase 1 の summary と完全に一致しているか？ → YES
3. 各アイテムに professional_analysis が付与されているか？ → YES
4. 目標や支援方法は一切書いていないか？ → YES

**4つ全て YES であること。**

---

# 入力データ

以下は Phase 1 で抽出された事実です（extraction_v1）:

```json
{extraction_json}
```

---

# あなたのタスク

上記の各事実に専門的な分析を付加してください。
以下のJSON形式で出力してください。

# 出力形式

```json
{{{{
  "annotated_facts_v1": {{{{
    "child_profile": {{{{
      "name": "氏名",
      "age": "年齢（数値またはnull）",
      "birth_date": "YYYY-MM-DD または null",
      "gender": "性別 または null",
      "diagnosis": ["診断名"],
      "school_name": "通園先名 または null",
      "school_type": "園の種別 または null"
    }}}},

    "annotated_items": [
      {{{{
        "source_category": "Phase 1のカテゴリキー（例: current_state, strengths, challenges）",
        "original_fact": "Phase 1の summary テキストをそのまま転記 - 絶対に変更しないこと",
        "category": "social_communication | cognitive_behavior | health_daily_living | motor_sensory | language_communication",
        "setting": "home | school | therapy | general",
        "professional_analysis": {{{{
          "background": "氷山モデル：この事実の背景にある特性・ニーズの分析",
          "strength_potential": "この事実を支援の中でどう強みとして活かせるか、または null",
          "priority": "high | normal"
        }}}}
      }}}}
    ],

    "parent_child_intentions": [
      {{{{
        "speaker": "本人 | 保護者（父） | 保護者（母）",
        "original_intention": "Phase 1の summary テキストをそのまま転記",
        "priority": "high | normal"
      }}}}
    ],

    "unresolved_items": [
      {{{{
        "original_fact": "Phase 1の summary テキストをそのまま転記",
        "reason": "未解決の理由"
      }}}}
    ]
  }}}}
}}}}
```

---

# 具体例

## アノテーション例（課題）

入力（Phase 1）:
```json
{{{{"summary": "友達の作品を制作活動中に壊してしまうことがある", "confidence": "high"}}}}
```

出力:
```json
{{{{
  "source_category": "challenges",
  "original_fact": "友達の作品を制作活動中に壊してしまうことがある",
  "category": "social_communication",
  "setting": "school",
  "professional_analysis": {{{{
    "background": "他者への関わり方が分からず、反応を引き出す手段として破壊行動を選択している可能性。感覚鈍麻により力の加減が難しい可能性もある。",
    "strength_potential": null,
    "priority": "high"
  }}}}
}}}}
```

## アノテーション例（強み）

入力（Phase 1）:
```json
{{{{"summary": "メカや廃材遊びに強い集中力を発揮する", "confidence": "high"}}}}
```

出力:
```json
{{{{
  "source_category": "strengths",
  "original_fact": "メカや廃材遊びに強い集中力を発揮する",
  "category": "cognitive_behavior",
  "setting": "general",
  "professional_analysis": {{{{
    "background": "特定の興味対象に対する高い内発的動機づけがある。興味のある活動では持続的な注意力を発揮できる。",
    "strength_potential": "興味対象を対人交流や共同制作のきっかけに活用可能。集中力の持続を他の学習場面にも転用できる。",
    "priority": "normal"
  }}}}
}}}}
```

---

**出力ルール**:
- 必ず上記のJSON形式**のみ**を出力してください
- 説明・前置き・後書きは不要です
- background と strength_potential は Phase 1 の事実から合理的に導かれるものに限定してください
"""

    return prompt


def build_assessment_prompt(session_data: dict) -> str:
    """
    Build prompt for Phase 3: Assessment (Individual Support Plan Generation)

    Uses Phase 2's annotated facts (annotated_facts_v1) to generate
    a structured individual support plan.

    Phase 3 = "translate annotated facts into plan format"
    - Use Phase 2's background analysis as basis for rationale
    - Use Phase 2's strength_potential as basis for support methods
    - Map support items to 5 domains
    - Write actionable, measurable goals
    - Maintain priority alignment with parent needs

    Args:
        session_data: Dict with 'fact_structuring_result_v1' from DB query

    Returns:
        Prompt string for LLM
    """
    # Use Phase 2 annotated output
    fact_structuring_data = session_data.get('fact_structuring_result_v1')
    annotated_v1 = extract_from_wrapped_result(fact_structuring_data, 'annotated_facts_v1')

    if not annotated_v1:
        raise ValueError("annotated_facts_v1 not found in session data")

    import json
    annotated_json = json.dumps(annotated_v1, ensure_ascii=False, indent=2)

    prompt = f"""あなたは児童発達支援管理責任者です。

# あなたの役割（Phase 3: 個別支援計画書の生成）

Phase 2でアノテーションされた事実から**個別支援計画書**を生成します。

Phase 2で完了していること：
- ヒアリングから抽出された全事実の原文保持
- 5領域への分類
- 各事実への専門的分析（氷山モデルによる背景分析、強みの活用可能性）
- 保護者の懸念に基づく優先度タグ付け

あなたの仕事：**Phase 2のアノテーションを支援計画に翻訳する**
- `professional_analysis.background` → 支援が必要な根拠
- `professional_analysis.strength_potential` → 支援方法の基盤
- `priority: "high"` のアイテム → 長期目標の中心
- `parent_child_intentions` → 計画の指針となるビジョン

---

## やること（DO）

1. **Phase 2のアノテーションを最大限に活用する**
   - `background` → 支援の根拠（「なぜこの目標が必要か」）
   - `strength_potential` → 具体的な支援方法（「どう支援するか」）
   - `priority: high` → 長期目標・支援方針の中心
   - `original_fact` → 個別性を担保するために具体的なエピソードを引用

2. **支援項目を5領域にマッピングする**
   - 各支援項目は以下のいずれかに所属：健康・生活、運動・感覚、認知・行動、言語・コミュニケーション、人間関係・社会性
   - 支援者の具体的なアクションを記述する（「〜を提供する」「〜を促す」「〜を見本として示す」）

3. **氷山モデルに基づく支援設計**
   - 問題行動の単純な制止はしない
   - `background` で特定された背景ニーズに対処する
   - 代替行動の提案や環境調整を含める

4. **保護者の意向を計画の中心に据える**
   - `parent_child_intentions` を長期目標のストーリーラインとする
   - 保護者の主な願い（例：就学適応）を最終目標にする

---

## やってはいけないこと（DON'T）

❌ Phase 2のデータにない事実や分析を捏造すること
❌ 抽象的・テンプレート的な目標を書くこと（NG：「社会性を向上させる」）
  （OK：「大人の仲介のもと、絵カードを使って友達に意思を伝えることができる」）
❌ 情報の不足を一般論で補完すること
  （「ヒアリングからは情報が得られていません」と記載する）

---

## 計画生成のロジック

以下の順序で考えてください：

1. **意向の反映**: 保護者の願い（parent_child_intentions）→ 長期目標の柱
2. **根拠に基づく目標**: Phase 2の `background` を引用 →「なぜこの目標が必要か」を説明
3. **強みを活かす支援**: `strength_potential` を変換 → 具体的な支援方法
4. **5領域の網羅**: 各 support_item に領域ラベルを付与
5. **優先度の反映**: `priority: high` のアイテムが計画の中心

---

## 執筆スタイル

- **専門的かつ温かい言葉遣い**を使う
- **到達目標**（「〜ができる」）と**支援者アクション**（「〜を行う」「〜を促す」）を明確に分離する
- original_fact から**具体的な数値やエピソード**を引用し、個別性を担保する
- **スモールステップ**で：達成可能な段階的目標を設定する

---

# 入力データ

Phase 2でアノテーションされた事実（annotated_facts_v1）:

```json
{annotated_json}
```

---

# あなたのタスク

上記のアノテーション済み事実に基づき、**個別支援計画書**を作成してください。
以下のJSON形式で出力してください。

# 出力形式

```json
{{{{
  "assessment_v1": {{{{
    "support_policy": {{{{
      "child_understanding": "子どもの理解のまとめ（200〜400文字）。Phase 2の背景分析を統合し、子どもの全体像を専門的に記述する。original_factの具体的な数値やエピソードを引用すること。",
      "key_approaches": [
        "Phase 2の strength_potential に基づく具体的なアプローチ",
        "背景分析に基づく環境調整アプローチ",
        "代替行動の学習アプローチ"
      ],
      "collaboration_notes": "関係機関との連携方針"
    }}}},

    "family_child_intentions": {{{{
      "child": "parent_child_intentions からの本人の意向",
      "parents": "parent_child_intentions からの保護者の意向"
    }}}},

    "long_term_goal": {{{{
      "goal": "保護者の願いと priority:high のアイテムを中心とした長期目標",
      "timeline": "6か月後",
      "rationale": "Phase 2の背景分析に基づく根拠。なぜこの目標が必要かを専門的に説明する"
    }}}},

    "short_term_goals": [
      {{{{
        "goal": "長期目標に向けたスモールステップ。観察可能で測定可能な目標",
        "timeline": "3か月後"
      }}}}
    ],

    "support_items": [
      {{{{
        "category": "健康・生活 | 運動・感覚 | 認知・行動 | 言語・コミュニケーション | 人間関係・社会性",
        "target": "到達目標 -「〜ができる」形式",
        "methods": [
          "Phase 2の strength_potential と background に基づく支援者アクション",
          "氷山モデルアプローチ：行動の制止ではなく背景ニーズへの対処"
        ],
        "staff": "担当職種",
        "timeline": "達成期間",
        "notes": "特記事項 または「特記事項なし」",
        "priority": 1
      }}}}
    ],

    "family_support": {{{{
      "goal": "家族支援の目標",
      "methods": [
        "具体的な家族支援の方法"
      ],
      "timeline": "6か月後",
      "notes": "補足事項"
    }}}},

    "transition_support": {{{{
      "goal": "移行支援の目標",
      "methods": [
        "具体的な連携方法"
      ],
      "partner_organization": "連携先機関名",
      "timeline": "6か月後",
      "notes": "補足事項"
    }}}}
  }}}}
}}}}
```

---

# 重要な指示

1. **5領域を必ず網羅する**: 健康・生活、運動・感覚、認知・行動、言語・コミュニケーション、人間関係・社会性の全てについて support_items を生成すること
2. **Phase 2のアノテーションを最大限活用する**: background → 支援の根拠、strength_potential → 支援方法
3. **priority: high = 計画の中心**: 保護者の最大の懸念が長期目標と支援方針の核になること
4. **氷山モデルに基づく支援**: 表面の行動ではなく背景ニーズに対処すること
5. **情報が不足している場合**: 「ヒアリングからは情報が得られていません」と記載すること。特に：
   - family_child_intentions.child/parents: 本人・保護者の直接的な発言がない場合
   - transition_support.partner_organization: 連携先の情報がない場合
6. **notes フィールドは必須**: 全ての support_item に notes フィールドを含めること

**出力ルール**:
- 必ず上記のJSON形式**のみ**を出力してください
- 説明・前置き・後書きは不要です
- 保護者にも理解できる専門的な表現を使用してください
"""

    return prompt
