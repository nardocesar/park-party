"""Lista métodos (com endereço nativo) e campos de classes do PICO PARK 2 (IL2CPP v29, arm64).

Uso: python3 -I tools/il2cpp_methods.py <global-metadata.dat> <GameAssembly.arm64.dylib> <Classe> [...]

Endereço = PhotonQuantumCode.dll methodPointers[rid-1]. A tabela fica em METHOD_POINTERS
(achada via REA: Il2CppCodeGenModule em 0x368f178, docs/re/01-player-constants.md).
Os ponteiros no arquivo são chained fixups DYLD_CHAINED_PTR_64_OFFSET: alvo nos 36 bits baixos.
"""
import struct
import sys

METHOD_POINTERS = 0x3870B68
IMAGE = "PhotonQuantumCode.dll"

meta_path, bin_path, *classes = sys.argv[1:]
meta = open(meta_path, "rb").read()
binary = open(bin_path, "rb").read()

h = struct.unpack_from("<" + "i" * 64, meta, 8)
so, mo, fo, fs, to, ts, io, isz, do, ds = h[4], h[10], h[22], h[23], h[38], h[39], h[40], h[41], h[14], h[15]
data_base = h[16]
s = lambda i: meta[so + i:meta.index(b"\0", so + i)].decode("utf-8", "replace")
fields = [struct.unpack_from("<iiI", meta, fo + i * 12) for i in range(fs // 12)]
const_fields = {struct.unpack_from("<iii", meta, do + i * 12)[0] for i in range(ds // 12)}
images = [struct.unpack_from("<10i", meta, io + i * 40) for i in range(isz // 40)]


def method_address(rid: int) -> int:
    raw = struct.unpack_from("<Q", binary, METHOD_POINTERS + (rid - 1) * 8)[0]
    return raw & 0xFFFFFFFFF


for t in range(ts // 88):
    v = struct.unpack_from("<" + "i" * 16 + "H" * 8, meta, to + t * 88)
    name = s(v[0])
    if name not in classes:
        continue
    image = next(s(im[0]) for im in images if im[2] <= t < im[2] + im[3])
    print(f"## {s(v[1])}.{name}  (typedef {t}, {image})")
    statics = [s(fields[f][0]) for f in range(v[8], v[8] + v[18]) if f not in const_fields]
    consts = [s(fields[f][0]) for f in range(v[8], v[8] + v[18]) if f in const_fields]
    print("campos (não-const, ordem de declaração):", " ".join(statics))
    if consts:
        print("const:", " ".join(consts))
    for m in range(v[16]):
        md = struct.unpack_from("<6i4H", meta, mo + (v[9] + m) * 32)
        rid = md[5] & 0xFFFFFF
        addr = method_address(rid) if image == IMAGE else None
        print(f"  {s(md[0]):40} rid={rid:5} " + (f"0x{addr:x}" if addr else "-"))
