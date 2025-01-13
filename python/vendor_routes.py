import gevent
from database import Category, Position, Vendor, db
from flask import Blueprint, g, jsonify
from flask import current_app as app
from scrap_gred import assess_vendor
from utils import check_token, emit_data_change, require_fields

from python.response import DataResponse, ResourceNotFoundException

vendor_routes = Blueprint("vendor_routes", __name__)


@vendor_routes.route("/get_vendor_data", methods=["GET"])
@check_token(Position.executive)
def get_vendor_data():
    categories = Category.query.all()
    vendors = Vendor.query.all()

    data = [vendor.as_dict() for vendor in vendors]
    return DataResponse(
        data={
            "data": data,
            "categories": [category.as_dict() for category in categories],
        }
    ).to_response()


@vendor_routes.route("/upsert_vendor", methods=["POST"])
@check_token(Position.executive)
@require_fields(["name", "category", "email", "address"])
def upsert_vendor(data):
    vendor_id = data.get("id")
    name = data.get("name")
    categories = data.get("category")
    email = data.get("email")
    address = data.get("address")

    category_objs = [db.session.get(Category, category) for category in categories]

    old_name = None
    old_address = None

    if vendor_id:
        vendor = db.session.get(Vendor, vendor_id)
        if not vendor:
            raise ResourceNotFoundException("vendor", vendor_id)

        old_name = vendor.name
        old_address = vendor.address

        vendor.name = name
        vendor.email = email
        vendor.address = address
        vendor.categories = category_objs
        db.session.commit()

    else:
        vendor = Vendor(
            name=name,
            email=email,
            address=address,
            categories=category_objs,
        )
        db.session.add(vendor)
        db.session.commit()

    if name != old_name or address != old_address:
        gevent.spawn(
            assess_vendor,
            vendor.id,
            vendor.name,
            vendor.address,
            app.app_context(),
        )

    emit_data_change(g.user["uid"], "modify" if vendor_id else "add", vendor)

    return jsonify(
        {
            "code": f"crud/{'modify' if vendor_id else 'add'}",
            "message": f"Vendor has been {'modified' if vendor_id else 'added'} successfully!",
        }
    ), (201 if not vendor_id else 200)


@vendor_routes.route("/delete_vendor/<vendor_id>", methods=["DELETE"])
@check_token(Position.manager)
def delete_vendor(vendor_id):
    vendor = db.session.get(Vendor, vendor_id)

    if not vendor:
        raise ResourceNotFoundException("vendor", vendor_id)

    db.session.delete(vendor)
    db.session.commit()
    emit_data_change(g.user["uid"], "delete", vendor)
    return jsonify(
        {"code": "crud/delete", "message": "Vendor has been deleted successfully."}
    ), 200


@vendor_routes.route("/approve_vendor/<vendor_id>", methods=["POST"])
@check_token(Position.manager)
def approve_vendor(vendor_id):
    vendor = db.session.get(Vendor, vendor_id)

    if not vendor:
        raise ResourceNotFoundException("vendor", vendor_id)

    vendor.approved = True
    db.session.commit()
    emit_data_change(g.user["uid"], "modify", vendor)
    return jsonify(
        {"code": "crud/update", "message": "Vendor has been approved successfully."}
    ), 200
