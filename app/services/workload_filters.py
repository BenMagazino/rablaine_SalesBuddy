"""Validation for explicitly requested detailed workload scopes."""


def normalize_workloads(workloads: list[str] | None) -> list[str] | None:
    """Validate an OR selection, retaining unavailable names instead of widening scope."""
    if workloads is None:
        return None
    if (not isinstance(workloads, list) or len(workloads) > 1000
            or any(not isinstance(value, str) or len(value) > 1000 for value in workloads)):
        raise ValueError('Choose a list of detailed workload names.')
    return sorted({value.strip() for value in workloads}) or None
