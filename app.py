import io

from flask import Flask, request, render_template, send_file, jsonify
from rembg import remove, new_session

app = Flask(__name__)

MAX_UPLOAD_BYTES = 15 * 1024 * 1024  # 15 MB
app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_BYTES

# Loaded once at startup and reused for every request.
_session = new_session("u2net")


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/cutout", methods=["POST"])
def api_cutout():
    """Return the subject cutout as a transparent PNG (foreground on alpha, background removed).

    The frontend composites colors/gradients and can invert the mask to isolate the
    background instead, so this is the only image-processing call the client needs.
    """
    if "image" not in request.files:
        return jsonify({"error": "No image file provided under field 'image'."}), 400

    file = request.files["image"]
    if file.filename == "":
        return jsonify({"error": "No file selected."}), 400

    try:
        image_bytes = file.read()
        cutout_bytes = remove(image_bytes, session=_session)
    except Exception as exc:
        return jsonify({"error": f"Failed to process image: {exc}"}), 500

    return send_file(io.BytesIO(cutout_bytes), mimetype="image/png", download_name="cutout.png")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
