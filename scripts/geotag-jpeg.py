#!/usr/bin/env python3
"""Inject a minimal EXIF GPS segment into a JPEG (dev/test tool).

    python3 scripts/geotag-jpeg.py in.jpg out.jpg LAT LONG ["YYYY:MM:DD HH:MM:SS"]

Builds a little-endian TIFF container with IFD0 → {GPSInfo, ExifIFD},
a GPS IFD carrying lat/long as DMS rationals, and (optionally) an Exif
IFD with DateTimeOriginal — the exact structure src/engine/exif-gps.js
parses. Used to generate the test fixtures and the demo-vault photos.
"""
import struct
import sys


def rational_dms(deg):
    deg = abs(deg)
    d = int(deg)
    m = int((deg - d) * 60)
    s = round(((deg - d) * 60 - m) * 60 * 10000)
    return [(d, 1), (m, 1), (s, 10000)]


def build_exif(lat, long, time=None):
    little = "<"
    entries0 = []          # IFD0 entries: (tag, type, count, value_bytes or offset-fixup)
    blobs = []             # (placeholder_index, data) appended after IFDs

    # Layout: TIFF header (8) + IFD0 + GPS IFD + [Exif IFD] + data blobs.
    n0 = 2 if time else 1
    ifd0_at = 8
    ifd0_size = 2 + n0 * 12 + 4
    gps_at = ifd0_at + ifd0_size
    n_gps = 4
    gps_size = 2 + n_gps * 12 + 4
    exif_at = gps_at + gps_size
    exif_size = (2 + 1 * 12 + 4) if time else 0
    data_at = exif_at + exif_size

    def entry(tag, typ, count, value):
        return struct.pack(little + "HHI", tag, typ, count) + value

    data = b""

    def defer(payload):
        nonlocal data
        at = data_at + len(data)
        data += payload
        return struct.pack(little + "I", at)

    # GPS IFD
    lat_rat = b"".join(struct.pack(little + "II", n, d) for n, d in rational_dms(lat))
    long_rat = b"".join(struct.pack(little + "II", n, d) for n, d in rational_dms(long))
    gps_entries = (
        entry(0x0001, 2, 2, (b"S\x00" if lat < 0 else b"N\x00") + b"\x00\x00")
        + entry(0x0002, 5, 3, defer(lat_rat))
        + entry(0x0003, 2, 2, (b"W\x00" if long < 0 else b"E\x00") + b"\x00\x00")
        + entry(0x0004, 5, 3, defer(long_rat))
    )
    gps_ifd = struct.pack(little + "H", n_gps) + gps_entries + struct.pack(little + "I", 0)

    # Exif IFD (DateTimeOriginal), optional
    exif_ifd = b""
    if time:
        stamp = time.encode() + b"\x00"
        exif_ifd = (
            struct.pack(little + "H", 1)
            + entry(0x9003, 2, len(stamp), defer(stamp))
            + struct.pack(little + "I", 0)
        )

    # IFD0
    ifd0_entries = entry(0x8825, 4, 1, struct.pack(little + "I", gps_at))
    if time:
        ifd0_entries += entry(0x8769, 4, 1, struct.pack(little + "I", exif_at))
    ifd0 = struct.pack(little + "H", n0) + ifd0_entries + struct.pack(little + "I", 0)

    tiff = b"II*\x00" + struct.pack(little + "I", ifd0_at) + ifd0 + gps_ifd + exif_ifd + data
    payload = b"Exif\x00\x00" + tiff
    return b"\xff\xe1" + struct.pack(">H", len(payload) + 2) + payload


def main():
    src, dst, lat, long = sys.argv[1], sys.argv[2], float(sys.argv[3]), float(sys.argv[4])
    time = sys.argv[5] if len(sys.argv) > 5 else None
    jpeg = open(src, "rb").read()
    assert jpeg[:2] == b"\xff\xd8", "not a JPEG"
    # Strip any existing APP1/Exif so ours is authoritative.
    out = jpeg[:2]
    at = 2
    while at + 4 <= len(jpeg) and jpeg[at] == 0xFF and jpeg[at + 1] not in (0xD8, 0xDA):
        size = struct.unpack(">H", jpeg[at + 2:at + 4])[0]
        seg = jpeg[at:at + 2 + size]
        if not (jpeg[at + 1] == 0xE1 and seg[4:10] == b"Exif\x00\x00"):
            out += seg
        at += 2 + size
    out = out[:2] + build_exif(lat, long, time) + out[2:] + jpeg[at:]
    open(dst, "wb").write(out)
    print(f"geotagged {dst} ({lat}, {long}{', ' + time if time else ''})")


if __name__ == "__main__":
    main()
