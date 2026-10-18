"""Saved dashboards and the reusable, code-owned widget catalog.

Definitions own calculations and presentation. DashboardWidget rows own only
placement, so the same definition can be reused without copying report logic.
"""
from collections.abc import Callable
from dataclasses import dataclass
from datetime import date
import logging
from typing import Any

from app.models import Dashboard, DashboardWidget, db, utc_now
from app.services import connect_goals

logger = logging.getLogger(__name__)
MAX_DASHBOARD_NAME = 200
CANVAS_WIDTHS = {'standard': 1152, 'wide': 1344}
GRID_COLUMNS = 12
GRID_ROW_HEIGHT = 64
GRID_GAP = 12
GRID_PADDING = 16
MAX_LAYOUT_ROWS = 1000
MAX_WIDGET_HEIGHT = 20


class LayoutConflict(ValueError):
    """A stale dashboard draft must not overwrite a newer saved layout."""


@dataclass(frozen=True)
class WidgetVariant:
    """A deliberately designed presentation with supported grid footprints."""

    key: str
    title: str
    template: str
    widths: tuple[int, ...]
    min_height: int
    default_height: int


def _connect_variants(template: str) -> tuple[WidgetVariant, ...]:
    """Share metric and detailed options without duplicating report calculations."""
    return (
        WidgetVariant(
            'metric', 'Metric', 'partials/widgets/connect_metric.html',
            (3, 4, 6, 12), 3, 4,
        ),
        WidgetVariant('detailed', 'Detailed', template, (6, 12), 5, 8),
    )


@dataclass(frozen=True)
class WidgetDefinition:
    """A stable widget identity with a shared report-backed data provider."""

    key: str
    title: str
    description: str
    report: str
    variants: tuple[WidgetVariant, ...]
    provider: Callable[[date | None], dict[str, Any]]


WIDGET_DEFINITIONS = {
    definition.key: definition for definition in (
        WidgetDefinition(
            'connect_goals.u2c', 'Quarterly U2C progression',
            'Quarter-to-date commitment progress, expected pace, and the U2C trend.',
            'U2C Attainment', _connect_variants('partials/widgets/connect_u2c.html'),
            connect_goals.get_u2c_widget,
        ),
        WidgetDefinition(
            'connect_goals.team_coverage', 'Milestone team coverage',
            'ACR-weighted team coverage with a scoped report of off-team milestones.',
            'Milestone Tracker', _connect_variants('partials/widgets/connect_team_coverage.html'),
            connect_goals.get_team_coverage_widget,
        ),
        WidgetDefinition(
            'connect_goals.hva_coverage', 'Milestone HVA coverage',
            'On-team milestone activity coverage and technical validation counts.',
            'Activity Coverage', _connect_variants('partials/widgets/connect_hva_coverage.html'),
            connect_goals.get_hva_coverage_widget,
        ),
        WidgetDefinition(
            'connect_goals.whitespace', 'Fabric and database whitespace wins',
            'Sustained wins, ramping customers, and their monthly consumption history.',
            'Whitespace Analysis', _connect_variants('partials/widgets/connect_whitespace.html'),
            connect_goals.get_whitespace_widget,
        ),
    )
}


def get_widget_catalog() -> list[dict[str, Any]]:
    """Describe selectable widgets without calculating their values."""
    return [
        {
            'key': definition.key,
            'title': definition.title,
            'description': definition.description,
            'scope': 'FY27 Data',
            'report': definition.report,
            'variants': [
                {
                    'key': variant.key, 'title': variant.title,
                    'widths': variant.widths, 'min_height': variant.min_height,
                    'default_height': variant.default_height,
                }
                for variant in definition.variants
            ],
        }
        for definition in WIDGET_DEFINITIONS.values()
    ]


def validate_dashboard_name(value: object) -> str:
    """Require a readable name without silently truncating user input."""
    if not isinstance(value, str) or not 1 <= len(value.strip()) <= MAX_DASHBOARD_NAME:
        raise ValueError('Enter a dashboard name of 1 to 200 characters.')
    return value.strip()


def get_dashboard_links() -> list[dict[str, Any]]:
    """List report destinations without loading widget instances or calculating metrics."""
    return [
        {'id': dashboard.id, 'name': dashboard.name,
         'url': f'/reports/dashboards/{dashboard.id}'}
        for dashboard in db.session.execute(
            db.select(Dashboard.id, Dashboard.name).order_by(Dashboard.name, Dashboard.id),
        )
    ]


def list_dashboards() -> list[dict[str, Any]]:
    """Return saved dashboard summaries without running their widget queries."""
    return [
        {
            'id': dashboard.id,
            'name': dashboard.name,
            'widget_count': len(dashboard.widgets),
            'content_width': dashboard.content_width,
            'created_at': dashboard.created_at,
            'updated_at': dashboard.updated_at,
            'url': f'/reports/dashboards/{dashboard.id}',
        }
        for dashboard in Dashboard.query.order_by(Dashboard.name, Dashboard.id).all()
    ]


def get_dashboard_data(
    dashboard: Dashboard, reference: date | None = None,
) -> dict[str, Any]:
    """Calculate saved instances using the same providers and gate as Connect Goals."""
    setup = connect_goals.get_setup_state(reference) if dashboard.widgets else None
    values: dict[str, dict[str, Any]] = {}
    widgets = []
    for instance in sorted(dashboard.widgets, key=lambda item: (
        item.layout_row, item.layout_column, item.id,
    )):
        definition = WIDGET_DEFINITIONS.get(instance.widget_key)
        variant = next((
            item for item in definition.variants if item.key == instance.variant_key
        ), None) if definition else None
        if definition is None:
            logger.warning('Unknown dashboard widget %s: %s', instance.id, instance.widget_key)
        elif variant and setup['ready'] and definition.key not in values:
            values[definition.key] = definition.provider(reference)
        widgets.append({
            'id': instance.id,
            'key': instance.widget_key,
            'sort_order': instance.sort_order,
            'title': definition.title if definition else 'Unavailable widget',
            'variant_key': instance.variant_key,
            'layout_column': instance.layout_column,
            'layout_row': instance.layout_row,
            'column_span': instance.column_span,
            'row_span': instance.row_span,
            'template': variant.template if variant else None,
            'data': values.get(instance.widget_key) if variant else None,
            'message': (
                'This widget is no longer in the catalog. Remove it in Manage Dashboards.'
                if definition is None else
                'This presentation is no longer available. Update it in Manage Dashboards.'
                if variant is None else
                'Confirm your FY27 Data priorities in Connect Goals to see this widget.'
                if not setup['ready'] else None
            ),
        })
    return {
        'id': dashboard.id,
        'name': dashboard.name,
        'created_at': dashboard.created_at,
        'updated_at': dashboard.updated_at,
        'content_width': dashboard.content_width,
        'canvas_width': CANVAS_WIDTHS[dashboard.content_width],
        'layout_revision': dashboard.layout_revision,
        'canvas_rows': max(
            (item.layout_row + item.row_span for item in dashboard.widgets), default=4,
        ),
        'widgets': widgets,
        'setup': setup,
        'url': f'/reports/dashboards/{dashboard.id}',
    }


def get_variant(key: object, variant_key: object) -> WidgetVariant:
    """Resolve only code-owned definitions and supported presentation keys."""
    if not isinstance(key, str) or key not in WIDGET_DEFINITIONS:
        raise ValueError('Choose a widget from the catalog.')
    variant = next((
        item for item in WIDGET_DEFINITIONS[key].variants if item.key == variant_key
    ), None)
    if variant is None:
        raise ValueError('Choose a supported widget variation.')
    return variant


def validate_footprint(variant: WidgetVariant, width: object, height: object) -> None:
    """Reject invalid sizes rather than silently squeezing or expanding widgets."""
    if type(width) is not int or width not in variant.widths:
        raise ValueError('Choose a supported width for this widget variation.')
    if type(height) is not int or not variant.min_height <= height <= MAX_WIDGET_HEIGHT:
        raise ValueError(
            f'Widget height must be {variant.min_height} to {MAX_WIDGET_HEIGHT} grid rows.',
        )


def advance_layout_revision(dashboard: Dashboard, expected: int) -> None:
    """Acquire the layout revision inside the same transaction as its changes."""
    result = db.session.execute(db.update(Dashboard).where(
        Dashboard.id == dashboard.id, Dashboard.layout_revision == expected,
    ).values(layout_revision=expected + 1, updated_at=utc_now()))
    if result.rowcount != 1:
        raise LayoutConflict('This dashboard changed in another window. Reload before editing.')


def add_dashboard_widget(
    dashboard: Dashboard, key: object, variant_key: object = 'detailed',
    column_span: object = None, row_span: object = None,
) -> DashboardWidget:
    """Append below existing widgets without packing holes or moving neighbors."""
    variant = get_variant(key, variant_key)
    width = 12 if column_span is None else column_span
    height = variant.default_height if row_span is None else row_span
    validate_footprint(variant, width, height)
    db.session.flush()
    row = max((item.layout_row + item.row_span for item in dashboard.widgets), default=0)
    if row + height > MAX_LAYOUT_ROWS:
        raise ValueError('No space below the current widgets. Remove or reposition a widget.')
    advance_layout_revision(dashboard, dashboard.layout_revision)
    instance = DashboardWidget(
        widget_key=key, variant_key=variant.key, column_span=width, row_span=height,
        layout_row=row, layout_column=0,
        sort_order=max((widget.sort_order for widget in dashboard.widgets), default=-1) + 1,
    )
    dashboard.widgets.append(instance)
    dashboard.updated_at = utc_now()
    return instance


def rectangles_overlap(first: dict[str, Any], second: dict[str, Any]) -> bool:
    """Detect occupied-cell intersections, allowing adjacent edges."""
    return (
        first['layout_column'] < second['layout_column'] + second['column_span']
        and second['layout_column'] < first['layout_column'] + first['column_span']
        and first['layout_row'] < second['layout_row'] + second['row_span']
        and second['layout_row'] < first['layout_row'] + first['row_span']
    )


def save_dashboard_layout(dashboard: Dashboard, payload: object) -> None:
    """Validate a complete fixed layout before changing any saved geometry."""
    if not isinstance(payload, dict) or not isinstance(payload.get('widgets'), list):
        raise ValueError('Provide a complete dashboard layout.')
    revision = payload.get('revision')
    if type(revision) is not int or revision != dashboard.layout_revision:
        raise LayoutConflict('This dashboard changed in another window. Reload before editing.')
    width = payload.get('content_width')
    if not isinstance(width, str) or width not in CANVAS_WIDTHS:
        raise ValueError('Choose Standard or Wide dashboard width.')
    saved = {item.id: item for item in dashboard.widgets}
    entries = payload['widgets']
    ids = [item.get('id') for item in entries if isinstance(item, dict)]
    if (len(ids) != len(entries) or any(type(item) is not int for item in ids)
            or len(ids) != len(set(ids)) or set(ids) != set(saved)):
        raise ValueError('The layout must contain each widget on this dashboard exactly once.')
    for index, entry in enumerate(entries):
        instance = saved[entry['id']]
        if instance.widget_key in WIDGET_DEFINITIONS:
            variant = get_variant(instance.widget_key, entry.get('variant_key'))
        else:
            if entry.get('variant_key') != instance.variant_key:
                raise ValueError('An unavailable widget cannot change its variation.')
            variant = WidgetVariant(instance.variant_key, 'Unavailable', '', (3, 4, 6, 12), 3, 8)
        validate_footprint(variant, entry.get('column_span'), entry.get('row_span'))
        column, row = entry.get('layout_column'), entry.get('layout_row')
        if (type(column) is not int or type(row) is not int or column < 0 or row < 0
                or column + entry['column_span'] > GRID_COLUMNS
                or row + entry['row_span'] > MAX_LAYOUT_ROWS):
            raise ValueError('Place every widget inside the dashboard grid.')
        if any(rectangles_overlap(entry, other) for other in entries[:index]):
            raise ValueError('Widgets cannot overlap. Move or resize the highlighted widget.')
    advance_layout_revision(dashboard, revision)
    dashboard.content_width = width
    for entry in entries:
        instance = saved[entry['id']]
        for field in ('layout_column', 'layout_row', 'column_span', 'row_span', 'variant_key'):
            setattr(instance, field, entry[field])


def get_widget_preview(key: str, variant_key: str, width: int) -> dict[str, Any]:
    """Use live saved data and the same template as a placed widget, never sample numbers."""
    variant = get_variant(key, variant_key)
    validate_footprint(variant, width, variant.default_height)
    setup = connect_goals.get_setup_state()
    definition = WIDGET_DEFINITIONS[key]
    return {
        'id': 'preview', 'key': key, 'title': definition.title,
        'template': variant.template, 'variant_key': variant.key,
        'column_span': width, 'row_span': variant.default_height,
        'data': definition.provider(None) if setup['ready'] else None,
        'message': (
            'Confirm your FY27 Data priorities in Connect Goals to preview live values.'
            if not setup['ready'] else None
        ),
    }
