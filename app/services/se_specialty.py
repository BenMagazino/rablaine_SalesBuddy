"""SE specialty choices, defaults and read-only visibility checks."""

from app.models import UserPreference

DEFAULT_SE_SPECIALTY = 'data'
SE_SPECIALTIES = {
    'data': 'Data SE',
    'infra': 'Infra SE',
    'apps_ai': 'Apps and AI SE',
    'other': 'Other',
}


def has_specialty_access(specialty: str) -> bool:
    """Include sellers in every specialty; otherwise use the saved SE specialty."""
    preference = UserPreference.query.order_by(UserPreference.id).first()
    if preference and preference.user_role == 'dss':
        return True
    value = preference.se_specialty if preference else None
    return (
        value.strip().casefold() if value and value.strip() else DEFAULT_SE_SPECIALTY
    ) == specialty


def is_data_se() -> bool:
    """Allow Data-specialty features for Data SEs and sellers."""
    return has_specialty_access('data')
