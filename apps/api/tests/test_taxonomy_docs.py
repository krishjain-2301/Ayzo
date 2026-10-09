"""
Keep the taxonomy and the methodology doc in sync.

Section 9 of METHODOLOGY.md once listed "No cross-user test" long after the
category existed, and taxonomy.py mapped a category to an OWASP id that was not
in the OWASP table (a KeyError waiting to happen). These tests make both classes
of drift fail CI instead of a reader.
"""

from pathlib import Path

import pytest

from app.attack_library.taxonomy import ATLAS, OWASP, _MAP, taxonomy_for

METHODOLOGY = Path(__file__).resolve().parents[3] / "docs" / "METHODOLOGY.md"


@pytest.mark.parametrize("category", sorted(_MAP))
def test_every_category_resolves(category):
    """taxonomy_for must not raise and must name both standards it claims."""
    owasp_id, atlas_id = _MAP[category]
    assert owasp_id in OWASP, f"{category} maps to {owasp_id}, missing from OWASP table"
    assert atlas_id is None or atlas_id in ATLAS, f"{category} maps to unknown ATLAS id {atlas_id}"

    tax = taxonomy_for(category)
    assert tax["owasp"]["name"]
    if atlas_id is None:
        assert tax["atlas"] is None
    else:
        assert tax["atlas"]["name"]


def _standards_section() -> str:
    text = METHODOLOGY.read_text(encoding="utf-8")
    start = text.index("## 5. Standards mapping")
    end = text.index("\n## ", start)
    return text[start:end]


@pytest.mark.parametrize("category", sorted(_MAP))
def test_every_category_is_documented(category):
    """Each mapped category must appear in the methodology's standards table."""
    section = _standards_section()
    assert category in section, (
        f"'{category}' is in taxonomy.py but not in METHODOLOGY.md section 5. "
        "Add it to the standards table."
    )
