"""Isolated SE specialty defaults, visibility and non-destructive migration tests."""

from types import SimpleNamespace
from unittest.mock import patch

import pytest
from bs4 import BeautifulSoup
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from app.migrations import _migrate_se_specialty
from app.models import UserPreference, db
from app.services.se_specialty import SE_SPECIALTIES, is_data_se


@pytest.fixture
def specialty_preference(app):
    """Preserve the isolated user's role and specialty after settings tests."""
    with app.app_context():
        pref = UserPreference.query.first()
        original = (pref.user_role, pref.se_specialty)
        pref.user_role = 'se'
        db.session.commit()
        yield pref
        pref.user_role, pref.se_specialty = original
        db.session.commit()


@pytest.mark.parametrize('specialty', SE_SPECIALTIES)
def test_settings_save_and_render_each_specialty(client, specialty_preference, specialty):
    """All four requested choices persist without altering identity or appearance."""
    pref = specialty_preference
    original = (pref.user_role, pref.dark_mode, pref.theme_family, pref.my_seller_id)
    response = client.post('/api/preferences/se-specialty', json={'se_specialty': specialty})
    assert response.status_code == 200
    assert response.json == {'se_specialty': specialty}
    db.session.refresh(pref)
    assert pref.se_specialty == specialty
    assert (pref.user_role, pref.dark_mode, pref.theme_family, pref.my_seller_id) == original
    assert client.get('/api/preferences/se-specialty').json == {'se_specialty': specialty}
    soup = BeautifulSoup(client.get('/preferences').data, 'html.parser')
    picker = soup.select_one('#settingsSeSpecialty')
    assert picker.select_one('option[selected]')['value'] == specialty
    assert [option.text for option in picker.select('option')] == [
        'Data SE', 'Core / Infra SE', 'Apps and AI SE', 'Other',
    ]
    assert soup.select_one('label[for="settingsSeSpecialty"]')
    assert soup.select_one('#settingsSeSpecialtyResult')['aria-live'] == 'polite'


@pytest.mark.parametrize('role', ['se', None, 'dss'])
def test_specialty_control_and_api_are_se_only(client, specialty_preference, role):
    """DSS hides/rejects specialty edits but keeps the stored value for a later role change."""
    pref = specialty_preference
    pref.user_role = role
    pref.se_specialty = 'infra'
    db.session.commit()
    soup = BeautifulSoup(client.get('/preferences').data, 'html.parser')
    assert bool(soup.select_one('#settingsSeSpecialty')) is (role != 'dss')
    for method in ('get', 'post'):
        options = {'json': {'se_specialty': 'other'}} if method == 'post' else {}
        response = getattr(client, method)('/api/preferences/se-specialty', **options)
        assert response.status_code == (403 if role == 'dss' else 200)
    db.session.refresh(pref)
    assert pref.user_role == role
    if role == 'dss':
        assert pref.se_specialty == 'infra'
        pref.user_role = 'se'
        db.session.commit()
        soup = BeautifulSoup(client.get('/preferences').data, 'html.parser')
        assert soup.select_one('#settingsSeSpecialty option[selected]')['value'] == 'infra'


@pytest.mark.parametrize('payload', [
    None, [], 'data', {}, {'se_specialty': None}, {'se_specialty': []},
    {'se_specialty': True}, {'se_specialty': 'invalid'}, {'se_specialty': 'Data SE'},
])
def test_invalid_specialty_is_rejected_without_mutation(client, specialty_preference, payload):
    """Only the explicit persisted keys are accepted, with an actionable validation error."""
    specialty_preference.se_specialty = 'infra'
    db.session.commit()
    response = client.post('/api/preferences/se-specialty', json=payload)
    assert response.status_code == 400
    assert 'four listed SE specialties' in response.json['error']
    db.session.refresh(specialty_preference)
    assert specialty_preference.se_specialty == 'infra'


def test_failed_specialty_save_logs_and_rolls_back(client, specialty_preference, caplog):
    """A failed commit keeps the previous specialty and reports a retryable error."""
    specialty_preference.se_specialty = 'data'
    db.session.commit()
    with patch.object(db.session, 'commit', side_effect=SQLAlchemyError('test save failure')):
        response = client.post('/api/preferences/se-specialty', json={'se_specialty': 'other'})
    assert response.status_code == 500
    assert 'Please try again' in response.json['error']
    assert 'Could not POST SE specialty preference' in caplog.text
    db.session.refresh(specialty_preference)
    assert specialty_preference.se_specialty == 'data'


def test_legacy_specialty_is_not_silently_displayed_as_data(client, specialty_preference):
    """An older unsupported assignment prompts for selection without overwriting its value."""
    specialty_preference.se_specialty = 'security'
    db.session.commit()
    soup = BeautifulSoup(client.get('/preferences').data, 'html.parser')
    selected = soup.select_one('#settingsSeSpecialty option[selected]')
    assert selected['value'] == ''
    assert selected.has_attr('disabled')
    db.session.refresh(specialty_preference)
    assert specialty_preference.se_specialty == 'security'


def test_new_preference_has_data_python_and_database_defaults(app):
    """New preferences default to Data and the schema has a server default too."""
    with app.app_context():
        preference = UserPreference()
        db.session.add(preference)
        db.session.flush()
        assert preference.se_specialty == 'data'
        column = next(
            item for item in inspect(db.engine).get_columns('user_preferences')
            if item['name'] == 'se_specialty'
        )
        assert 'data' in column['default']
        assert column['nullable'] is False
        db.session.delete(preference)
        db.session.commit()


@pytest.mark.parametrize(('specialty', 'visible'), [
    ('data', True), ('Data', True), (' DATA ', True), ('infra', False),
    ('security', False), ('app_innovation', False), ('', True),
])
def test_visibility_does_not_overwrite_explicit_specialty(app, specialty, visible):
    """The read helper respects non-data assignments without writing preferences."""
    with app.app_context():
        preference = UserPreference.query.order_by(UserPreference.id).first()
        original = preference.se_specialty
        try:
            preference.se_specialty = specialty
            db.session.commit()
            assert is_data_se() is visible
            db.session.refresh(preference)
            assert preference.se_specialty == specialty
        finally:
            preference.se_specialty = original
            db.session.commit()


def test_missing_preference_defaults_to_data_without_creating_a_row(app, monkeypatch):
    """A missing singleton is Data by default, not a settings mutation."""
    with app.app_context():
        from unittest.mock import Mock

        query = Mock()
        query.order_by.return_value.first.return_value = None
        monkeypatch.setattr(UserPreference, 'query', query)
        assert is_data_se()
        query.add.assert_not_called()


@pytest.mark.parametrize('existing_column', [False, True])
def test_specialty_migration_backfills_and_is_idempotent(existing_column):
    """Legacy/unset rows become Data; a stored Infra assignment stays unchanged."""
    engine = create_engine('sqlite://')
    with engine.begin() as connection:
        extra = ', se_specialty VARCHAR(40)' if existing_column else ''
        connection.execute(text(f'CREATE TABLE user_preferences (id INTEGER PRIMARY KEY{extra})'))
        if existing_column:
            connection.execute(text(
                "INSERT INTO user_preferences VALUES (1, NULL), (2, ''), (3, 'infra')"
            ))
        else:
            connection.execute(text('INSERT INTO user_preferences VALUES (1), (2)'))
    with Session(engine) as session:
        database = SimpleNamespace(engine=engine, session=session)
        inspector = inspect(engine)
        _migrate_se_specialty(database, inspector)
        _migrate_se_specialty(database, inspector)
        with engine.begin() as connection:
            values = connection.execute(text(
                'SELECT se_specialty FROM user_preferences ORDER BY id'
            )).scalars().all()
            assert values == (['data', 'data', 'infra'] if existing_column else ['data', 'data'])
            if not existing_column:
                connection.execute(text('INSERT INTO user_preferences (id) VALUES (4)'))
                assert connection.execute(text(
                    'SELECT se_specialty FROM user_preferences WHERE id = 4'
                )).scalar_one() == 'data'
    engine.dispose()


@pytest.mark.parametrize('specialty', ['data', 'infra', 'ai', 'apps_ai', 'other'])
def test_specialty_backup_round_trip_preserves_explicit_assignment(app, specialty):
    """Global backup/restore must retain the specialty, not silently revert an SE to Data."""
    from app.services.backup import _global_data_to_dict, restore_global_data

    with app.app_context():
        preference = UserPreference.query.order_by(UserPreference.id).first()
        original = preference.se_specialty
        try:
            preference.se_specialty = specialty
            db.session.commit()
            backup = _global_data_to_dict()
            assert backup['user_preferences']['se_specialty'] == specialty
            preference.se_specialty = 'data' if specialty != 'data' else 'infra'
            db.session.commit()
            result = restore_global_data({'user_preferences': backup['user_preferences']})
            db.session.refresh(preference)
            assert result['user_preference'] == 'restored'
            assert preference.se_specialty == specialty
            assert is_data_se() is (specialty == 'data')
        finally:
            preference.se_specialty = original
            db.session.commit()


@pytest.mark.parametrize('specialty', ['data', 'infra', 'ai'])
@pytest.mark.parametrize('missing', [True, False])
def test_legacy_or_null_backup_does_not_reset_existing_specialty(app, specialty, missing):
    """An old or null specialty field cannot overwrite an explicit current assignment."""
    from app.services.backup import restore_global_data

    with app.app_context():
        preference = UserPreference.query.order_by(UserPreference.id).first()
        original = preference.se_specialty
        try:
            preference.se_specialty = specialty
            db.session.commit()
            fields = {'dark_mode': preference.dark_mode}
            if not missing:
                fields['se_specialty'] = None
            restore_global_data({'user_preferences': fields})
            db.session.refresh(preference)
            assert preference.se_specialty == specialty
        finally:
            preference.se_specialty = original
            db.session.commit()


def test_legacy_backup_creating_preferences_defaults_specialty_to_data(app):
    """Restoring an older backup on a fresh preferences table uses the model's Data default."""
    from app.services.backup import restore_global_data

    with app.app_context():
        saved = [
            {column.name: getattr(preference, column.name)
             for column in UserPreference.__table__.columns}
            for preference in UserPreference.query.all()
        ]
        try:
            UserPreference.query.delete()
            db.session.commit()
            restore_global_data({'user_preferences': {'dark_mode': True}})
            preference = UserPreference.query.one()
            assert preference.se_specialty == 'data'
            assert is_data_se()
        finally:
            UserPreference.query.delete()
            db.session.commit()
            db.session.add_all(UserPreference(**fields) for fields in saved)
            db.session.commit()
