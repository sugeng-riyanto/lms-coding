# Certificate, QR, and Blockchain Verification

## Prinsip

QR bukan bukti dengan sendirinya. QR membuka halaman HTTPS `/verify/{public_id}`; server memeriksa record, status pencabutan, payload hash, dan anchor opsional.

## Isi PDF A4 landscape

- nama lembaga dan logo;
- judul “Certificate of Completion”;
- nama tampilan murid sesuai consent;
- course dan level;
- tanggal penerbitan;
- nomor serial;
- nama/tanda tangan guru;
- QR verification;
- fingerprint pendek dari SHA-256;
- pernyataan kompetensi, bukan nilai detail.

## Canonical payload

```json
{
  "certificateId": "uuid",
  "publicId": "unguessable-id",
  "issuerId": "uuid",
  "recipientId": "internal-uuid",
  "courseVersionId": "uuid",
  "levelId": "uuid",
  "issuedAt": "ISO-8601",
  "serialNo": "string"
}
```

Serialisasi deterministik, hash SHA-256 pada server, simpan hash dan payload internal. Public verifier tidak menampilkan `recipientId`.

## Issuance flow

1. Server mengunci eligibility evaluation.
2. Hitung canonical payload dan hash.
3. Buat certificate record dengan idempotency key.
4. Render PDF A4 dan QR.
5. Simpan PDF di private bucket.
6. Opsional: masukkan hash ke batch Merkle tree dan anchor root ke blockchain.
7. Tandai aktif setelah PDF tersimpan; anchor dapat berstatus pending.

## Blockchain adapter

Interface: `anchor(rootHash)`, `getStatus(reference)`, `verify(rootHash, reference)`.

- Feature flag default OFF.
- Network/provider dipilih saat deployment setelah evaluasi biaya, keberlanjutan, dan regulasi.
- Jangan menaruh nama, email, student ID, nilai, jawaban, atau PDF di chain.
- Sertifikat tetap dapat diverifikasi secara kriptografis tanpa blockchain.
- UI harus membedakan `record valid`, `hash valid`, dan `chain anchored`; jangan menyebut “blockchain verified” jika transaksi belum final.

## Revocation

Revocation menyimpan alasan internal, waktu, dan actor; public page hanya menampilkan revoked dan tanggal. File lama tidak dihapus dari audit trail, tetapi signed download tidak diberikan sebagai sertifikat aktif.

