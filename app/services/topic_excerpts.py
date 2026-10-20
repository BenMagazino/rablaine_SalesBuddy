"""Bounded opening and literal-topic passages for the topic note reader."""

from dataclasses import dataclass
from itertools import groupby
import re

from bs4 import BeautifulSoup, Comment
from markupsafe import Markup, escape

PREVIEW_LIMIT = 250
CONTEXT_LIMIT = 350
BLOCK_TAGS = ['p', 'div', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
              'tr', 'td', 'th', 'blockquote', 'br']


@dataclass(frozen=True)
class TopicExcerpt:
    """Safely highlighted opening text and topic context for one note."""

    preview: Markup
    context: Markup
    status: str
    flat_preview: str


def _window(text: str, limit: int, match: re.Match | None = None) -> str:
    """Keep a matching phrase visible within a bounded passage."""
    if len(text) <= limit:
        return text
    capacity = limit - 6
    start = max(0, match.start() - capacity // 3) if match else 0
    if match:
        start = max(start, match.end() - capacity)
    end = min(len(text), start + capacity)
    return ('...' if start else '') + text[start:end].strip() + (
        '...' if end < len(text) else '')


def _highlight(text: str, pattern: re.Pattern) -> Markup:
    """Escape authored text and mark every literal topic match."""
    parts: list[Markup] = []
    previous = 0
    for found in pattern.finditer(text):
        parts.extend([escape(text[previous:found.start()]),
                      Markup('<mark>'), escape(found.group()), Markup('</mark>')])
        previous = found.end()
    parts.append(escape(text[previous:]))
    return Markup('').join(parts)


def _topic_pattern(topic_name: str) -> re.Pattern:
    """Match a literal topic phrase with case-insensitive word boundaries."""
    phrase = r'\s+'.join(re.escape(word) for word in topic_name.split())
    if not phrase:
        raise ValueError('Topic highlighting requires a nonempty topic name.')
    return re.compile(r'(?<!\w)' + phrase + r'(?!\w)', re.IGNORECASE)


def highlight_note_content(content: str, topic_name: str) -> Markup:
    """Mark text matches without altering rich-text elements or their attributes."""
    soup = BeautifulSoup(content, 'html.parser')
    pattern = _topic_pattern(topic_name)
    nodes = [
        node for node in soup.find_all(string=True)
        if not isinstance(node, Comment)
        and not node.find_parent(['script', 'style', 'template', 'textarea', 'mark'])
    ]
    for _, group in groupby(nodes, key=lambda node: id(node.find_parent(BLOCK_TAGS))):
        texts = list(group)
        matches = list(pattern.finditer(''.join(str(node) for node in texts)))
        offset = 0
        for node in texts:
            text = str(node)
            end = offset + len(text)
            previous = 0
            replacements = []
            for match in matches:
                start, stop = max(offset, match.start()), min(end, match.end())
                if start >= stop:
                    continue
                replacements.append(text[previous:start - offset])
                mark = soup.new_tag('mark', attrs={'class': 'topic-note-match'})
                mark.string = text[start - offset:stop - offset]
                replacements.append(mark)
                previous = stop - offset
            if replacements:
                replacements.append(text[previous:])
                node.replace_with(*replacements)
            offset = end
    return Markup(str(soup))


def build_topic_excerpt(content: str, topic_name: str) -> TopicExcerpt:
    """Parse authored HTML once, preserving block boundaries and escaping all output."""
    soup = BeautifulSoup(content, 'html.parser')
    for element in soup(['script', 'style', 'template']):
        element.decompose()
    flat_preview = _window(' '.join(soup.get_text().split()), 200)
    for element in soup.find_all(['br', 'p', 'div', 'li', 'h1', 'h2', 'h3', 'h4',
                                  'h5', 'h6', 'tr', 'blockquote']):
        if element.name == 'br':
            element.replace_with('\n')
        else:
            element.append('\n')
    blocks = [' '.join(block.split()) for block in soup.get_text().splitlines()]
    blocks = [block for block in blocks if block]
    opening = ' '.join(blocks)
    preview = _window(opening, PREVIEW_LIMIT)
    pattern = _topic_pattern(topic_name)
    offset = 0
    preview_length = len(preview.removesuffix('...'))
    preview = _highlight(preview, pattern)
    for block in blocks:
        match = pattern.search(block)
        if not match:
            offset += len(block) + 1
            continue
        if offset + match.end() <= preview_length:
            return TopicExcerpt(preview, Markup(''), 'Topic mentioned in opening preview.',
                                flat_preview)
        passage = _window(block, CONTEXT_LIMIT, match)
        return TopicExcerpt(preview, _highlight(passage, pattern), '', flat_preview)
    return TopicExcerpt(preview, Markup(''), 'Topic tagged; no matching text found.', flat_preview)
