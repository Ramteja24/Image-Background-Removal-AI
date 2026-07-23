import io
import os
import urllib.request

import numpy as np
import onnxruntime as ort
from flask import Flask, request, render_template, send_file, jsonify
from PIL import Image, ImageOps

app = Flask(__name__)

MAX_UPLOAD_BYTES = 15 * 1024 * 1024  # 15 MB
app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_BYTES

# Cap the longest side before compositing so large uploads don't blow past the
# RAM budget on small hosting instances (e.g. Render's free tier). The model
# itself always runs at a fixed 320x320 regardless of input size.
MAX_DIMENSION = 1600

# Same U2netp weights rembg uses, fetched directly so we don't have to pull in
# rembg's full dependency tree (opencv, pymatting/numba, scipy, scikit-image)
# for features (alpha matting, mask post-processing) this app doesn't use.
MODEL_URL = "https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx"
MODEL_PATH = os.path.join(os.path.dirname(__file__), "models", "u2netp.onnx")

MODEL_INPUT_SIZE = (320, 320)
MODEL_MEAN = (0.485, 0.456, 0.406)
MODEL_STD = (0.229, 0.224, 0.225)


def _ensure_model() -> str:
    if not os.path.exists(MODEL_PATH):
        os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
        tmp_path = MODEL_PATH + ".part"
        urllib.request.urlretrieve(MODEL_URL, tmp_path)
        os.replace(tmp_path, MODEL_PATH)
    return MODEL_PATH


def _build_session() -> ort.InferenceSession:
    # onnxruntime's CPU memory arena pre-reserves large power-of-two chunks
    # regardless of how small the model's tensors actually are (a few hundred
    # MB for this 320x320 model) and never releases them. Disabling it trades
    # a small amount of per-request allocator overhead for bounded memory use
    # on small hosting instances (e.g. Render's free tier).
    sess_options = ort.SessionOptions()
    sess_options.enable_cpu_mem_arena = False
    sess_options.intra_op_num_threads = 1
    sess_options.inter_op_num_threads = 1
    return ort.InferenceSession(
        _ensure_model(), sess_options=sess_options, providers=["CPUExecutionProvider"]
    )


# Loaded once at startup and reused for every request.
_session = _build_session()
_input_name = _session.get_inputs()[0].name


def _predict_mask(img: Image.Image) -> Image.Image:
    """Run U2netp and return a single-channel soft mask resized to img's size."""
    resized = img.convert("RGB").resize(MODEL_INPUT_SIZE, Image.Resampling.LANCZOS)

    arr = np.array(resized, dtype=np.float32) / 255.0
    arr = (arr - MODEL_MEAN) / MODEL_STD
    arr = arr.transpose(2, 0, 1)[np.newaxis, :, :, :].astype(np.float32)

    outputs = _session.run(None, {_input_name: arr})
    pred = outputs[0][0, 0, :, :]
    pred = (pred - pred.min()) / (pred.max() - pred.min() + 1e-8)

    mask = Image.fromarray((pred * 255).astype("uint8"), mode="L")
    return mask.resize(img.size, Image.Resampling.LANCZOS)


def remove_background(image_bytes: bytes) -> bytes:
    img = Image.open(io.BytesIO(image_bytes))
    img = ImageOps.exif_transpose(img)
    img.thumbnail((MAX_DIMENSION, MAX_DIMENSION), Image.Resampling.LANCZOS)

    mask = _predict_mask(img)

    empty = Image.new("RGBA", img.size, 0)
    cutout = Image.composite(img.convert("RGBA"), empty, mask)

    buffer = io.BytesIO()
    cutout.save(buffer, "PNG")
    return buffer.getvalue()


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
        cutout_bytes = remove_background(file.read())
    except Exception as exc:
        return jsonify({"error": f"Failed to process image: {exc}"}), 500

    return send_file(io.BytesIO(cutout_bytes), mimetype="image/png", download_name="cutout.png")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
