**Prompt for IDE AI Agent – Problem Classification Reference**

You must use the following as contextual understanding of the issues currently observed between RECOMMENDATIONS and SOURCES.

The system is experiencing structural misalignment between the nature of cited sources and the actions being generated. The problems are categorized below.

1. OWNERSHIP ASSUMPTION PROBLEM
   The recommendations assume that any source cited by an LLM can be directly modified or published on by the brand. This assumption is incorrect. Many sources are independent domains with no brand ownership.
   Example:
   Source – eclinicalsol.com
   Action – “Publish an expert article on this site.”
   Issue – The domain is not owned by the brand and does not allow direct publishing by external vendors.

2. EDITORIAL GATEKEEPING PROBLEM
   A large portion of sources operate under editorial control. Content changes depend on journalists, editors, or commercial teams rather than the brand.
   Example:
   Source – industry media portal
   Action – “Add competitor comparison on the source page.”
   Issue – The brand has no authority to modify editorial content.

3. PLATFORM CAPABILITY MISUNDERSTANDING
   The system ignores what actions a platform technically permits.
   Example:
   Source – Reddit thread
   Action – “Update pricing information on this source.”
   Issue – Reddit does not allow vendor-driven edits or retroactive modification.

4. SOURCE-TYPE BLINDNESS
   All sources are treated as if they belong to a single category, while in reality they include brand websites, review platforms, media articles, community forums, and analyst research.
   Example:
   Source – news article
   Action – “Edit headline to highlight Medable strengths.”
   Issue – News articles cannot be edited by the brand.

5. ACTION FEASIBILITY GAP
   Recommended actions do not reflect legal access, technical access, or required processes.
   Example:
   Source – eclinicalsol.com
   Action – “Publish Medable-focused thought leadership.”
   Issue – Such publication requires external approval and cannot be executed as an internal task.

6. CONFIDENCE INFLATION PROBLEM
   High confidence and short timelines are assigned even when the brand has zero control over the source.
   Example:
   Recommendation shows 80% confidence and 3–4 week timeline for publishing on a third-party media site.
   Issue – Outcome depends on external stakeholders and is unpredictable.

7. AEO ATTRIBUTION CONFUSION
   The system assumes that if an LLM cites a source, that source must be modified directly.
   Example:
   LLM cites an analyst article → recommendation instructs to update that article.
   Issue – Citations do not imply editing rights.

8. BRAND VS NON-BRAND BOUNDARY ISSUE
   No distinction is made between content authored by the brand and content where the brand is only the subject.
   Example:
   Source – independent comparison article
   Action – “Rewrite to emphasize Medable strengths.”
   Issue – The article is not brand content and cannot be rewritten by the vendor.

9. LEGAL AND ETHICAL CONSTRAINT BLINDNESS
   Some sources require neutrality and non-promotional tone.
   Example:
   Action – “Insert promotional messaging into independent research site.”
   Issue – Conflicts with editorial ethics and platform policies.

10. PROCESS DEPENDENCY IGNORANCE
    Actions requiring outreach, negotiation, or third-party approval are framed as simple edits.
    Example:
    Source – analyst report
    Action – “Update narrative on this report.”
    Issue – Changes depend on external organizations, not internal execution.

CORE REALITY TO RECOGNIZE
The system currently assumes:

* all sources are editable
* all platforms function like a CMS
* citation equals permission
* visibility equals control

Actual state:

* sources differ by control model
* most are not editable by the brand
* influence is often indirect
* citations do not grant publishing rights
* many actions require external processes

This context must be used to evaluate any recommendation–source pair.
