import re
from typing import Dict, List, Optional, Tuple
import pandas as pd

# ---------- helpers ----------
def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(s).lower()).strip()

def _clean_row_dict(d: Dict) -> Dict[str, Optional[str]]:
    out = {}
    for k, v in d.items():
        if v is None:
            out[str(k)] = None
        else:
            sv = str(v).strip()
            out[str(k)] = None if sv == "" or sv.lower() == "nan" else sv
    return out

def _candidate_action_cols(df: pd.DataFrame) -> List[str]:
    # tolerant column names that might hold action labels
    cands = {"action", "actions"}
    return [c for c in df.columns if _norm(c) in cands]

def _best_value_mask(df_col: pd.Series, query: str) -> pd.Series:
    """
    Create a boolean mask prioritizing:
      1) exact case-insensitive equality
      2) whole word match
      3) startswith
      4) substring / token overlap (broad)
    Returns a mask for the highest-ranked non-empty criterion.
    """
    if df_col.empty:
        return pd.Series([False] * len(df_col), index=df_col.index)

    s = df_col.astype(str)
    q = query.strip().lower()
    wb = re.compile(rf"\b{re.escape(q)}\b", re.IGNORECASE)

    m1 = s.str.lower().eq(q)                                # exact
    if m1.any(): return m1

    m2 = s.apply(lambda x: bool(wb.search(x)))              # word-boundary
    if m2.any(): return m2

    m3 = s.str.lower().str.startswith(q)                    # startswith
    if m3.any(): return m3

    # broad fuzzy: substring/token overlap
    qtok = set(_norm(query).split())
    def overlap(x: str) -> bool:
        xtok = set(_norm(x).split())
        return len(qtok & xtok) > 0
    m4 = s.apply(overlap)
    return m4

# ---------- core: search by action ----------
def find_rows_for_action(sections: Dict[str, pd.DataFrame], action: str) -> Dict[str, List[Dict]]:
    """
    For a given action, return all matching rows across all sheets.
    { sheet_name: [ {row}, ... ], ... }
    """
    out: Dict[str, List[Dict]] = {}
    for sheet, df in sections.items():
        if df is None or df.empty:
            continue
        act_cols = _candidate_action_cols(df)
        if not act_cols:
            continue
        # union of matches over all candidate action columns
        mask = pd.Series([False] * len(df), index=df.index)
        for c in act_cols:
            mask = mask | _best_value_mask(df[c], action)
        if mask.any():
            rows = [_clean_row_dict(rec) for rec in df[mask].to_dict(orient="records")]
            if rows:
                out[sheet] = rows
    return out

# ---------- core: search by function value (per sheet function field) ----------
def find_rows_for_function(
    sections: Dict[str, pd.DataFrame],
    function_value: str,
    function_field_by_sheet: Dict[str, str]
) -> Dict[str, List[Dict]]:
    """
    Use per-sheet function field (e.g., {'Eligibility': 'RuleFunction', 'FieldMappings': 'TransformFunction', ...})
    and return all rows whose function column matches the given function_value.
    """
    out: Dict[str, List[Dict]] = {}
    for sheet, df in sections.items():
        if df is None or df.empty:
            continue
        func_col = function_field_by_sheet.get(sheet)
        if not func_col or func_col not in df.columns:
            continue
        mask = _best_value_mask(df[func_col], function_value)
        if mask.any():
            rows = [_clean_row_dict(rec) for rec in df[mask].to_dict(orient="records")]
            if rows:
                out[sheet] = rows
    return out

# ---------- core: return all rows for a sheet (if present) ----------
def find_rows_for_sheet(sections: Dict[str, pd.DataFrame], sheet: str) -> List[Dict]:
    """
    Return all rows in that sheet's section. If sheet not present or empty, return [].
    """
    df = sections.get(sheet)
    if df is None or df.empty:
        return []
    return [_clean_row_dict(rec) for rec in df.to_dict(orient="records")]

# ---------- orchestrator: pull everything ----------
def extract_all_matches(
    sections: Dict[str, pd.DataFrame],
    actions: List[str],
    functions: List[str],
    function_field_by_sheet: Dict[str, str],
    sheets: List[str]
) -> Dict[str, Dict]:
    """
    Returns:
    {
      "by_action":   { action: {sheet: [rows...] } },
      "by_function": { function: {sheet: [rows...] } },
      "by_sheet":    { sheet: [rows...] }
    }
    """
    result = {"by_action": {}, "by_function": {}, "by_sheet": {}}

    # Actions
    for act in actions:
        hit = find_rows_for_action(sections, act)
        if hit:  # only include when something found
            result["by_action"][act] = hit

    # Functions (using per-sheet function column)
    for fn in functions:
        hit = find_rows_for_function(sections, fn, function_field_by_sheet)
        if hit:
            result["by_function"][fn] = hit

    # Sheets (only those present in sections)
    for sh in sheets:
        rows = find_rows_for_sheet(sections, sh)
        if rows:
            result["by_sheet"][sh] = rows

    return result

# ---------- example usage ----------
if __name__ == "__main__":
    # 1) You already have 'sections' from your fast parser:
    # sections = parse_other_examples_fast("controls_workbook.xlsx", sheet_name="Other Examples")
    # For this snippet we assume it's already available.

    # 2) Provide catalogs:
    actions = ["Harmonise", "AddColumn", "FilterRecords", "GroupBy", "AggregateBySort"]
    functions = ["formula", "formulaarray", "RuleFunctionX", "TransformA"]  # your function values
    # Per-sheet function column:
    function_field_by_sheet = {
        "Eligibility": "RuleFunction",
        "FieldMappings": "TransformFunction",
        "Enrichment": "FilterFunction",
        # add other sheets if needed
    }
    sheets = ["Eligibility", "FieldMappings", "Enrichment"]

    # 3) Run:
    # result = extract_all_matches(sections, actions, functions, function_field_by_sheet, sheets)
    # print(result)
