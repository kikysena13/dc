Command:
!whellevi add @member 150000 WHELL
Menambah 150.000 RP.


Menambah spending LEVIA.
!whellevi add @member 250000 LEVIA

Mengatur total spending menjadi 500.000 RP.
!whellevi cek @member

Melihat total spending.
!whellevi reset @member WHELL

Mereset poin WHELL member.
Poin tersimpan di:
data/whellevi-points.json

Dashboard Top Whell dan Top Levia sekarang diurutkan berdasarkan total RP spending, bukan XP umum. Command hanya bisa dipakai user dengan izin Manage Server.

!whellevi add @member 150000 RP WHELL
!whellevi add @member $150000 LEVIA
!addinput https://example.com/profile.gif
!addinputbio Bio kamu di sini

Bio dan background akan otomatis disinkronkan ke GitHub setelah command berhasil. Tambahkan variable Railway berikut:

GITHUB_TOKEN=token_github_dengan_permission_Contents_Read_and_write
GITHUB_REPOSITORY=kikysena13/dc
GITHUB_BRANCH=main
GITHUB_DATA_PATH=data/whellevi-points.json

!whellevi add @member $30000000 LEVIA
!whellevi add @member 30000000 RP WHELL

!addinputbio Bio saya
!addinput https://tenor.com/inyFxs4BmKB.gif

!whellevi resetall @member
!whellevi reset @member LEVIA
!whellevi reset @member WHELL



Cara user crop background
Sekarang user bisa pakai format ini:

!addinput https://contoh.com/gambar.gif crop=top-left
!addinput https://contoh.com/gambar.gif crop=bottom-right
!addinput https://contoh.com/gambar.gif crop=center
!addinput https://contoh.com/gambar.gif crop=center-left
!addinput https://contoh.com/gambar.gif crop=center-right
Opsi crop yang didukung
center
top
bottom
left
right
top-left
top-right
bottom-left
bottom-right
center-left
center-right
center left
center right
Contoh yang lebih jelas
Kalau mau fokus ke bagian atas kiri:
!addinput https://.../gambar.gif crop=top-left
Kalau mau fokus ke bagian tengah kiri:
!addinput https://.../gambar.gif crop=center-left
Kalau mau fokus ke bagian tengah kanan:
!addinput https://.../gambar.gif crop=center-right
Kalau mau fokus ke bagian tengah:
!addinput https://.../gambar.gif crop=center