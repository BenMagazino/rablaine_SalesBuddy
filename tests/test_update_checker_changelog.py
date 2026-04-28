"""Tests for changelog parsing and entry filtering in update_checker."""
from app.services.update_checker import parse_changelog, entries_newer_than


class TestParseChangelog:
    def test_parses_single_section(self):
        text = """# Changelog

## 2026-04-28
- First change
- Second change
"""
        entries = parse_changelog(text)
        assert len(entries) == 1
        assert entries[0]['date'] == '2026-04-28'
        assert entries[0]['bullets'] == ['First change', 'Second change']

    def test_parses_multiple_sections(self):
        text = """## 2026-04-28
- Newer change

## 2026-04-21
- Older change one
- Older change two
"""
        entries = parse_changelog(text)
        assert len(entries) == 2
        assert entries[0]['date'] == '2026-04-28'
        assert entries[1]['date'] == '2026-04-21'
        assert entries[1]['bullets'] == ['Older change one', 'Older change two']

    def test_ignores_intro_text(self):
        text = """# Changelog

Some intro paragraph that should be ignored.

## 2026-04-28
- Real change
"""
        entries = parse_changelog(text)
        assert len(entries) == 1
        assert entries[0]['bullets'] == ['Real change']

    def test_drops_empty_sections(self):
        text = """## 2026-04-28

## 2026-04-21
- Has a bullet
"""
        entries = parse_changelog(text)
        assert len(entries) == 1
        assert entries[0]['date'] == '2026-04-21'

    def test_supports_asterisk_bullets(self):
        text = """## 2026-04-28
* Asterisk bullet
"""
        entries = parse_changelog(text)
        assert entries[0]['bullets'] == ['Asterisk bullet']

    def test_appends_indented_continuation_to_last_bullet(self):
        text = """## 2026-04-28
- First line
  continued on second line
- Second bullet
"""
        entries = parse_changelog(text)
        assert entries[0]['bullets'] == [
            'First line continued on second line',
            'Second bullet',
        ]

    def test_empty_input(self):
        assert parse_changelog('') == []

    def test_no_date_headings(self):
        assert parse_changelog('# Changelog\n\nSome text only.') == []


class TestEntriesNewerThan:
    def _entries(self):
        return [
            {'date': '2026-04-28', 'bullets': ['c']},
            {'date': '2026-04-21', 'bullets': ['b']},
            {'date': '2026-04-14', 'bullets': ['a']},
        ]

    def test_filters_strictly_newer(self):
        result = entries_newer_than(self._entries(), '2026-04-21')
        assert [e['date'] for e in result] == ['2026-04-28']

    def test_returns_all_when_cutoff_none(self):
        result = entries_newer_than(self._entries(), None)
        assert len(result) == 3

    def test_returns_all_when_cutoff_empty(self):
        result = entries_newer_than(self._entries(), '')
        assert len(result) == 3

    def test_returns_empty_when_cutoff_newer_than_all(self):
        result = entries_newer_than(self._entries(), '2026-12-31')
        assert result == []

    def test_returns_all_when_cutoff_older_than_all(self):
        result = entries_newer_than(self._entries(), '2025-01-01')
        assert len(result) == 3
