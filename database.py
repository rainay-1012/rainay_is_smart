import enum
import logging
import os

from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import Enum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.orm._orm_constructors import relationship
from sqlalchemy.sql import expression

db = SQLAlchemy()


class Company(db.Model):
    __tablename__ = "company"
    id: Mapped[int] = mapped_column(db.Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(db.String(150), nullable=False)
    address: Mapped[str] = mapped_column(db.String(300), nullable=False)
    users: Mapped[list["User"]] = relationship(back_populates="company")


class Position(enum.Enum):
    manager = "Manager"
    executive = "Executive"
    admin = "Admin"


class User(db.Model):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(db.Integer, primary_key=True)
    fullname: Mapped[str] = mapped_column(db.String(150), nullable=False)
    position: Mapped[Position] = mapped_column(Enum(Position))
    status: Mapped[bool] = mapped_column(
        db.Boolean, server_default=expression.true(), default=True, nullable=False
    )
    company_id: Mapped[int] = mapped_column(ForeignKey("company.id"))
    company: Mapped["Company"] = relationship(back_populates="users")


def init_db(app):
    global db
    app.config["SQLALCHEMY_DATABASE_URI"] = os.environ["DATABASE_URL"]
    db.init_app(app)
    with app.app_context():
        db.drop_all()
        db.create_all()
    logging.info("Database successfully initialized")
