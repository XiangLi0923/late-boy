# -*- coding: utf-8 -*-
"""生成「阿莉的图 v1.2.2」推广二维码海报"""
from PIL import Image, ImageDraw, ImageFont
import qrcode
from qrcode.constants import ERROR_CORRECT_H

URL = "https://42aba744ece84a7d8d49f750ce783a27.app.workbuddy.link"
HEAD = r"D:\Claude dates 无敌牛娃闪闪\拼豆图纸生成程序\推广物料\羊羔_原图.png"
OUT_QR = r"D:\Claude dates 无敌牛娃闪闪\拼豆图纸生成程序\推广物料\二维码_纯码.png"
OUT_POSTER = r"D:\Claude dates 无敌牛娃闪闪\拼豆图纸生成程序\推广物料\二维码_推广海报.png"


def get_font(size, bold=True):
    candidates = [
        r"C:\Windows\Fonts\msyhbd.ttc",
        r"C:\Windows\Fonts\msyh.ttc",
        r"C:\Windows\Fonts\simhei.ttf",
    ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def center_text(draw, y, text, font, fill):
    width = draw.textlength(text, font=font)
    draw.text(((1080 - width) / 2, y), text, fill=fill, font=font)


# ---------- 1. 带羊羔头像的二维码 ----------
qr = qrcode.QRCode(
    version=None,
    error_correction=ERROR_CORRECT_H,
    box_size=20,
    border=2,
)
qr.add_data(URL)
qr.make(fit=True)

qr_only = qr.make_image(fill_color="#1d3557", back_color="white").convert("RGB")
Wq, Hq = qr_only.size

head = Image.open(HEAD).convert("RGB")
side = min(head.size)
head_sq = head.crop((
    (head.size[0] - side) // 2,
    (head.size[1] - side) // 2,
    (head.size[0] + side) // 2,
    (head.size[1] + side) // 2,
))

target = int(Wq * 0.30)
avatar = head_sq.resize((target, target), Image.LANCZOS)

mask = Image.new("L", (target, target), 0)
ImageDraw.Draw(mask).ellipse([0, 0, target, target], fill=255)

pad = 10
ring = Image.new("L", (target + pad * 2, target + pad * 2), 0)
ImageDraw.Draw(ring).ellipse([0, 0, target + pad * 2 - 1, target + pad * 2 - 1], fill=255)
ImageDraw.Draw(ring).ellipse([pad, pad, target + pad - 1, target + pad - 1], fill=0)

pos = (Wq // 2 - target // 2, Hq // 2 - target // 2)
qr_only.paste(Image.new("RGB", (target, target), "white"), pos)
qr_only.paste(
    Image.new("RGB", (target + pad * 2, target + pad * 2), "#1d3557"),
    (pos[0] - pad, pos[1] - pad),
    ring,
)
qr_only.paste(avatar, pos, mask)
qr_only.save(OUT_QR, dpi=(300, 300))
print("已保存纯二维码:", OUT_QR, qr_only.size)


# ---------- 2. 朋友圈推广海报 ----------
PW, PH = 1080, 1500
poster = Image.new("RGB", (PW, PH), "#ffffff")
draw = ImageDraw.Draw(poster)

draw.rectangle([0, 0, PW, 280], fill="#1d3557")
draw.rectangle([0, 280, PW, 290], fill="#e76f51")

title_font = get_font(92)
center_text(draw, 56, "阿莉的图", title_font, "#ffffff")

sub_font = get_font(40, bold=False)
center_text(draw, 176, "图片秒变拼豆图纸 · 免费在线试用", sub_font, "#a8dadc")

version_font = get_font(34, bold=True)
version_text = "新版 v1.2.2 · 2026.08.27"
vw = draw.textlength(version_text, font=version_font)
pill_w = int(vw + 56)
pill_x = (PW - pill_w) // 2
draw.rounded_rectangle(
    [pill_x, 318, pill_x + pill_w, 382],
    radius=32,
    fill="#e76f51",
)
draw.text(
    (pill_x + 28, 330),
    version_text,
    fill="#ffffff",
    font=version_font,
)

qr_big = qr_only.resize((700, 700), Image.LANCZOS)
poster.paste(qr_big, ((PW - 700) // 2, 420))

tip_font = get_font(46, bold=True)
center_text(draw, 1160, "微信扫码 · 免费试用", tip_font, "#1d3557")

feature_font = get_font(30, bold=False)
features = [
    "AI 智能抠图 · 相似色合并 · 默认减少用色",
    "色号标注 · 镜像 · 高亮 · PNG/PDF/CSV 导出",
    "手机 / 电脑 / 微信小程序都能用",
]
y = 1250
for line in features:
    center_text(draw, y, line, feature_font, "#457b9d")
    y += 62

draw.rectangle([0, PH - 14, PW, PH], fill="#e76f51")
draw.rectangle([0, PH - 28, PW, PH - 22], fill="#f4a261")

poster.save(OUT_POSTER, dpi=(300, 300))
print("已保存推广海报:", OUT_POSTER, poster.size)
