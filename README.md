# 🖼️ PixelPeel — AI Background Remover

A web app that removes (or isolates) the background of any photo using an on-device AI
segmentation model, then lets you drop in a new solid color, gradient, or scene backdrop —
all in the browser, with instant previews and a one-click download.

## ✨ Features

- 🔍 One-click background removal — upload a photo, get a clean cutout.
- 🎯 Foreground removal mode — keep only the background, erase the subject instead.
- 🎨 Instant recoloring: solid colors, custom color picker, or built-in scenes
  (Sunset, Ocean, Dusk, Studio, Night sky, Beach) — all composited client-side, so
  switching backgrounds is instant with no extra server round-trip.
- ⬇️ Download the final composited image as PNG.
- 🌗 Light/dark theme toggle.

## 🛠️ Tech Stack

- **Backend:** Flask + [rembg](https://github.com/danielgatis/rembg) (U²-Net) for subject
  segmentation.
- **Frontend:** Vanilla HTML/CSS/JS — the cutout is fetched once from the backend, and all
  color/scene compositing happens client-side via `<canvas>`.

## 📁 Project Structure

```
background removal/
├── app.py                  # Flask app — single /api/cutout endpoint
├── requirements.txt
├── templates/
│   └── index.html
├── static/
│   ├── style.css
│   └── script.js
├── Results/                # Sample input/output images
└── legacy_deeplabv3/       # Original college-project DeepLabV3+/ResNet50 training code
    ├── model1.py           # Model architecture
    ├── image.py            # Metrics (dice_loss, dice_coef, iou)
    └── run.py              # Original CLI inference script (needs trained model.h5, not included)
```

The `legacy_deeplabv3/` folder holds the original from-scratch model this project started as.
Its trained weights (`model.h5`) were never saved, so the live app uses `rembg`'s pretrained
U²-Net model instead — same idea (image in, subject mask out), no training required.

## 📦 Installation

```bash
git clone https://github.com/Ramteja24/Image-Background-Removal-AI.git
cd Image-Background-Removal-AI

python -m venv venv
source venv/bin/activate       # On Windows: venv\Scripts\activate

pip install -r requirements.txt
```

## ✅ Usage

```bash
python app.py
```

Then open `http://127.0.0.1:5000` in a browser:

1. Drop in an image.
2. Choose **Remove Background** (keep the subject) or **Remove Foreground** (keep the scene,
   erase the subject).
3. Pick a background — a solid color, custom color, or one of the built-in scenes.
4. Download the result.

## 🧪 Example

Input:
![pic3](https://github.com/user-attachments/assets/96cdc20a-177f-4f39-b08c-190e07a2bbe5)

Output:
![pic3](https://github.com/user-attachments/assets/478adb43-53fb-405f-9d90-afdb8a2ee8a0)
