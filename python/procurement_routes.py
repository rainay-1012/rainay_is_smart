from database import RFQ, Category, Position, Procurement, ProcurementItem, Vendor, db
from flask import Blueprint, g, jsonify
from flask import current_app as app
from sqlalchemy.orm import joinedload
from utils import (
    check_token,
    emit_data_change,
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


@procurement_routes.route("/add_rfq", methods=["POST"])
@check_token(Position.executive)
@require_fields(["id", "items", "vendors"])
def add_rfq(data):
    app.logger.debug(f"{g.user['email']} | add rfq with data {data}")

    procurement_items = ProcurementItem.query.filter(
        ProcurementItem.procurement_id == data["id"],
        ProcurementItem.item_id.in_(data["items"]),
    ).all()

    app.logger.debug(procurement_items)

    rfqs = [
        RFQ(
            procurement_id=data["id"],
            vendor_id=vendor_id,
            procurement_items=procurement_items,
        )
        for vendor_id in data["vendors"]
    ]

    db.session.add_all(rfqs)
    db.session.commit()

    app.logger.debug(f"{g.user['email']} | added rfq")

    for rfq in rfqs:
        emit_data_change("cast", "add", rfq)

    return jsonify(
        {"code": "crud/add", "message": "RFQs has been added successfully."}
    ), 201
