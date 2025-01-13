from typing import Optional, Union

from pydantic import BaseModel, EmailStr, constr
from typing_extensions import Annotated


class UserRegistrationData(BaseModel):
    email: EmailStr
    password: Annotated[
        str,
        constr(
            min_length=8,
            max_length=32,
            pattern=r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$",
        ),
    ]
    fullname: str
    username: Annotated[str, constr(min_length=1)]
    phone: Annotated[str, constr(pattern=r"^\+[1-9]\d{1,14}$")]


class UpdateUserData(BaseModel):
    uid: str
    role: Union[str, None] = None
    name: Union[str, None] = None
    username: str
    phoneNo: Union[Annotated[str, constr(pattern=r"^\+?[1-9]\d{1,14}$")], None] = None


class VerifyEmailQuery(BaseModel):
    token: str


class PurchaseRequest(BaseModel):
    token: str


class RFQEmailParams(BaseModel):
    token: str
    internal: Optional[bool] = False


class RFQItemSubmission(BaseModel):
    item_id: str
    quantity: int
    unit_price: float


class RFQSubmission(BaseModel):
    token: str
    items: list[RFQItemSubmission]


class AddRFQRequest(BaseModel):
    id: str
    items: list[str]
    vendors: list[str]
