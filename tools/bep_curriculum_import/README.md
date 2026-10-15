# BEP müfredat aktarım aracı (Türkçe, sınıf bazında hazırlık aktarımı)

Bu araç hiçbir veritabanına bağlanmaz. CSV'yi yalnızca okur ve 032 migration'ına uygun bir hazırlık (staging) SQL dosyası üretir.

## Üretim
```
python3 generate_tr_grade_seed.py "<CSV yolu>" --grade 1 --out-dir output
```
Doğrulama hatası varsa SQL dosyası üretilmez; sorunlar `output/tr_grade1_validation_report.json` içinde listelenir.

## Seed dosyasının içeriği
- Sürüm `TYMM-2024-TR` (taslak), 1. sınıf (taslak), kaynak belgeler, aktarım partisi, ham satırlar (aynen), temalar, tema kazanımları ve tema bileşenleri.
- Kanonik kayıt, karar kaydı ve yayın içermez. Tüm eşleşmeler `unmapped` kalır, öğretmen kataloğu boş kalır.
- Dosya tek bir transaction olarak çalışır. Sürüm zaten varsa hiçbir şey yazmadan durur.

## Doğrulama (salt-okunur)
`verify_tr_grade1_staging.sql` yalnızca SELECT çalıştırır. Her kontrol için bir satır döndürür; tüm satırlarda sonuç `GEÇTİ` olmalıdır.

## Önemli
Kaynak belgeler, partiler, ham satırlar ve karar kayıtları 032 kuralları gereği yalnızca eklenebilir; sonradan silinemez. Seed dosyası Supabase'de çalıştırılmadan önce izole bir test veritabanında denenmelidir.
