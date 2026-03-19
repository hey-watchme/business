"""
Shared display rules for Individual Support Plan (Sheet2 / Web tab4).

Both excel_generator.py and app.py import from this module
so that Excel output and Web display stay in sync.
"""

# ── Facility constants (change per facility) ─────────────────────
FACILITY_STAFF = "ヨリドコロ横浜白楽　全職員"
DEFAULT_TIMELINE_MONTHS = 6

# Notes per row type
NOTES_DEFAULT = "専門的支援実施加算については、別紙参照。"
NOTES_FAMILY = "家族支援加算I: 必要に応じて個別相談に対応する。"
NOTES_TRANSITION = (
    "関係機関関連加算II: 1~3ヶ月に1回程度の頻度で訪問。"
    "本人の状態や支援状況の共有など、情報連携を行う。"
)
# ──────────────────────────────────────────────────────────────────


def format_timeline(months: int) -> str:
    """Convert integer months to display string."""
    return f"{months}ヶ月"


def _format_methods(methods) -> str:
    """Convert methods list to bulleted text."""
    if isinstance(methods, list):
        return "\n".join([f"• {m}" for m in methods])
    return str(methods or "")


def build_display_rows(
    assessment_v1: dict,
    session_data: dict = None,
) -> list:
    """Build the 6-row template for Sheet2 / Web tab4.

    Args:
        assessment_v1: Parsed assessment_v1 dict (support_items,
                       family_support, transition_support, etc.)
        session_data:  Dict that may contain 'subject_school_name'.

    Returns:
        List of dicts, each with keys:
            row_label, target, methods_text, domain_category,
            timeline_months, staff, notes, priority
    """
    if not assessment_v1:
        assessment_v1 = {}

    school_name = ""
    if session_data:
        school_name = session_data.get("subject_school_name", "")

    transition_staff = "\n".join(
        [part for part in [school_name, FACILITY_STAFF, "保護者"] if part]
    )

    rows = []

    # ── Rows 1-4: Personal support ───────────────────────────────
    support_items = (assessment_v1.get("support_items") or [])[:4]
    for idx, item in enumerate(support_items, start=1):
        rows.append(
            {
                "row_label": "本人支援",
                "target": item.get("target", ""),
                "methods_text": _format_methods(item.get("methods", [])),
                "domain_category": item.get("category", ""),
                "timeline_months": DEFAULT_TIMELINE_MONTHS,
                "staff": FACILITY_STAFF,
                "notes": NOTES_DEFAULT,
                "priority": str(idx),
            }
        )
    # Pad to exactly 4 rows
    for idx in range(len(support_items) + 1, 5):
        rows.append(
            {
                "row_label": "本人支援",
                "target": "",
                "methods_text": "",
                "domain_category": "",
                "timeline_months": DEFAULT_TIMELINE_MONTHS,
                "staff": FACILITY_STAFF,
                "notes": NOTES_DEFAULT,
                "priority": str(idx),
            }
        )

    # ── Row 5: Family support ────────────────────────────────────
    family = assessment_v1.get("family_support") or {}
    rows.append(
        {
            "row_label": "家族支援",
            "target": family.get("goal", ""),
            "methods_text": _format_methods(family.get("methods", [])),
            "domain_category": "",
            "timeline_months": DEFAULT_TIMELINE_MONTHS,
            "staff": f"{FACILITY_STAFF}\n保護者",
            "notes": NOTES_FAMILY,
            "priority": "",
        }
    )

    # ── Row 6: Transition + Community support (single row) ───────
    transition = assessment_v1.get("transition_support") or {}
    rows.append(
        {
            "row_label": "移行支援\n地域支援",
            "target": transition.get("goal", ""),
            "methods_text": _format_methods(transition.get("methods", [])),
            "domain_category": "",
            "timeline_months": DEFAULT_TIMELINE_MONTHS,
            "staff": transition_staff,
            "notes": NOTES_TRANSITION,
            "priority": "",
        }
    )

    return rows
