# PDRPUSULA Risk Haritası — PRD

## Problem / Amaç
Türkiye RAM (Rehberlik ve Araştırma Merkezi) için okul bazlı Risk Haritası platformu.
Okullar öğrencilerini yönetir, Risk Haritası verisi girer, sonuçları anonim snapshot
olarak RAM'a gönderir; Genel Admin (RAM) gönderimleri ve birleşik analizi görür.

## Mimari
- Frontend: React (CRA), Tailwind, lucide-react. `REACT_APP_BACKEND_URL` kullanır.
- Backend: FastAPI, tüm rotalar `/api` prefixli, port 8001 (supervisor).
- Veritabanı/Auth: **Supabase** (PostgreSQL + Auth). Backend service_role client (RLS bypass).
  MongoDB KULLANILMIYOR.
- Güvenlik: backend-first. Okul: `_require_school_ready` (token→school_accounts→school_id).
  Admin: `_require_general_admin` (admin_profiles role=general_admin).

## Migrations (Supabase SQL Editor'da MANUEL çalıştırılır — agent asla uygulamaz)
- 001 referans tabloları (academic_years, education_levels, management_types, school_types)
- 002–007 schools, school_accounts, admin_profiles vb.
- 008 school_classes
- 009 students + student_class_enrollments (same-school trigger)
- 010 risk_categories (36 sabit RISK-001..036) + student_risks (+ note-integrity trigger; requires_note yalnız true'da zorunlu)
- 011 student_risk_assessments (form tamamlandı işareti)
- 012 risk_domains (8 alan DOMAIN-001..008) + risk_category_domains (36→8 eşleştirme, transaction-içi count guard)
- 013 school_submissions + 5 snapshot tablosu (submission_risk/domain/class totals) — RAM'a gönderim/snapshot

## Tamamlanan Özellikler
### Okul tarafı
- Kök `/` → `/school/login` yönlendirmesi
- Okul login + ilk girişte zorunlu şifre değiştirme
- Sınıf Tanımları (/school/classes)
- Öğrenciler (/school/students): tek ekleme, listeleme, arama, Excel ön izleme + toplu aktar (all-or-nothing)
- Risk Haritası Veri Girişi (/school/risk-entry): sınıf→öğrenci→36 madde, "Diğer" note, kaydet + assessment upsert
- Sınıf Risk Haritası v2 (/school/risk-map): 5 özet kart, 8 alan, 36 madde, sınıf içi sıralama
- Okul Risk Haritası v2 (/school/risk-map/school): okul geneli + sınıflar arası karşılaştırma matrisi
- RAM'a Gönder: eksik öğrenci varken de gönderilebilir (uyarılı onay modalı), version'lı snapshot

### Genel Admin (RAM) tarafı
- /admin/risk-map: Okul Gönderimleri listesi (ilçe/okul/durum filtresi, snapshot kaynaklı, Görüntüle)
- /admin/risk-map/submissions/:id: Gönderim Detayı (snapshot; 8 alan + 36 madde toggle'lı, sınıf expand)
- /admin/risk-map/aggregate: RAM Birleşik Risk Haritası — en güncel version/okul; filtreler:
  Eğitim Yılı + İlçe + Kademe + Okul Türü (kademeye göre daralan) + Yönetim Türü (AND)

## Kritik matematik kuralları
- Tamamlanma oranı paydası = toplam aktif öğrenci
- Risk maddesi / ana alan yüzdesi paydası = formu tamamlanan öğrenci (completed)
- Ana alan sayımı distinct öğrenci (aynı öğrenci aynı alanda çok risk → 1)
- Birleşik: SUM(student_count)/SUM(completed_students)×100 (okul yüzde ortalaması ASLA alınmaz)
- Analiz yalnız snapshot tablolarından; canlı students/student_risks okunmaz

## Gizlilik
Snapshot ve RAM ekranlarında öğrenci kimliği/no/ad/soyad/bireysel risk/serbest not YOK.

## Çalışma kuralı (kullanıcı isteği)
Tek küçük görev → dur → kullanıcı Preview'da manuel test → GitHub checkpoint → sonraki görev.
testing_agent/otomatik test/curl/screenshot yalnız kullanıcı açıkça isterse. Migration'ları
kullanıcı manuel çalıştırır; agent SQL dosyasını yalnız hazırlar.

## Durum
Deployment readiness: deployment_agent PASS (Haziran 2026). Kod tabanı deploy'a hazır;
env değişkenleri doğru, /api prefix, portlar, CORS uygun.

## Backlog / Sonraki olası görevler
- RLS policy tasarımı (tüm tablolarda RLS ON, policy=0)
- Submission status workflow (under_review / revision_requested / approved) UI+backend
- Karşılaştırmalı analiz (kademe/okul türü/resmî-özel/ilçeler arası)
- Güvenli Supabase key rotation (kullanıcı açıkça isterse)
