"""
Excel Generator for Individual Support Plan (Litalico Format)

Generates Excel file based on assessment_v1 data structure
"""

from io import BytesIO
from datetime import datetime
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, Border, Side, PatternFill
from openpyxl.utils import get_column_letter


def generate_support_plan_excel(session_data: dict) -> BytesIO:
    """
    Generate Individual Support Plan Excel file

    Args:
        session_data: Dict containing assessment_result_v1 and child profile

    Returns:
        BytesIO: Excel file binary data
    """
    wb = Workbook()
    ws = wb.active
    ws.title = "Individual Support Plan"

    # Extract data
    assessment_v1 = extract_assessment_v1(session_data.get('assessment_result_v1', {}))

    if not assessment_v1:
        raise ValueError("assessment_v1 data not found")

    # Set column widths
    ws.column_dimensions['A'].width = 15
    ws.column_dimensions['B'].width = 50
    ws.column_dimensions['C'].width = 20
    ws.column_dimensions['D'].width = 15
    ws.column_dimensions['E'].width = 25
    ws.column_dimensions['F'].width = 10

    # Styles
    header_font = Font(name='Meiryo UI', size=14, bold=True)
    normal_font = Font(name='Meiryo UI', size=10)
    small_font = Font(name='Meiryo UI', size=9)

    center_align = Alignment(horizontal='center', vertical='center', wrap_text=True)
    left_align = Alignment(horizontal='left', vertical='top', wrap_text=True)

    thin_border = Border(
        left=Side(style='thin'),
        right=Side(style='thin'),
        top=Side(style='thin'),
        bottom=Side(style='thin')
    )

    header_fill = PatternFill(start_color='F2F2F2', end_color='F2F2F2', fill_type='solid')

    current_row = 1

    # Title
    ws.merge_cells(f'A{current_row}:F{current_row}')
    cell = ws[f'A{current_row}']
    cell.value = '個別支援計画書（参考記載例）'
    cell.font = header_font
    cell.alignment = center_align
    current_row += 1

    # Child name and date
    child_profile = assessment_v1.get('child_profile', {})
    child_name = child_profile.get('name', '〇〇 〇〇')
    child_age = child_profile.get('age', '5')

    ws.merge_cells(f'A{current_row}:D{current_row}')
    ws[f'A{current_row}'] = f'利用児氏名：{child_name}（{child_age}歳）'
    ws[f'A{current_row}'].font = normal_font

    ws.merge_cells(f'E{current_row}:F{current_row}')
    ws[f'E{current_row}'] = f'作成年月日：{datetime.now().strftime("%Y年%m月%d日")}'
    ws[f'E{current_row}'].font = normal_font
    ws[f'E{current_row}'].alignment = Alignment(horizontal='right')
    current_row += 2

    # Family/Child Intentions
    intentions = assessment_v1.get('family_child_intentions', {})
    ws.merge_cells(f'A{current_row}:F{current_row}')
    cell = ws[f'A{current_row}']
    cell.value = '利用児及び家族の生活に対する意向'
    cell.font = Font(name='Meiryo UI', size=10, bold=True)
    cell.fill = header_fill
    cell.border = thin_border
    current_row += 1

    ws.merge_cells(f'A{current_row}:F{current_row}')
    cell = ws[f'A{current_row}']
    intention_text = []
    if intentions.get('child'):
        intention_text.append(f"• {intentions['child']}（本人）")
    if intentions.get('parents'):
        intention_text.append(f"• {intentions['parents']}（保護者）")
    cell.value = '\n'.join(intention_text) if intention_text else ''
    cell.font = normal_font
    cell.alignment = left_align
    cell.border = thin_border
    ws.row_dimensions[current_row].height = 40
    current_row += 2

    # Support Policy
    support_policy = assessment_v1.get('support_policy', {})
    ws.merge_cells(f'A{current_row}:F{current_row}')
    cell = ws[f'A{current_row}']
    cell.value = '総合的な支援の方針'
    cell.font = Font(name='Meiryo UI', size=10, bold=True)
    cell.fill = header_fill
    cell.border = thin_border
    current_row += 1

    ws.merge_cells(f'A{current_row}:F{current_row}')
    cell = ws[f'A{current_row}']
    cell.value = support_policy.get('child_understanding', '')
    cell.font = normal_font
    cell.alignment = left_align
    cell.border = thin_border
    ws.row_dimensions[current_row].height = 80
    current_row += 2

    # Long-term Goal
    long_term_goal = assessment_v1.get('long_term_goal', {})
    ws.merge_cells(f'A{current_row}:F{current_row}')
    cell = ws[f'A{current_row}']
    cell.value = '長期目標（内容・期間等）'
    cell.font = Font(name='Meiryo UI', size=10, bold=True)
    cell.fill = header_fill
    cell.border = thin_border
    current_row += 1

    ws.merge_cells(f'A{current_row}:F{current_row}')
    cell = ws[f'A{current_row}']
    cell.value = long_term_goal.get('goal', '')
    cell.font = normal_font
    cell.alignment = left_align
    cell.border = thin_border
    ws.row_dimensions[current_row].height = 40
    current_row += 2

    # Short-term Goals
    short_term_goals = assessment_v1.get('short_term_goals', [])
    ws.merge_cells(f'A{current_row}:F{current_row}')
    cell = ws[f'A{current_row}']
    cell.value = '短期目標（内容・期間等）'
    cell.font = Font(name='Meiryo UI', size=10, bold=True)
    cell.fill = header_fill
    cell.border = thin_border
    current_row += 1

    for goal in short_term_goals:
        ws.merge_cells(f'A{current_row}:F{current_row}')
        cell = ws[f'A{current_row}']
        cell.value = f"• {goal.get('goal', '')}"
        cell.font = normal_font
        cell.alignment = left_align
        cell.border = thin_border
        ws.row_dimensions[current_row].height = 30
        current_row += 1

    current_row += 1

    # Support Items Table Header
    headers = ['項目', '支援目標\n（具体的な到達目標）', '支援内容\n（内容・支援の提供上のポイント）',
               '達成\n時期', '担当者・\n提供機関', '優先\n順位']

    for col_idx, header in enumerate(headers, start=1):
        cell = ws.cell(row=current_row, column=col_idx)
        cell.value = header
        cell.font = Font(name='Meiryo UI', size=9, bold=True)
        cell.alignment = center_align
        cell.fill = header_fill
        cell.border = thin_border

    current_row += 1

    # Support Items (5 domains)
    support_items = assessment_v1.get('support_items', [])

    for item in support_items:
        start_row = current_row

        # Category
        ws[f'A{current_row}'] = item.get('category', '')
        ws[f'A{current_row}'].font = small_font
        ws[f'A{current_row}'].alignment = center_align
        ws[f'A{current_row}'].border = thin_border

        # Target
        ws[f'B{current_row}'] = item.get('target', '')
        ws[f'B{current_row}'].font = small_font
        ws[f'B{current_row}'].alignment = left_align
        ws[f'B{current_row}'].border = thin_border

        # Methods
        methods = item.get('methods', [])
        methods_text = '\n'.join([f"• {method}" for method in methods])
        ws[f'C{current_row}'] = methods_text
        ws[f'C{current_row}'].font = small_font
        ws[f'C{current_row}'].alignment = left_align
        ws[f'C{current_row}'].border = thin_border

        # Timeline
        ws[f'D{current_row}'] = item.get('timeline', '')
        ws[f'D{current_row}'].font = small_font
        ws[f'D{current_row}'].alignment = center_align
        ws[f'D{current_row}'].border = thin_border

        # Staff
        ws[f'E{current_row}'] = item.get('staff', '')
        ws[f'E{current_row}'].font = small_font
        ws[f'E{current_row}'].alignment = left_align
        ws[f'E{current_row}'].border = thin_border

        # Priority
        ws[f'F{current_row}'] = item.get('priority', '')
        ws[f'F{current_row}'].font = small_font
        ws[f'F{current_row}'].alignment = center_align
        ws[f'F{current_row}'].border = thin_border

        ws.row_dimensions[current_row].height = 60
        current_row += 1

    # Family Support
    family_support = assessment_v1.get('family_support', {})
    if family_support:
        ws[f'A{current_row}'] = '家族支援'
        ws[f'A{current_row}'].font = small_font
        ws[f'A{current_row}'].alignment = center_align
        ws[f'A{current_row}'].border = thin_border

        ws[f'B{current_row}'] = family_support.get('goal', '')
        ws[f'B{current_row}'].font = small_font
        ws[f'B{current_row}'].alignment = left_align
        ws[f'B{current_row}'].border = thin_border

        methods = family_support.get('methods', [])
        methods_text = '\n'.join([f"• {method}" for method in methods])
        ws[f'C{current_row}'] = methods_text
        ws[f'C{current_row}'].font = small_font
        ws[f'C{current_row}'].alignment = left_align
        ws[f'C{current_row}'].border = thin_border

        ws[f'D{current_row}'] = family_support.get('timeline', '')
        ws[f'D{current_row}'].font = small_font
        ws[f'D{current_row}'].alignment = center_align
        ws[f'D{current_row}'].border = thin_border

        ws[f'E{current_row}'] = '心理担当職員\n保護者'
        ws[f'E{current_row}'].font = small_font
        ws[f'E{current_row}'].alignment = left_align
        ws[f'E{current_row}'].border = thin_border

        ws[f'F{current_row}'] = ''
        ws[f'F{current_row}'].border = thin_border

        ws.row_dimensions[current_row].height = 50
        current_row += 1

    # Transition Support
    transition_support = assessment_v1.get('transition_support', {})
    if transition_support:
        ws[f'A{current_row}'] = '移行支援'
        ws[f'A{current_row}'].font = small_font
        ws[f'A{current_row}'].alignment = center_align
        ws[f'A{current_row}'].border = thin_border

        ws[f'B{current_row}'] = transition_support.get('goal', '')
        ws[f'B{current_row}'].font = small_font
        ws[f'B{current_row}'].alignment = left_align
        ws[f'B{current_row}'].border = thin_border

        methods = transition_support.get('methods', [])
        methods_text = '\n'.join([f"• {method}" for method in methods])
        ws[f'C{current_row}'] = methods_text
        ws[f'C{current_row}'].font = small_font
        ws[f'C{current_row}'].alignment = left_align
        ws[f'C{current_row}'].border = thin_border

        ws[f'D{current_row}'] = transition_support.get('timeline', '')
        ws[f'D{current_row}'].font = small_font
        ws[f'D{current_row}'].alignment = center_align
        ws[f'D{current_row}'].border = thin_border

        partner = transition_support.get('partner_organization', '')
        ws[f'E{current_row}'] = f'児童発達支援管理責任者\n{partner}'
        ws[f'E{current_row}'].font = small_font
        ws[f'E{current_row}'].alignment = left_align
        ws[f'E{current_row}'].border = thin_border

        ws[f'F{current_row}'] = ''
        ws[f'F{current_row}'].border = thin_border

        ws.row_dimensions[current_row].height = 50
        current_row += 1

    # Footer
    current_row += 2
    ws.merge_cells(f'A{current_row}:C{current_row}')
    ws[f'A{current_row}'] = '提供する支援内容について、本計画書に基づき説明しました。'
    ws[f'A{current_row}'].font = small_font

    ws.merge_cells(f'D{current_row}:F{current_row}')
    ws[f'D{current_row}'] = '本計画書に基づき支援の説明を受け、内容に同意しました。'
    ws[f'D{current_row}'].font = small_font

    current_row += 1
    ws.merge_cells(f'A{current_row}:C{current_row}')
    ws[f'A{current_row}'] = '児童発達支援管理責任者氏名：'
    ws[f'A{current_row}'].font = small_font

    ws.merge_cells(f'D{current_row}:F{current_row}')
    ws[f'D{current_row}'] = f'{datetime.now().strftime("%Y年%m月%d日")}　（保護者署名）'
    ws[f'D{current_row}'].font = small_font

    # Save to BytesIO
    output = BytesIO()
    wb.save(output)
    output.seek(0)

    return output


def extract_assessment_v1(assessment_result: dict) -> dict:
    """
    Extract assessment_v1 from various data formats

    Handles:
    - Direct: {"assessment_v1": {...}}
    - Wrapped: {"summary": "```json\n{...}\n```"}
    """
    if not assessment_result:
        return {}

    # Case 1: Direct structure
    if 'assessment_v1' in assessment_result:
        return assessment_result['assessment_v1']

    # Case 2: Wrapped in summary
    if 'summary' in assessment_result:
        import re
        import json

        summary_text = assessment_result['summary']
        # Extract JSON from markdown code block
        json_match = re.search(r'```json\s*\n([\s\S]*?)\n```', summary_text)
        if json_match:
            try:
                parsed = json.loads(json_match.group(1))
                return parsed.get('assessment_v1', {})
            except json.JSONDecodeError:
                pass

    return {}
