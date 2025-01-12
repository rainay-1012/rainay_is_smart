from flask import jsonify


class DataResponse:
    def __init__(self, data, status_code=200):
        """
        Data response class.
        :param data: The data to be returned in the response.
        :param status_code: The HTTP status code for the response (default is 200).
        """
        self.data = data
        self.status_code = status_code

    def to_response(self):
        """
        Converts the response into a Flask JSON response.
        """
        return jsonify(self.data), self.status_code


class Response:
    def __init__(self, code: str, message: str, status_code: int = 200, **kwargs):
        """
        Base response class.
        :param code: A code representing the response type (e.g., "success", "auth/invalid-position").
        :param message: A human-readable message describing the response.
        :param status_code: The HTTP status code for the response (default is 200).
        :param kwargs: Additional key-value pairs to include in the response.
        """
        self.code = code
        self.message = message
        self.status_code = status_code
        self.extra = kwargs

    def to_dict(self):
        """
        Converts the response into a dictionary.
        """
        response_dict = {
            "code": self.code,
            "message": self.message,
            **self.extra,
        }
        return response_dict

    def to_response(self):
        """
        Converts the response into a Flask JSON response.
        """
        return jsonify(self.to_dict()), self.status_code


class ExceptionResponse(Response, Exception):
    def __init__(self, code, user_message, server_message, status_code=400, **kwargs):
        # Initialize ApiResponse
        Response.__init__(
            self,
            code=code,
            message=user_message,
            status_code=status_code,
            **kwargs,
        )
        # Initialize Exception with the server message
        Exception.__init__(self, server_message)

    def to_response(self):
        """
        Override to_response to ensure it works as both a response and an exception.
        """
        return super().to_response()


class InvalidUserException(ExceptionResponse):
    def __init__(
        self,
        user_message="The user is invalid or cannot be processed.",
        server_message="An invalid user was encountered.",
        status_code=400,
        **kwargs,
    ):
        super().__init__(
            code="auth/invalid-user",
            user_message=user_message,
            server_message=server_message,
            status_code=status_code,
            **kwargs,
        )


class ResourceNotFoundException(ExceptionResponse):
    def __init__(
        self,
        resource_type: str,
        resource_id: str,
        status_code=404,
        **kwargs,
    ):
        user_message = f"The requested {resource_type.lower()} was not found."
        server_message = f"{resource_type} with ID {resource_id} was not found."

        super().__init__(
            code="resource/not-found",
            user_message=user_message,
            server_message=server_message,
            status_code=status_code,
            **kwargs,
        )
