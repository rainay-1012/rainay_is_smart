from database import Category, Position, Procurement, ProcurementItem, Vendor, db
from flask import Blueprint, g, jsonify
from flask import current_app as app
from sqlalchemy.orm import joinedload
from utils import (
    check_token,
    require_fields,
)

procurement_routes = Blueprint("procurement_routes", __name__)


@procurement_routes.route("/add_procurement", methods=["POST"])
@check_token(Position.executive)
@require_fields(["id", "name", "quantity", "price"])
def add_procurement(data):
    if isinstance(data["id"], list):
        rows = [
            dict(id=id, name=name, quantity=quantity, price=price)
            for id, name, quantity, price in zip(
                data["id"], data["name"], data["quantity"], data["price"]
            )
        ]
    else:
        rows = [data]

    procurement = Procurement()
    db.session.add(procurement)
    db.session.commit()

    for row in rows:
        item = ProcurementItem(
            procurement_id=procurement.id,
            item_id=row["id"],
            quantity=row["quantity"],
            unit_price=row["price"],
        )
        db.session.add(item)

    db.session.commit()

    return jsonify(
        {"message": "Procurement data saved successfully.", "rows": rows}
    ), 201


@procurement_routes.route("/get_procurement_data", methods=["GET"])
@check_token(Position.executive)
def get_procurement_data():
    app.logger.debug(f"{g.user['email']} | request procurement data")

    procurements = Procurement.query.all()

    data = [procurement.as_dict() for procurement in procurements]

    app.logger.debug(f"{g.user['email']} | Returning procurement data")
    return jsonify({"data": data})


@procurement_routes.route("/get_suggestion_vendors/<category_id>", methods=["GET"])
@check_token(Position.executive)
def get_suggestion_vendors(category_id):
    app.logger.debug(
        f"{g.user['email']} | request suggested vendor data of category {category_id}"
    )

    vendors = (
        db.session.query(Vendor)
        .filter(Vendor.gred > 0)
        .join(Vendor.categories)
        .filter(Category.id == category_id)
        .options(joinedload(Vendor.categories))
        .all()
    )

    data = [vendor.as_dict() for vendor in vendors]

    app.logger.debug(f"{g.user['email']} | Returning suggested vendor data")
    return jsonify({"data": data})
