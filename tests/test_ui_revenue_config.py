"""Native revenue configuration retains exact fields and existing save semantics."""

from dataclasses import asdict

import pytest
from bs4 import BeautifulSoup
from flask import Flask
from flask.testing import FlaskClient


FIELDS = (
    "min_revenue_for_outreach", "min_dollar_impact", "dollar_at_risk_override",
    "dollar_opportunity_override", "high_value_threshold", "strategic_threshold",
    "volatile_min_revenue", "recent_drop_threshold", "expansion_growth_threshold",
)
CUSTOM_VALUES = {
    "min_revenue_for_outreach": 0, "min_dollar_impact": 1100,
    "dollar_at_risk_override": 2200, "dollar_opportunity_override": 1600,
    "high_value_threshold": 26000, "strategic_threshold": 51000,
    "volatile_min_revenue": 5500, "recent_drop_threshold": -0.23,
    "expansion_growth_threshold": 0.12,
}


@pytest.mark.parametrize("saved", [False, True])
@pytest.mark.parametrize("embedded", [False, True])
def test_native_config_preserves_fields_and_constraints(
    app: Flask, client: FlaskClient, saved: bool, embedded: bool,
) -> None:
    """Labels, accessible descriptions, zero values and raw ratio constraints survive."""
    from app.models import RevenueConfig, db
    from app.services.revenue_analysis import AnalysisConfig

    with app.app_context():
        if saved:
            db.session.add(RevenueConfig(**CUSTOM_VALUES))
            db.session.commit()
    response = client.get("/revenue/config", query_string={"embed": "1"} if embedded else {})
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    root = soup.select_one(".sb-revenue-config")
    assert ("sb-directory-frame" in root.get("class", [])) is not embedded
    styles = [link["href"] for link in soup.select('link[rel="stylesheet"]')]
    detail_style = next(href for href in styles if href.endswith("/ui-revenue-detail.css"))
    frame_style = next(href for href in styles if href.endswith("/ui-page-frame.css"))
    assert styles.count(detail_style) == 1
    assert styles.index(detail_style) < styles.index(frame_style)
    assert not root.select(".card, .btn, .form-control, .input-group, .container")
    assert ("sb-page-frame" in soup.body.get("class", [])) is not embedded
    assert bool(soup.select(".sb-page-status")) is not embedded
    if not embedded:
        assert ("saved configuration" if saved else "built-in defaults") in (
            soup.select_one(".sb-page-status").text
        )
    assert root["data-embedded"] == str(embedded).lower()
    inputs = root.select("input")
    assert tuple(field["name"] for field in inputs) == FIELDS
    expected = CUSTOM_VALUES if saved else asdict(AnalysisConfig())
    for field in inputs:
        name = field["name"]
        assert float(field["value"]) == expected[name]
        assert field["type"] == "number"
        assert field["id"] == name
        assert root.select_one(f'label[for="{name}"]')
        assert all(root.select_one("#" + target) for target in field["aria-describedby"].split())
        assert not any(field.has_attr(attr) for attr in ("min", "max", "required"))
        assert field.get("step") == ("0.01" if name in (
            "recent_drop_threshold", "expansion_growth_threshold",
        ) else None)
    assert root.select_one("#recent_drop_thresholdUnit").text == "ratio"
    assert root.select_one("#expansion_growth_thresholdUnit").text == "ratio/mo"
    assert "-0.15 means a 15% drop" in root.text
    assert "0.08 means 8% growth" in root.text
    assert len(root.select(".sb-revenue-config-group")) == 4
    form = root.select_one("form")
    assert form["action"] == "/revenue/config" and form["method"] == "post"
    save = root.select_one('button[type="submit"]')
    assert save["form"] == form["id"]
    assert not form.select('button[type="submit"]')
    assert root.select_one(".sb-revenue-command-group a")["href"] == "/reports/revenue"
    assert "Saving does not re-run analysis" in root.text
    with app.app_context():
        assert RevenueConfig.query.count() == int(saved)


@pytest.mark.parametrize("existing", [False, True])
def test_native_form_payload_saves_without_running_analysis(
    app: Flask, client: FlaskClient, monkeypatch: pytest.MonkeyPatch, existing: bool,
) -> None:
    """Existing POST creates or updates exactly one configuration and retains raw ratios."""
    from app.models import RevenueConfig, db
    from app.services.revenue_analysis import AnalysisConfig

    def reject_analysis() -> None:
        """A settings save must not trigger costly analysis as an implicit side effect."""
        pytest.fail("Configuration save unexpectedly ran revenue analysis.")

    monkeypatch.setattr("app.routes.revenue.run_analysis_for_all", reject_analysis)
    with app.app_context():
        if existing:
            db.session.add(RevenueConfig())
            db.session.commit()
    response = client.post("/revenue/config", data={
        name: str(value) for name, value in CUSTOM_VALUES.items()
    })
    assert response.status_code == 302
    assert response.headers["Location"] == "/reports/revenue"
    with app.app_context():
        assert RevenueConfig.query.count() == 1
        config = RevenueConfig.query.first()
        assert config is not None
        loaded = asdict(AnalysisConfig.from_db())
        for name in FIELDS:
            assert getattr(config, name) == CUSTOM_VALUES[name]
            assert loaded[name] == CUSTOM_VALUES[name]
    with client.session_transaction() as session:
        assert ("success", "Configuration saved") in session["_flashes"]


def test_config_cancel_keeps_saved_values(app: Flask, client: FlaskClient) -> None:
    """Cancel remains a read-only Analyzer destination, not a hidden form submission."""
    from app.models import RevenueConfig, db

    with app.app_context():
        db.session.add(RevenueConfig(**CUSTOM_VALUES))
        db.session.commit()
    response = client.get("/revenue/config")
    soup = BeautifulSoup(response.data, "html.parser")
    cancel = soup.select_one(".sb-revenue-command-group a")
    assert client.get(cancel["href"]).status_code == 200
    with app.app_context():
        config = RevenueConfig.query.first()
        assert config is not None
        assert all(getattr(config, name) == value for name, value in CUSTOM_VALUES.items())


def test_configuration_help_explains_ratios_and_analysis_timing(client: FlaskClient) -> None:
    """Contextual help describes actual controls rather than unrelated seller mappings."""
    response = client.get("/static/js/page-help.js")
    source = response.get_data(as_text=True)
    section = source.split("title: 'Revenue Configuration'", 1)[1].split("`},", 1)[0]
    assert "decimal ratios" in section
    assert "Saving does not re-run analysis" in section
    assert "Cancel returns to Revenue Analyzer" in section
    assert "seller mappings" not in section
