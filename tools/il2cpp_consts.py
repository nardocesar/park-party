"""Extrai valores padrão de campos const do global-metadata.dat (IL2CPP v29).

Uso: python3 -I tools/il2cpp_consts.py <global-metadata.dat> <regex do campo>
"""
import json
import re
import struct
import sys

path, pattern = sys.argv[1], sys.argv[2]
buf = open(path, "rb").read()
sanity, version = struct.unpack_from("<Ii", buf, 0)
assert sanity == 0xFAB11BAF and version == 29, (hex(sanity), version)
h = struct.unpack_from("<" + "i" * 64, buf, 8)
sec = {name: (h[i * 2], h[i * 2 + 1]) for i, name in enumerate([
    "stringLiteral", "stringLiteralData", "string", "events", "properties", "methods",
    "parameterDefaultValues", "fieldDefaultValues", "fieldAndParameterDefaultValueData",
    "fieldMarshaledSizes", "parameters", "fields", "genericParameters",
    "genericParameterConstraints", "genericContainers", "nestedTypes", "interfaces",
    "vtableMethods", "interfaceOffsets", "typeDefinitions"])}


def s(idx):
    off = sec["string"][0] + idx
    return buf[off:buf.index(b"\0", off)].decode("utf-8", "replace")


fo, fs = sec["fields"]
fields = [struct.unpack_from("<iiI", buf, fo + i * 12) for i in range(fs // 12)]
to, ts = sec["typeDefinitions"]
owner = {}
for t in range(ts // 88):
    v = struct.unpack_from("<" + "i" * 16 + "H" * 8, buf, to + t * 88)
    name, ns, field_start, field_count = s(v[0]), s(v[1]), v[8], v[16 + 2]
    for f in range(field_start, field_start + field_count):
        owner[f] = f"{ns}.{name}" if ns else name

do, ds = sec["fieldDefaultValues"]
data_base = sec["fieldAndParameterDefaultValueData"][0]
rx = re.compile(pattern)


def cuint(b, o=0):
    x = b[o]
    if x < 0x80:
        return x, 1
    if x & 0xC0 == 0x80:
        return ((x & 0x3F) << 8) | b[o + 1], 2
    if x & 0xE0 == 0xC0:
        return ((x & 0x1F) << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3], 4
    if x == 0xF0:
        return struct.unpack_from("<I", b, o + 1)[0], 5
    return (0xFFFFFFFE if x == 0xFE else 0xFFFFFFFF), 1


def cint(b):
    if not b:
        return None
    u, _ = cuint(b)
    return -(u >> 1) - 1 if u & 1 else u >> 1


def cstr(off):
    n, k = cuint(buf, off)
    if n > 200:
        return None
    try:
        return buf[off + k:off + k + n].decode("utf-8")
    except UnicodeDecodeError:
        return None
out = []
for i in range(ds // 12):
    field_index, type_index, data_index = struct.unpack_from("<iii", buf, do + i * 12)
    fname = s(fields[field_index][0])
    full = f"{owner.get(field_index, '?')}.{fname}"
    if not rx.search(full):
        continue
    raw = buf[data_base + data_index:data_base + data_index + 8] if data_index >= 0 else b""
    f32 = struct.unpack_from("<f", raw)[0] if len(raw) >= 4 else None
    i32 = struct.unpack_from("<i", raw)[0] if len(raw) >= 4 else None
    out.append({"field": full, "type_index": type_index, "f32": f32, "i32": i32,
                "cint": cint(raw), "str": cstr(data_base + data_index) if data_index >= 0 else None,
                "raw": raw[:4].hex()})
json.dump(out, sys.stdout, indent=1)
