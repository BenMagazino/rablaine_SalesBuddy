"""Isolated, repeatable upgrades from the original vertical dashboard layout."""
from types import SimpleNamespace

from sqlalchemy import MetaData, Table, create_engine, inspect, select, text
from sqlalchemy.orm import scoped_session, sessionmaker

from app.migrations import _migrate_dashboard_layout


def test_migration_preserves_widget_ids_order_and_existing_geometry():
    """Legacy widgets get explicit slots once, and subsequent edits are never reset."""
    engine = create_engine('sqlite://')
    session = scoped_session(sessionmaker(bind=engine))
    database = SimpleNamespace(engine=engine, session=session)
    try:
        with engine.begin() as connection:
            connection.execute(text(
                'CREATE TABLE dashboards (id INTEGER PRIMARY KEY, name TEXT)',
            ))
            connection.execute(text(
                'CREATE TABLE dashboard_widgets (id INTEGER PRIMARY KEY, '
                'dashboard_id INTEGER, widget_key TEXT, sort_order INTEGER)',
            ))
            connection.execute(text("INSERT INTO dashboards VALUES (1, 'Keep my dashboard')"))
            connection.execute(text(
                "INSERT INTO dashboard_widgets VALUES "
                "(10, 1, 'connect_goals.u2c', 5), "
                "(11, 1, 'connect_goals.team_coverage', 2), "
                "(12, 2, 'retired.widget', 0)",
            ))
        _migrate_dashboard_layout(database)
        widgets = Table('dashboard_widgets', MetaData(), autoload_with=engine)
        rows = session.execute(select(widgets).order_by(widgets.c.id)).mappings().all()
        assert [(row['id'], row['layout_row']) for row in rows] == [(10, 8), (11, 0), (12, 0)]
        assert all(row['column_span'] == 12 and row['row_span'] == 8 for row in rows)
        assert all(row['variant_key'] == 'detailed' for row in rows)
        session.execute(widgets.update().where(widgets.c.id == 10).values(
            layout_row=30, layout_column=4, column_span=4, variant_key='metric',
        ))
        session.commit()
        _migrate_dashboard_layout(database)
        edited = session.execute(select(widgets).where(widgets.c.id == 10)).mappings().one()
        assert (edited['layout_row'], edited['layout_column'], edited['column_span']) == (30, 4, 4)
        assert edited['variant_key'] == 'metric'
        dashboard = Table('dashboards', MetaData(), autoload_with=engine)
        saved = session.execute(select(dashboard)).mappings().one()
        assert saved['name'] == 'Keep my dashboard'
        assert saved['content_width'] == 'wide' and saved['layout_revision'] == 0
        assert {'layout_column', 'layout_row', 'column_span', 'row_span', 'variant_key'} <= {
            column['name'] for column in inspect(engine).get_columns('dashboard_widgets')
        }
    finally:
        session.remove()
        engine.dispose()
