"""Tests for changelog parsing and entry filtering in update_checker."""
from app.services.update_checker import (
    parse_changelog, entries_newer_than, entries_in_commits,
)


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
        assert entries[0]['date_iso'] == '2026-04-28'
        assert entries[0]['commit'] is None
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

    def test_parses_us_date_format(self):
        text = """## 4/29/2026
- Some change
"""
        entries = parse_changelog(text)
        assert len(entries) == 1
        assert entries[0]['date'] == '4/29/2026'
        assert entries[0]['date_iso'] == '2026-04-29'
        assert entries[0]['commit'] is None

    def test_parses_date_with_commit_hash(self):
        text = """## 4/29/2026 - a3547a9
- A change tied to a specific commit
"""
        entries = parse_changelog(text)
        assert len(entries) == 1
        assert entries[0]['date'] == '4/29/2026'
        assert entries[0]['date_iso'] == '2026-04-29'
        assert entries[0]['commit'] == 'a3547a9'

    def test_parses_iso_date_with_commit_hash(self):
        text = """## 2026-04-29 - eb0ed08
- Legacy ISO date with hash also works
"""
        entries = parse_changelog(text)
        assert entries[0]['commit'] == 'eb0ed08'
        assert entries[0]['date_iso'] == '2026-04-29'

    def test_multiple_entries_same_date_different_commits(self):
        text = """## 4/29/2026 - aaa1111
- First commit on this date

## 4/29/2026 - bbb2222
- Second commit on the same date
"""
        entries = parse_changelog(text)
        assert len(entries) == 2
        assert entries[0]['commit'] == 'aaa1111'
        assert entries[1]['commit'] == 'bbb2222'
        assert entries[0]['date_iso'] == entries[1]['date_iso'] == '2026-04-29'

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
            {'date': '2026-04-28', 'date_iso': '2026-04-28', 'commit': None, 'bullets': ['c']},
            {'date': '2026-04-21', 'date_iso': '2026-04-21', 'commit': None, 'bullets': ['b']},
            {'date': '2026-04-14', 'date_iso': '2026-04-14', 'commit': None, 'bullets': ['a']},
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

    def test_handles_us_date_via_date_iso(self):
        entries = [
            {'date': '4/29/2026', 'date_iso': '2026-04-29', 'commit': None, 'bullets': ['x']},
        ]
        result = entries_newer_than(entries, '2026-04-28')
        assert len(result) == 1


class TestEntriesInCommits:
    def test_includes_entries_whose_hash_is_in_set(self):
        entries = [
            {'date': '4/29/2026', 'date_iso': '2026-04-29', 'commit': 'aaa1111', 'bullets': ['a']},
            {'date': '4/29/2026', 'date_iso': '2026-04-29', 'commit': 'bbb2222', 'bullets': ['b']},
            {'date': '4/28/2026', 'date_iso': '2026-04-28', 'commit': 'ccc3333', 'bullets': ['c']},
        ]
        result = entries_in_commits(entries, {'aaa1111', 'ccc3333'}, None)
        assert [e['commit'] for e in result] == ['aaa1111', 'ccc3333']

    def test_falls_back_to_date_for_untagged_entries(self):
        entries = [
            {'date': '2026-04-29', 'date_iso': '2026-04-29', 'commit': None, 'bullets': ['a']},
            {'date': '2026-04-21', 'date_iso': '2026-04-21', 'commit': None, 'bullets': ['b']},
        ]
        # Tagged commits set is empty - everything must come from date fallback.
        result = entries_in_commits(entries, set(), '2026-04-25')
        assert [e['date'] for e in result] == ['2026-04-29']

    def test_no_fallback_drops_untagged_when_no_cutoff(self):
        entries = [
            {'date': '2026-04-29', 'date_iso': '2026-04-29', 'commit': None, 'bullets': ['a']},
        ]
        # Without a cutoff date, untagged entries are dropped.
        # This matches the "show me only confirmed-pending stuff" intent.
        result = entries_in_commits(entries, set(), None)
        assert result == []

    def test_mixed_tagged_and_untagged(self):
        entries = [
            {'date': '4/29/2026', 'date_iso': '2026-04-29', 'commit': 'aaa1111', 'bullets': ['a']},
            {'date': '2026-04-28', 'date_iso': '2026-04-28', 'commit': None, 'bullets': ['b']},
            {'date': '4/27/2026', 'date_iso': '2026-04-27', 'commit': 'ccc3333', 'bullets': ['c']},
        ]
        result = entries_in_commits(entries, {'aaa1111'}, '2026-04-27')
        # Tagged hit + untagged date-newer-than-cutoff
        assert [e['date_iso'] for e in result] == ['2026-04-29', '2026-04-28']

    def test_short_hash_match(self):
        # Entry has a 7-char short SHA, commits set has same 7 chars.
        entries = [
            {'date': '4/29/2026', 'date_iso': '2026-04-29', 'commit': 'a3547a9', 'bullets': ['x']},
        ]
        result = entries_in_commits(entries, {'a3547a9'}, None)
        assert len(result) == 1
