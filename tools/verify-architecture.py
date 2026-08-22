#!/usr/bin/env python3
"""
Pulse Architecture Verification Agent
======================================
Independently audits CLAUDE.md and PRD for internal consistency,
completeness, and architectural coherence after the Electron → Tauri migration.

Run: python verify_architecture.py <claude_md_path> <prd_path>
"""

import sys
import re
from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Tuple

@dataclass
class AuditResult:
    category: str
    check: str
    status: str  # PASS, FAIL, WARN
    detail: str = ""

@dataclass
class AuditReport:
    results: List[AuditResult] = field(default_factory=list)
    
    def add(self, category: str, check: str, status: str, detail: str = ""):
        self.results.append(AuditResult(category, check, status, detail))
    
    @property
    def passes(self): return [r for r in self.results if r.status == "PASS"]
    @property
    def fails(self): return [r for r in self.results if r.status == "FAIL"]
    @property
    def warns(self): return [r for r in self.results if r.status == "WARN"]


def load_file(path: str) -> str:
    p = Path(path)
    if not p.exists():
        print(f"ERROR: File not found: {path}")
        sys.exit(1)
    return p.read_text(encoding="utf-8")


# ─────────────────────────────────────────────
# CHECK 1: Electron remnants
# ─────────────────────────────────────────────
def check_electron_remnants(claude: str, prd: str, report: AuditReport):
    """No references to Electron as the active framework should remain."""
    electron_patterns = [
        (r'\belectron-builder\b', "electron-builder reference"),
        (r'\belectron:dev\b', "electron:dev command"),
        (r'\belectron/main\.ts\b', "electron/main.ts path"),
        (r'\belectron/preload\.ts\b', "electron/preload.ts path"),
        (r'\bchild_process\.spawn\b', "child_process.spawn pattern"),
        (r'\bws://127\.0\.0\.1', "WebSocket URL"),
        (r'\btokio-tungstenite\b', "tokio-tungstenite dependency"),
        (r'\buse-sidecar\b', "use-sidecar hook reference"),
        (r'WebSocket Server', "WebSocket Server reference"),
        (r'Renderer Process', "Electron Renderer Process reference"),
        (r'Main Process.*Spawns sidecar', "Electron Main Process spawning sidecar"),
    ]
    
    for doc_name, doc_content in [("CLAUDE.md", claude), ("PRD", prd)]:
        for pattern, desc in electron_patterns:
            matches = re.findall(pattern, doc_content, re.IGNORECASE)
            if matches:
                # Allow references in decision log or changelog (historical context)
                lines_with_match = []
                for i, line in enumerate(doc_content.split('\n'), 1):
                    if re.search(pattern, line, re.IGNORECASE):
                        lines_with_match.append((i, line.strip()[:80]))
                
                # Filter: allow in changelog, decision log, or comparison context
                active_refs = []
                for lineno, linetext in lines_with_match:
                    is_historical = any(kw in linetext.lower() for kw in [
                        'changelog', 'decision:', 'alternatives:', 'vs ', 'over electron',
                        'instead of', 'replaced', 'switched', 'v1.0 →', 'v1.1 →'
                    ])
                    if not is_historical:
                        active_refs.append((lineno, linetext))
                
                if active_refs:
                    detail = f"{doc_name}: {desc} found at line(s) {[l for l,_ in active_refs]}"
                    report.add("Electron Remnants", desc, "FAIL", detail)
                else:
                    report.add("Electron Remnants", f"{desc} (historical only)", "PASS",
                              f"{doc_name}: found only in changelog/decision context")
            else:
                report.add("Electron Remnants", f"No {desc} in {doc_name}", "PASS")


# ─────────────────────────────────────────────
# CHECK 2: Tauri presence
# ─────────────────────────────────────────────
def check_tauri_presence(claude: str, prd: str, report: AuditReport):
    """Tauri 2 must be the specified framework with correct patterns."""
    tauri_checks = [
        (r'Tauri 2', "Tauri 2 framework reference"),
        (r'src-tauri/', "src-tauri/ directory structure"),
        (r'tauri::command', "#[tauri::command] pattern"),
        (r'app_handle\.emit', "Tauri event emission"),
        (r'@tauri-apps/api', "Tauri JS API import"),
        (r'cargo tauri build', "Tauri build command"),
        (r'tauri\.conf\.json', "Tauri config file"),
        (r'WebView2', "WebView2 reference"),
    ]
    
    for pattern, desc in tauri_checks:
        found_claude = bool(re.search(pattern, claude))
        found_prd = bool(re.search(pattern, prd))
        
        if found_claude or found_prd:
            where = []
            if found_claude: where.append("CLAUDE.md")
            if found_prd: where.append("PRD")
            report.add("Tauri Presence", desc, "PASS", f"Found in {', '.join(where)}")
        else:
            report.add("Tauri Presence", desc, "FAIL", "Missing from both documents")


# ─────────────────────────────────────────────
# CHECK 3: Type contract consistency
# ─────────────────────────────────────────────
def check_type_contract(claude: str, prd: str, report: AuditReport):
    """GpuSnapshot fields must match between CLAUDE.md and PRD."""
    
    def extract_fields(text: str, struct_name: str) -> List[str]:
        pattern = rf'{struct_name}\s*\{{(.*?)\}}'
        match = re.search(pattern, text, re.DOTALL)
        if not match:
            return []
        block = match.group(1)
        fields = []
        for line in block.strip().split('\n'):
            line = line.strip()
            if ':' in line and not line.startswith('//') and not line.startswith('#'):
                field_name = line.split(':')[0].strip()
                if field_name and len(field_name) < 40:
                    fields.append(field_name)
        return fields
    
    # GpuSnapshot
    claude_fields = extract_fields(claude, "GpuSnapshot")
    prd_fields = extract_fields(prd, "GpuSnapshot")
    
    if not claude_fields:
        report.add("Type Contract", "GpuSnapshot in CLAUDE.md", "FAIL", "Could not parse fields")
    elif not prd_fields:
        report.add("Type Contract", "GpuSnapshot in PRD", "WARN", "No GpuSnapshot struct block found in PRD (may be described in prose)")
    else:
        claude_set = set(claude_fields)
        prd_set = set(prd_fields)
        
        if claude_set == prd_set:
            report.add("Type Contract", "GpuSnapshot fields match", "PASS",
                       f"{len(claude_set)} fields in sync")
        else:
            only_claude = claude_set - prd_set
            only_prd = prd_set - claude_set
            detail = ""
            if only_claude:
                detail += f"Only in CLAUDE.md: {only_claude}. "
            if only_prd:
                detail += f"Only in PRD: {only_prd}."
            report.add("Type Contract", "GpuSnapshot fields match", "WARN", detail)
    
    # ProcessInfo
    claude_pi = extract_fields(claude, "ProcessInfo")
    if claude_pi:
        report.add("Type Contract", "ProcessInfo defined in CLAUDE.md", "PASS",
                   f"Fields: {claude_pi}")
    else:
        report.add("Type Contract", "ProcessInfo in CLAUDE.md", "FAIL", "Could not parse")
    
    # DeviceInfo
    claude_di = extract_fields(claude, "DeviceInfo")
    if claude_di:
        report.add("Type Contract", "DeviceInfo defined in CLAUDE.md", "PASS",
                   f"Fields: {claude_di}")
    else:
        report.add("Type Contract", "DeviceInfo in CLAUDE.md", "FAIL", "Could not parse")
    
    # Check for Option<> wrappers (architecture review requirement)
    option_fields = re.findall(r'Option<[^>]+>', claude)
    if len(option_fields) >= 5:
        report.add("Type Contract", "Option<> wrappers on variable fields", "PASS",
                   f"Found {len(option_fields)} Option<> fields")
    else:
        report.add("Type Contract", "Option<> wrappers", "FAIL",
                   f"Only {len(option_fields)} Option<> fields — architecture review requires >=5")
    
    # Check for poll_generation
    if 'poll_generation' in claude:
        report.add("Type Contract", "poll_generation counter present", "PASS")
    else:
        report.add("Type Contract", "poll_generation counter", "FAIL", "Missing from GpuSnapshot")
    
    # Check for errors field
    if re.search(r'errors.*Vec<String>', claude):
        report.add("Type Contract", "errors field (Vec<String>) present", "PASS")
    else:
        report.add("Type Contract", "errors field", "FAIL", "Missing partial-failure error vector")


# ─────────────────────────────────────────────
# CHECK 4: Architecture review recommendations
# ─────────────────────────────────────────────
def check_architecture_review_items(claude: str, prd: str, report: AuditReport):
    """Verify all architecture review recommendations were implemented."""
    
    checks = [
        ("Tiered polling", r'[Tt]iered polling|1s/2s/5s|fast.*loop.*slow|1000ms.*2000ms.*5000ms',
         "Architecture review: tiered polling at different frequencies"),
        ("Ring buffer", r'[Rr]ing.?[Bb]uffer|circular buffer|BUFFER_SIZE.*300',
         "Architecture review: fixed-size circular buffer for history"),
        ("sysinfo crate", r'sysinfo',
         "Architecture review: sysinfo crate for process enrichment"),
        ("Process classification priority", r'priority.*chain|priority.*order|highest wins',
         "Architecture review: classification priority chain"),
        ("AccessDenied handling", r'AccessDenied|access.denied',
         "Architecture review: graceful handling of process access denied"),
        ("Canvas block map", r'[Cc]anvas.*block|block.*[Cc]anvas',
         "Architecture review: canvas-based VRAM block map"),
        ("Chart.js", r'Chart\.js',
         "Architecture review: Chart.js canvas renderer for charts"),
        ("Radix UI", r'Radix',
         "Architecture review: Radix UI for accessible primitives"),
        ("Zustand selectors", r'selector|specific.slice|never entire',
         "Architecture review: granular Zustand selectors"),
        ("NVML init once", r'init\(\).*[Oo]nce|[Oo]nce.*init|[Nn]ever reinitiali',
         "Architecture review: NVML::init() called once, never per-poll"),
    ]
    
    combined = claude + "\n" + prd
    for name, pattern, desc in checks:
        if re.search(pattern, combined):
            report.add("Architecture Review", name, "PASS", desc)
        else:
            report.add("Architecture Review", name, "FAIL", f"NOT FOUND: {desc}")


# ─────────────────────────────────────────────
# CHECK 5: PRD completeness
# ─────────────────────────────────────────────
def check_prd_completeness(prd: str, report: AuditReport):
    """Every FR should have acceptance criteria or clear spec. Key sections must exist."""
    
    required_sections = [
        "Product Overview", "Target Users", "App Shell",
        "Functional Requirements", "Non-Functional Requirements",
        "Technical Architecture", "Design Principles", "Release Plan",
        "Success Metrics", "Open Questions"
    ]
    
    for section in required_sections:
        if section.lower() in prd.lower():
            report.add("PRD Completeness", f"Section: {section}", "PASS")
        else:
            report.add("PRD Completeness", f"Section: {section}", "FAIL", "Missing from PRD")
    
    # Count FRs
    fr_count = len(re.findall(r'###?\s+FR-\d+', prd))
    if fr_count >= 10:
        report.add("PRD Completeness", f"Functional Requirements count", "PASS",
                   f"{fr_count} FRs defined")
    else:
        report.add("PRD Completeness", f"Functional Requirements count", "WARN",
                   f"Only {fr_count} FRs — expected 10+")
    
    # Check acceptance criteria exist
    ac_count = len(re.findall(r'[Aa]cceptance [Cc]riteria|must .* within \d|target:|should .* every poll', prd))
    if ac_count >= 3:
        report.add("PRD Completeness", "Acceptance criteria", "PASS",
                   f"{ac_count} sections with acceptance criteria")
    else:
        report.add("PRD Completeness", "Acceptance criteria", "WARN",
                   f"Only {ac_count} — consider adding to more FRs")
    
    # Check version roadmap
    versions = re.findall(r'v0\.\d|v1\.0', prd)
    unique_versions = set(versions)
    if len(unique_versions) >= 4:
        report.add("PRD Completeness", "Version roadmap", "PASS",
                   f"Versions mentioned: {sorted(unique_versions)}")
    else:
        report.add("PRD Completeness", "Version roadmap", "WARN",
                   f"Only {len(unique_versions)} versions in roadmap")


# ─────────────────────────────────────────────
# CHECK 6: CLAUDE.md completeness
# ─────────────────────────────────────────────
def check_claude_completeness(claude: str, report: AuditReport):
    """CLAUDE.md must have all required sections for Claude Code CLI."""
    
    required = [
        ("Stack", r'# Stack'),
        ("Architecture tree", r'```\npulse/|```\s*\npulse/'),
        ("Data Flow", r'# Data Flow'),
        ("Type Contract", r'# Key Type Contract'),
        ("Process Classification", r'# Process Classification'),
        ("Code Style", r'# Code Style'),
        ("Commands", r'# Commands'),
        ("Decision Log", r'# Decision Log'),
    ]
    
    for name, pattern in required:
        if re.search(pattern, claude):
            report.add("CLAUDE.md Completeness", name, "PASS")
        else:
            report.add("CLAUDE.md Completeness", name, "FAIL", f"Section missing: {name}")
    
    # Decision log should have entries
    decision_count = len(re.findall(r'\[2026-', claude))
    if decision_count >= 5:
        report.add("CLAUDE.md Completeness", "Decision log entries", "PASS",
                   f"{decision_count} decisions documented")
    else:
        report.add("CLAUDE.md Completeness", "Decision log entries", "WARN",
                   f"Only {decision_count} decisions — consider adding more")


# ─────────────────────────────────────────────
# CHECK 7: Cross-document consistency
# ─────────────────────────────────────────────
def check_cross_consistency(claude: str, prd: str, report: AuditReport):
    """Key facts must agree between documents."""
    
    # Framework name
    claude_tauri = 'Tauri 2' in claude or 'Tauri' in claude
    prd_tauri = 'Tauri 2' in prd or 'Tauri' in prd
    if claude_tauri and prd_tauri:
        report.add("Cross-Consistency", "Framework: both say Tauri", "PASS")
    elif claude_tauri != prd_tauri:
        report.add("Cross-Consistency", "Framework mismatch", "FAIL",
                   f"CLAUDE.md says Tauri: {claude_tauri}, PRD says Tauri: {prd_tauri}")
    
    # Product name
    if 'Pulse' in claude and 'Pulse' in prd:
        report.add("Cross-Consistency", "Product name: both say Pulse", "PASS")
    else:
        report.add("Cross-Consistency", "Product name", "FAIL", "Name inconsistency")
    
    # No NVIDIA in product name
    nvidia_name_patterns = [r'NVIDIA Kinetic', r'Neon Studio']
    for pattern in nvidia_name_patterns:
        if re.search(pattern, claude) or re.search(pattern, prd):
            report.add("Cross-Consistency", f"Deprecated name '{pattern}'", "FAIL",
                       "Old product name still present — should be Pulse")
        else:
            report.add("Cross-Consistency", f"No deprecated name '{pattern}'", "PASS")
    
    # Polling intervals match
    claude_has_tiered = bool(re.search(r'1000ms|1s.*2s.*5s', claude))
    prd_has_tiered = bool(re.search(r'1000ms|Fast.*1000', prd))
    if claude_has_tiered and prd_has_tiered:
        report.add("Cross-Consistency", "Polling intervals agree", "PASS")
    else:
        report.add("Cross-Consistency", "Polling intervals", "WARN",
                   "Could not confirm tiered polling in both documents")
    
    # Read-only scope
    claude_readonly = bool(re.search(r'NO hardware writes|display presets only', claude))
    prd_readonly = bool(re.search(r'[Rr]ead-only|does NOT write', prd))
    if claude_readonly and prd_readonly:
        report.add("Cross-Consistency", "Read-only scope: both confirm", "PASS")
    else:
        report.add("Cross-Consistency", "Read-only scope", "WARN",
                   "Could not confirm read-only in both docs")
    
    # Screen count
    claude_screens = len(re.findall(r'dashboard\.tsx|ai-workload\.tsx|settings\.tsx|Dashboard\.tsx|AiWorkload\.tsx|Settings\.tsx', claude))
    if claude_screens >= 3:
        report.add("Cross-Consistency", "3 MVP screens in CLAUDE.md", "PASS")
    else:
        report.add("Cross-Consistency", "MVP screen count", "WARN",
                   f"Found {claude_screens} screen files — expected 3")


# ─────────────────────────────────────────────
# CHECK 8: Design system alignment
# ─────────────────────────────────────────────
def check_design_system(claude: str, prd: str, report: AuditReport):
    """Design tokens and font references should be consistent."""
    
    combined = claude + "\n" + prd
    
    design_checks = [
        ("#00FF66", "Primary color token"),
        ("#0A0A0C", "Background color token"),
        ("#141519", "Surface color token"),
        ("#FF3366", "Warning color token"),
        ("Space Grotesk", "Headline/metric font"),
        ("Manrope", "Body font"),
        ("Kinetic Darkroom", "Design system name"),
        ("DESIGN.md", "Reference to design system doc"),
    ]
    
    for token, desc in design_checks:
        if token in combined:
            report.add("Design System", desc, "PASS")
        else:
            report.add("Design System", desc, "WARN", f"'{token}' not found in either document")


# ─────────────────────────────────────────────
# REPORT GENERATION
# ─────────────────────────────────────────────
def generate_report(report: AuditReport) -> str:
    lines = []
    lines.append("=" * 72)
    lines.append("  PULSE ARCHITECTURE VERIFICATION REPORT")
    lines.append("=" * 72)
    lines.append("")
    
    # Summary
    total = len(report.results)
    lines.append(f"  Total checks:  {total}")
    lines.append(f"  PASS:          {len(report.passes)}")
    lines.append(f"  FAIL:          {len(report.fails)}")
    lines.append(f"  WARN:          {len(report.warns)}")
    lines.append("")
    
    if report.fails:
        lines.append("  VERDICT:       ISSUES FOUND — review failures below")
    elif report.warns:
        lines.append("  VERDICT:       PASS WITH WARNINGS")
    else:
        lines.append("  VERDICT:       ALL CLEAR")
    
    lines.append("")
    lines.append("-" * 72)
    
    # Group by category
    categories = {}
    for r in report.results:
        categories.setdefault(r.category, []).append(r)
    
    for cat, results in categories.items():
        lines.append("")
        lines.append(f"  [{cat}]")
        lines.append("")
        for r in results:
            icon = {"PASS": "  +", "FAIL": "  X", "WARN": "  ~"}[r.status]
            lines.append(f"  {icon} [{r.status}] {r.check}")
            if r.detail and r.status != "PASS":
                lines.append(f"           {r.detail}")
    
    lines.append("")
    lines.append("-" * 72)
    
    # Failures summary
    if report.fails:
        lines.append("")
        lines.append("  FAILURES REQUIRING ATTENTION:")
        lines.append("")
        for r in report.fails:
            lines.append(f"  X  {r.category} > {r.check}")
            if r.detail:
                lines.append(f"     {r.detail}")
        lines.append("")
    
    if report.warns:
        lines.append("")
        lines.append("  WARNINGS (non-blocking):")
        lines.append("")
        for r in report.warns:
            lines.append(f"  ~  {r.category} > {r.check}")
            if r.detail:
                lines.append(f"     {r.detail}")
        lines.append("")
    
    lines.append("=" * 72)
    lines.append("  END OF VERIFICATION REPORT")
    lines.append("=" * 72)
    
    return "\n".join(lines)


def main():
    if len(sys.argv) < 3:
        # Default paths
        claude_path = "pulse-CLAUDE-v1.2.md"
        prd_path = "pulse-PRD-v1.2.md"
        print(f"Usage: python {sys.argv[0]} <claude_md> <prd_md>")
        print(f"Using defaults: {claude_path}, {prd_path}")
    else:
        claude_path = sys.argv[1]
        prd_path = sys.argv[2]
    
    claude = load_file(claude_path)
    prd = load_file(prd_path)
    
    report = AuditReport()
    
    check_electron_remnants(claude, prd, report)
    check_tauri_presence(claude, prd, report)
    check_type_contract(claude, prd, report)
    check_architecture_review_items(claude, prd, report)
    check_prd_completeness(prd, report)
    check_claude_completeness(claude, report)
    check_cross_consistency(claude, prd, report)
    check_design_system(claude, prd, report)
    
    output = generate_report(report)
    print(output)
    
    # Write report to file
    report_path = Path("pulse-verification-report.txt")
    report_path.write_text(output, encoding="utf-8")
    print(f"\nReport written to {report_path}")
    
    # Exit code: 1 if any failures
    sys.exit(1 if report.fails else 0)


if __name__ == "__main__":
    main()
