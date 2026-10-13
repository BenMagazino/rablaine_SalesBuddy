"""SE specialty defaults and read-only visibility checks without settings UI."""

from app.models import UserPreference

DEFAULT_SE_SPECIALTY = 'data'


def is_data_se() -> bool:
    """Use the stored specialty, defaulting only missing/unset preferences to Data."""
    preference = UserPreference.query.order_by(UserPreference.id).first()
    value = preference.se_specialty if preference else None
    return (value.strip().casefold() if value and value.strip() else DEFAULT_SE_SPECIALTY) == 'data'
