"""Development-only analytics mart bootstrap helpers."""

from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import text

from app.db.session import get_analytics_engine


def bootstrap_development_analytics_marts() -> None:
    """Create and seed starter analytics marts for local Compose development."""

    engine = get_analytics_engine()

    with engine.begin() as connection:
        connection.execute(text("CREATE SCHEMA IF NOT EXISTS analytics"))
        connection.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS analytics.mart_commerce_daily (
                    order_date DATE NOT NULL,
                    channel_name TEXT NOT NULL,
                    store_name TEXT NOT NULL,
                    workspace_key TEXT NOT NULL,
                    revenue NUMERIC(12, 2) NOT NULL,
                    orders INTEGER NOT NULL,
                    gmv NUMERIC(12, 2) NOT NULL
                )
                """
            )
        )
        connection.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS analytics.mart_channel_performance (
                    report_date DATE NOT NULL,
                    channel_name TEXT NOT NULL,
                    campaign_name TEXT NOT NULL,
                    workspace_key TEXT NOT NULL,
                    ad_spend NUMERIC(12, 2) NOT NULL,
                    clicks INTEGER NOT NULL,
                    roas NUMERIC(8, 2) NOT NULL
                )
                """
            )
        )

        commerce_rows = connection.execute(
            text("SELECT COUNT(*) FROM analytics.mart_commerce_daily")
        ).scalar_one()
        if commerce_rows == 0:
            connection.execute(
                text(
                    """
                    INSERT INTO analytics.mart_commerce_daily (
                        order_date,
                        channel_name,
                        store_name,
                        workspace_key,
                        revenue,
                        orders,
                        gmv
                    ) VALUES (
                        :order_date,
                        :channel_name,
                        :store_name,
                        :workspace_key,
                        :revenue,
                        :orders,
                        :gmv
                    )
                    """
                ),
                _build_mart_commerce_daily_rows(),
            )

        performance_rows = connection.execute(
            text("SELECT COUNT(*) FROM analytics.mart_channel_performance")
        ).scalar_one()
        if performance_rows == 0:
            connection.execute(
                text(
                    """
                    INSERT INTO analytics.mart_channel_performance (
                        report_date,
                        channel_name,
                        campaign_name,
                        workspace_key,
                        ad_spend,
                        clicks,
                        roas
                    ) VALUES (
                        :report_date,
                        :channel_name,
                        :campaign_name,
                        :workspace_key,
                        :ad_spend,
                        :clicks,
                        :roas
                    )
                    """
                ),
                _build_mart_channel_performance_rows(),
            )


def _build_mart_commerce_daily_rows() -> list[dict[str, object]]:
    start_date = date(2026, 5, 19)
    channels = [
        ("Smartstore", "Seoul Flagship", 18200, 124, 20750),
        ("Coupang", "Busan Hub", 16750, 111, 19420),
        ("11Street", "Incheon Outlet", 12100, 87, 13980),
    ]
    rows: list[dict[str, object]] = []

    for day_index in range(7):
        current_date = start_date + timedelta(days=day_index)
        for channel_index, (channel_name, store_name, revenue_base, orders_base, gmv_base) in enumerate(channels):
            rows.append(
                {
                    "order_date": current_date,
                    "channel_name": channel_name,
                    "store_name": store_name,
                    "workspace_key": "primary",
                    "revenue": revenue_base + (day_index * 840) + (channel_index * 190),
                    "orders": orders_base + (day_index * 4) + channel_index,
                    "gmv": gmv_base + (day_index * 910) + (channel_index * 240),
                }
            )

    return rows


def _build_mart_channel_performance_rows() -> list[dict[str, object]]:
    return [
        {
            "report_date": date(2026, 5, 23),
            "channel_name": "Meta Ads",
            "campaign_name": "Retention Push",
            "workspace_key": "primary",
            "ad_spend": 4200,
            "clicks": 12800,
            "roas": 3.4,
        },
        {
            "report_date": date(2026, 5, 23),
            "channel_name": "Google Ads",
            "campaign_name": "Brand Search",
            "workspace_key": "primary",
            "ad_spend": 3850,
            "clicks": 10240,
            "roas": 4.1,
        },
        {
            "report_date": date(2026, 5, 23),
            "channel_name": "Naver Ads",
            "campaign_name": "Commerce Boost",
            "workspace_key": "primary",
            "ad_spend": 2760,
            "clicks": 8640,
            "roas": 3.8,
        },
        {
            "report_date": date(2026, 5, 24),
            "channel_name": "Meta Ads",
            "campaign_name": "Weekend Upsell",
            "workspace_key": "primary",
            "ad_spend": 4480,
            "clicks": 13220,
            "roas": 3.6,
        },
        {
            "report_date": date(2026, 5, 24),
            "channel_name": "Google Ads",
            "campaign_name": "Category Capture",
            "workspace_key": "primary",
            "ad_spend": 3985,
            "clicks": 10920,
            "roas": 4.0,
        },
        {
            "report_date": date(2026, 5, 24),
            "channel_name": "Naver Ads",
            "campaign_name": "Flash Deal",
            "workspace_key": "primary",
            "ad_spend": 2890,
            "clicks": 9010,
            "roas": 3.7,
        },
    ]