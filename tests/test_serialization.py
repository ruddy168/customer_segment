from decimal import Decimal

from src.main import serialize_row


def test_serialize_row_converts_decimal_values():
    result = serialize_row({
        "customer_id": 101,
        "monetary": Decimal("250.50"),
    })

    assert result == {
        "customer_id": 101,
        "monetary": 250.5,
    }
    assert isinstance(result["monetary"], float)


def test_serialize_row_preserves_non_decimal_values():
    row = {
        "customer_id": 101,
        "activity_status": "Active",
        "frequency": 4,
    }

    result = serialize_row(row)

    assert result == row
