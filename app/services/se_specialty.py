"""SE specialty choices, defaults and read-only visibility checks."""

from app.models import UserPreference

DEFAULT_SE_SPECIALTY = 'data'
SE_SPECIALTIES = {
    'data': 'Data SE',
    'infra': 'Infra SE',
    'apps_ai': 'Apps and AI SE',
    'other': 'Other',
}


def is_data_se() -> bool:
    """Check SE mode and specialty, retaining the legacy Data default."""
    preference = UserPreference.query.order_by(UserPreference.id).first()
    if preference and preference.user_role == 'dss':
        return False
    value = preference.se_specialty if preference else None
    return (value.strip().casefold() if value and value.strip() else DEFAULT_SE_SPECIALTY) == 'data'
