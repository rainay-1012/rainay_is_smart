from datetime import datetime

from database import Category, Item, Position, db
from flask import Blueprint, g, jsonify, request
from flask import current_app as app
from utils import (
    check_token,
    emit_data_change,
    remove_photo,
    require_fields,
    upload_photo,
)

from python.response import DataResponse, ResourceNotFoundException

item_routes = Blueprint("item_routes", __name__)


@item_routes.route("/get_item_data", methods=["GET"])
@check_token(Position.executive)
def get_item_data():
    app.logger.debug(f"{g.user['email']} | request item data")

    categories = Category.query.all()
    items = Item.query.all()

    data = [item.as_dict() for item in items]
    app.logger.debug(f"{g.user['email']} | Returning item data")
    return DataResponse(
        data={
            "data": data,
            "categories": [category.as_dict() for category in categories],
        }
    ).to_response()


@item_routes.route("/upsert_item", methods=["POST"])
@check_token(Position.executive)
@require_fields(["id", "name", "category"], source_type="form")
def upsert_item(data):
    app.logger.debug(f"{g.user['email']} | request upsert item data")

    item_id = data["id"]
    name = data["name"]
    category_id = data["category"]

    if item_id:
        item = Item.query.get(item_id)
        if not item:
            return jsonify({"error": "Item not found"}), 404

        remove_photo(item.photo)
        item.name = name
        item.last_update = datetime.utcnow()
        item.category_id = category_id
    else:
        item = Item(
            name=name,
            category_id=category_id,
        )
    db.session.add(item)

    db.session.commit()

    photo_file = request.files.get("photo")
    if photo_file:
        photo_path = upload_photo(photo_file, item.id)
        item.photo = photo_path
        db.session.commit()

    emit_data_change(g.user["uid"], "modify" if item_id else "add", item)

    app.logger.debug(f"{g.user['email']} | performed upsert item data")

    return jsonify(
        {
            "code": f"crud/{'modify' if item_id else 'add'}",
            "message": f"Item has been {'modified' if item_id else 'added'} successfully!",
        }
    ), (201 if not item_id else 200)


@item_routes.route("/delete_item/<item_id>", methods=["DELETE"])
@check_token(Position.executive)
def delete_item(item_id):
    app.logger.debug(f"{g.user['email']} | request delete item data")

    item = db.session.get(Item, item_id)

    if not item:
        raise ResourceNotFoundException("item", item_id)

    if item.photo:
        remove_photo(item.photo)

    db.session.delete(item)
    db.session.flush()
    emit_data_change(g.user["uid"], "delete", item)
    db.session.commit()

    app.logger.debug(f"{g.user['email']} | performed delete item data")

    return jsonify(
        {"code": "crud/delete", "message": "Item has been deleted successfully."}
    ), 200
