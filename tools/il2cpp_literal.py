"""Decodifica slots de metadata usage do IL2CPP v29 (ex.: 0xa000091b) para o valor.

Uso: python3 -I tools/il2cpp_literal.py <global-metadata.dat> <slot hex> [...]
Tipo 5 (StringLiteral): imprime o texto. Outros tipos: imprime tipo e índice.
"""
import struct
import sys

meta_path, *slots = sys.argv[1:]
meta = open(meta_path, "rb").read()
h = struct.unpack_from("<" + "i" * 64, meta, 8)
lit_off, lit_size, data_off = h[0], h[1], h[2]
for raw in slots:
    v = int(raw, 16)
    kind, index = v >> 29, (v & 0x1FFFFFFF) >> 1
    if kind == 5:
        length, data = struct.unpack_from("<II", meta, lit_off + index * 8)
        text = meta[data_off + data:data_off + data + length].decode("utf-8", "replace")
        print(f"{raw}: string literal #{index} = {text!r}")
    else:
        print(f"{raw}: tipo {kind}, índice {index}")
