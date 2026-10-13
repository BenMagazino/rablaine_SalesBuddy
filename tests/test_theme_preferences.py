"""Persisted palette selection, initial rendering, migration and backup regression tests."""

from types import SimpleNamespace
from unittest.mock import patch

import pytest
from bs4 import BeautifulSoup
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.migrations import _migrate_theme_family
from app.models import UserPreference, db


@pytest.fixture
def preference(app):
    """Restore appearance preferences after each isolated test."""
    with app.app_context():
        pref = UserPreference.query.first()
        original = (pref.theme_family, pref.dark_mode)
        yield pref
        pref.theme_family, pref.dark_mode = original
        db.session.commit()


@pytest.mark.parametrize('family', ['graphite', 'midnight', 'harbor', 'carbon'])
@pytest.mark.parametrize('dark', [False, True])
def test_theme_persists_and_renders_before_first_paint(client, preference, family, dark):
    """Every palette is stored, pre-rendered across pages and independent of mode."""
    preference.dark_mode = dark
    db.session.commit()
    response = client.post('/api/preferences/theme-family', json={'theme_family': family})
    assert response.status_code == 200
    assert response.json == {'theme_family': family}
    db.session.refresh(preference)
    assert preference.theme_family == family
    assert preference.dark_mode is dark
    assert client.get('/api/preferences/theme-family').json == {'theme_family': family}
    for route in ('/preferences', '/notes', '/', '/does-not-exist'):
        document = BeautifulSoup(client.get(route).data, 'html.parser')
        assert document.html['data-sb-family'] == family
        mode_attribute = 'data-sb-mode' if route == '/does-not-exist' else 'data-bs-theme'
        assert document.html[mode_attribute] == ('dark' if dark else 'light')
        if route == '/preferences':
            picker = document.select_one('#settingsThemeFamily')
            assert picker.select_one('option[selected]')['value'] == family
            assert [option['value'] for option in picker.select('option')] == [
                'graphite', 'midnight', 'harbor', 'carbon',
            ]
            assert document.select_one('label[for="settingsThemeFamily"]')
            assert document.select_one('#settingsThemeResult')['aria-live'] == 'polite'
    client.post('/api/preferences/dark-mode', json={'dark_mode': not dark})
    db.session.refresh(preference)
    assert preference.theme_family == family


@pytest.mark.parametrize('payload', [
    None, [], 'harbor', {}, {'theme_family': None}, {'theme_family': []},
    {'theme_family': True}, {'theme_family': 'unknown'}, {'theme_family': 'Harbor'},
])
def test_invalid_theme_is_explicit_and_does_not_change_saved_preferences(
    client, preference, payload,
):
    """Malformed and unsupported palette selections return a user-facing validation error."""
    preference.theme_family = 'carbon'
    db.session.commit()
    response = client.post('/api/preferences/theme-family', json=payload)
    assert response.status_code == 400
    assert 'Choose Graphite' in response.json['error']
    db.session.refresh(preference)
    assert preference.theme_family == 'carbon'


def test_failed_theme_save_reports_error_and_rolls_back(client, preference, caplog):
    """Database failures never return success or leave a partially saved palette."""
    preference.theme_family = 'midnight'
    db.session.commit()
    with patch.object(db.session, 'commit', side_effect=SQLAlchemyError('test failure')):
        response = client.post('/api/preferences/theme-family', json={'theme_family': 'harbor'})
    assert response.status_code == 500
    assert 'Please try again' in response.json['error']
    assert 'Could not POST theme preference' in caplog.text
    db.session.refresh(preference)
    assert preference.theme_family == 'midnight'


@pytest.mark.parametrize('existing', [False, True])
def test_theme_migration_is_idempotent_and_preserves_appearance(existing):
    """Old installations default to Graphite; repeated migrations keep explicit choices."""
    engine = create_engine('sqlite://')
    with engine.begin() as connection:
        extra = ", theme_family VARCHAR(20) NOT NULL DEFAULT 'graphite'" if existing else ''
        connection.execute(text(
            f'CREATE TABLE user_preferences (id INTEGER PRIMARY KEY, dark_mode BOOLEAN{extra})'
        ))
        if existing:
            connection.execute(text(
                "INSERT INTO user_preferences VALUES (1, 1, 'harbor'), (2, 0, 'carbon')"
            ))
        else:
            connection.execute(text('INSERT INTO user_preferences VALUES (1, 1), (2, 0)'))
    with Session(engine) as session:
        database = SimpleNamespace(engine=engine, session=session)
        inspector = inspect(engine)
        _migrate_theme_family(database, inspector)
        _migrate_theme_family(database, inspector)
        with engine.begin() as connection:
            rows = connection.execute(text(
                'SELECT theme_family, dark_mode FROM user_preferences ORDER BY id'
            )).all()
            assert rows == (
                [('harbor', 1), ('carbon', 0)] if existing else [('graphite', 1), ('graphite', 0)]
            )
            connection.execute(text('INSERT INTO user_preferences (id) VALUES (3)'))
            assert connection.execute(text(
                'SELECT theme_family FROM user_preferences WHERE id = 3'
            )).scalar_one() == 'graphite'
    engine.dispose()


def test_theme_backup_round_trip_and_legacy_preservation(preference):
    """Backups retain the palette, while older backups leave the existing choice alone."""
    from app.services.backup import _global_data_to_dict, restore_global_data

    preference.theme_family = 'harbor'
    db.session.commit()
    backup = _global_data_to_dict()
    assert backup['user_preferences']['theme_family'] == 'harbor'
    preference.theme_family = 'carbon'
    db.session.commit()
    restore_global_data({'user_preferences': backup['user_preferences']})
    db.session.refresh(preference)
    assert preference.theme_family == 'harbor'
    restore_global_data({'user_preferences': {'dark_mode': True}})
    db.session.refresh(preference)
    assert preference.theme_family == 'harbor'
