import enum
import os
from datetime import datetime

from flask_sqlalchemy import SQLAlchemy
from snowflake import SnowflakeGenerator
from sqlalchemy import Column, Enum, Integer, String, Table, text
from sqlalchemy.orm import DeclarativeBase, Mapped, class_mapper, mapped_column
from sqlalchemy.orm._orm_constructors import relationship
from sqlalchemy.sql import func
from sqlalchemy.sql.schema import ForeignKey


class Base(DeclarativeBase):
    pass


db = SQLAlchemy(model_class=Base)

gen = SnowflakeGenerator(42)


class BaseModel(Base):
    __abstract__ = True

    def __init__(self, **kwargs):
        for key, value in kwargs.items():
            setattr(self, key, value)

    def as_dict(self):
        """Returns the model's fields as a dictionary."""
        return {
            column.key: getattr(self, column.key)
            for column in class_mapper(self.__class__).columns
        }


class Position(enum.Enum):
    executive = 0
    manager = 1
    admin = 2


vendor_category_association = Table(
    "vendor_category",
    db.metadata,
    Column(
        "vendor_id",
        String(128),
        ForeignKey("vendor.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "category_id",
        Integer,
        ForeignKey("category.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class Category(BaseModel, db.Model):
    __tablename__ = "category"

    id: Mapped[int] = mapped_column(db.Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(db.String(150), nullable=False, unique=True)
    items: Mapped[list["Item"]] = relationship("Item", back_populates="category")
    vendors = relationship(
        "Vendor", secondary=vendor_category_association, back_populates="categories"
    )


class Item(BaseModel, db.Model):
    __tablename__ = "item"

    id: Mapped[str] = mapped_column(
        db.String(128), primary_key=True, insert_default=lambda: next(gen)
    )
    name: Mapped[str] = mapped_column(db.String(150), nullable=False)
    photo: Mapped[str] = mapped_column(db.String(300), nullable=True)
    last_update: Mapped[datetime] = mapped_column(
        db.DateTime, nullable=False, server_default=func.now()
    )
    category_id: Mapped[int] = mapped_column(
        db.Integer, db.ForeignKey("category.id", ondelete="CASCADE"), nullable=False
    )
    category: Mapped["Category"] = relationship("Category", back_populates="items")
    procurement_items: Mapped[list["ProcurementItem"]] = relationship(
        "ProcurementItem", back_populates="item"
    )

    def as_dict(self):
        data = super().as_dict()
        category = getattr(self, "category")
        data["category"] = category.name
        data["category_id"] = category.id
        return data


class Vendor(BaseModel, db.Model):
    __tablename__ = "vendor"

    id: Mapped[int] = mapped_column(
        db.String(128), primary_key=True, insert_default=lambda: next(gen)
    )
    name: Mapped[str] = mapped_column(db.String(150), nullable=True)
    email: Mapped[str] = mapped_column(db.String(150), nullable=True)
    address: Mapped[str] = mapped_column(db.String(150), nullable=True)
    approved: Mapped[bool] = mapped_column(db.Boolean, default=False)
    gred: Mapped[float] = mapped_column(db.Float, nullable=False, default=-1)

    categories = relationship(
        "Category", secondary=vendor_category_association, back_populates="vendors"
    )
    rfqs: Mapped[list["RFQ"]] = relationship(
        "RFQ", back_populates="vendor", cascade="all, delete-orphan"
    )
    reviews: Mapped[list["Review"]] = relationship(
        "Review", back_populates="vendor", cascade="all, delete-orphan"
    )

    def as_dict(self):
        data = super().as_dict()
        categories = getattr(self, "categories", [])
        data["categories"] = [category.name for category in categories]
        reviews = getattr(self, "reviews", [])
        data["reviews"] = [review.as_dict() for review in reviews]
        return data


class Review(BaseModel, db.Model):
    __tablename__ = "review"

    id: Mapped[int] = mapped_column(
        db.String(128), primary_key=True, insert_default=lambda: next(gen)
    )
    vendor_id: Mapped[int] = mapped_column(db.String(128), db.ForeignKey("vendor.id"))
    rating: Mapped[float] = mapped_column(db.Float, nullable=False)
    caption: Mapped[str] = mapped_column(db.String(4096), nullable=True)
    date: Mapped[datetime] = mapped_column(db.DateTime, nullable=False)

    vendor = relationship("Vendor", back_populates="reviews")


class Procurement(BaseModel, db.Model):
    __tablename__ = "procurement"

    id: Mapped[int] = mapped_column(
        db.String(128), primary_key=True, insert_default=lambda: next(gen)
    )
    date: Mapped[datetime] = mapped_column(
        db.DateTime, nullable=False, server_default=func.now()
    )

    rfqs: Mapped[list["RFQ"]] = relationship(
        "RFQ", back_populates="procurement", cascade="all, delete-orphan"
    )
    items: Mapped[list["ProcurementItem"]] = relationship(
        "ProcurementItem", back_populates="Procurement", cascade="all"
    )

    def as_dict(self):
        data = super().as_dict()
        items = getattr(self, "items", [])
        data["items"] = [item.as_dict() for item in items]
        rfqs = getattr(self, "rfqs", [])
        data["rfq_total"] = len(rfqs)
        data["rfq_complete"] = len(
            [rfq for rfq in rfqs if rfq.response_time is not None]
        )
        return data


rfq_procurement_item = db.Table(
    "rfq_procurement_item",
    db.Column(
        "rfq_id",
        db.String(128),
        ForeignKey("rfq.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    db.Column("procurement_id", db.String(128), primary_key=True),
    db.Column("item_id", db.String(128), primary_key=True),
    db.ForeignKeyConstraint(
        ["procurement_id", "item_id"],
        ["procurement_item.procurement_id", "procurement_item.item_id"],
        ondelete="CASCADE",
    ),
)


class ProcurementItem(BaseModel, db.Model):
    __tablename__ = "procurement_item"

    quantity: Mapped[int] = mapped_column(db.Integer, nullable=True)
    unit_price: Mapped[str] = mapped_column(db.Numeric(10, 2), nullable=True)

    procurement_id: Mapped[str] = mapped_column(
        db.String(128),
        ForeignKey("procurement.id", ondelete="CASCADE"),
        primary_key=True,
    )
    Procurement: Mapped["Procurement"] = relationship(back_populates="items")

    item_id: Mapped[str] = mapped_column(
        db.String(128), ForeignKey("item.id", ondelete="CASCADE"), primary_key=True
    )
    item: Mapped["Item"] = relationship("Item", back_populates="procurement_items")
    rfqs: Mapped[list["RFQ"]] = relationship(
        "RFQ",
        secondary=rfq_procurement_item,
        back_populates="procurement_items",
    )

    def as_dict(self):
        data = super().as_dict()
        item = getattr(self, "item")
        data["name"] = item.name
        data["category"] = item.category.name
        data["category_id"] = item.category.id
        return data


class RFQStatus(enum.Enum):
    ENABLED = "enabled"
    DISABLED = "disabled"
    ORDERED = "ordered"


class RFQ(BaseModel, db.Model):
    __tablename__ = "rfq"

    id: Mapped[int] = mapped_column(
        db.String(128), primary_key=True, insert_default=lambda: next(gen)
    )
    date: Mapped[datetime] = mapped_column(
        db.DateTime, nullable=False, server_default=func.now()
    )
    token: Mapped[str] = mapped_column(db.String(500), nullable=False)
    response_time: Mapped[datetime] = mapped_column(db.DateTime, nullable=True)
    status: Mapped[RFQStatus] = mapped_column(
        Enum(RFQStatus), nullable=False, default=RFQStatus.ENABLED
    )

    procurement_id: Mapped[str] = mapped_column(
        db.String(128), ForeignKey("procurement.id", ondelete="CASCADE"), nullable=False
    )
    procurement: Mapped["Procurement"] = relationship(
        "Procurement", back_populates="rfqs", cascade="all"
    )
    vendor_id: Mapped[str] = mapped_column(
        ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False
    )
    vendor: Mapped["Vendor"] = relationship("Vendor", back_populates="rfqs")
    procurement_items: Mapped[list["ProcurementItem"]] = relationship(
        "ProcurementItem",
        secondary=rfq_procurement_item,
        back_populates="rfqs",
    )

    def as_dict(self):
        data = super().as_dict()
        vendor = getattr(self, "vendor", None)
        data["vendor_name"] = vendor.name if vendor else None
        data["status"] = self.status.value
        return data


# class Purchase(BaseModel, db.Model):
#     __tablename__ = "purchase"

#     id: Mapped[int] = mapped_column(db.String(128), primary_key=True)
#     date: Mapped[datetime] = mapped_column(
#         db.DateTime, nullable=False, server_default=func.now()
#     )
#     payment_term: Mapped[str] = mapped_column(db.String(150), nullable=True)
#     rfqs: Mapped[list["RFQ"]] = relationship(
#         "RFQ", back_populates="purchase", cascade="all, delete-orphan"
#     )
#     items: Mapped[list["ProcurementItem"]] = relationship(
#         "ProcurementItem", back_populates="purchase", cascade="all"
#     )
#     vendor_id: Mapped[str] = mapped_column(
#         ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False
#     )
#     vendor: Mapped["Vendor"] = relationship("Vendor", back_populates="rfqs")
#     status: Mapped[float] = mapped_column(db.Float, nullable=False, default=0)


# class User(BaseModel, db.Model):
#     __tablename__ = "user"


def force_drop_db():
    # Disable foreign key checks (specific to MySQL or MariaDB)
    db.session.execute(text("SET FOREIGN_KEY_CHECKS = 0"))
    db.session.commit()

    # Drop all tables
    db.drop_all()
    db.session.commit()


common_categories = [
    "Electronics",
    "Clothing",
    "Home & Kitchen",
    "Books",
    "Sports & Outdoors",
    "Health & Beauty",
    "Toys & Games",
    "Automotive",
    "Office Supplies",
    "Groceries",
    "Furniture",
    "Jewelry",
    "Tools & Hardware",
    "Pet Supplies",
    "Baby Products",
    "Music & Movies",
    "Art & Craft Supplies",
    "Gardening",
    "Luggage & Travel Gear",
    "Industrial & Scientific",
]


def populate_categories():
    for category_name in common_categories:
        existing_category = (
            db.session.query(Category).filter_by(name=category_name).first()
        )
        if not existing_category:
            category = Category(name=category_name)
            db.session.add(category)
    db.session.commit()


def init_db(app):
    global db
    production = os.environ["PRODUCTION"] == "1"
    app.config["SQLALCHEMY_DATABASE_URI"] = (
        os.environ["DATABASE_URL_PROD"] if production else os.environ["DATABASE_URL"]
    )
    db.init_app(app)
    with app.app_context():
        # force_drop_db()
        db.session.execute(text("SET FOREIGN_KEY_CHECKS = 1"))

        db.create_all()
        populate_categories()
        db.session.commit()

    app.logger.info("Database successfully initialized")
