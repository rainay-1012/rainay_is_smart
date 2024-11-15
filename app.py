from flask import Flask, render_template

app = Flask(__name__)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/hello")
def hello():
    return {"message": "hello all"}


@app.route("/user/<user_id>")
def user_data(user_id: str):
    print(f"logged in with user id: {user_id}")
    return {"user": f"is this your user id: {user_id}"}


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5001)
