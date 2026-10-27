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
- /admin/risk-map/tracking: RAM Gönderim Takibi (Haziran 2026) — okul evreni `schools`,
  submission durumu `school_submissions`'tan türetilir (hiç göndermeyen okul da listelenir).
  Filtreler: Eğitim Yılı + İlçe + Kademe + Okul Türü (daralan) + Yönetim Türü + Gönderim Durumu
  (all/submitted/not_submitted, takip filtresi — status workflow'dan bağımsız). Okul başına en
  yüksek version_no seçilir. 4 kart: Toplam/Gönderen/Göndermeyen/Gönderim Oranı. Backend:
  GET /api/admin/risk-map/tracking. Canlı öğrenci tabloları okunmaz, PII dönmez.

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

## RAM Çalışmaları (güncel)
- Aşama 1 Çalışma Ekle: TAMAM (POST /api/ram/activities, GET /api/ram/districts).
- Aşama 2 Çalışma Kayıtları: TAMAM (Haziran 2026). GET /api/ram/activities;
  _require_ram_ready ile korumalı, sorgu daima ram_id=acc["ram_id"] ile sınırlı.
  Filtre: district_id, target_type, date_from/date_to (ters aralıkta 400).
  Sıralama activity_date DESC, created_at DESC. total_participants response'ta hesaplanır.
  Frontend RamActivities.jsx sekmeli (Ekle/Kayıtlar), filtreler + özet + boş durum.
- Aşama 3 Düzenleme + Silme: TAMAM (Haziran 2026). PUT /api/ram/activities/{id} ve
  DELETE /api/ram/activities/{id}; her ikisi de _require_ram_ready + sahiplik (id AND
  ram_id) kontrolü, başka RAM kaydına güvenli 404. POST/PUT ortak validasyon helper'ı
  (_validate_ram_activity_payload). Frontend: düzenleme modalı + silme onay modalı,
  başarı sonrası mevcut filtreler korunarak liste yeniden çekilir.
- Serbest metin standardizasyonu: TAMAM (Haziran 2026). title ve activity_type için
  Türkçe-duyarlı Başlık Biçimi normalizasyonu (_normalize_title_field + _tr_lower/_tr_upper).
  institution_name/note dokunulmaz. Yalnız yeni/düzenlenen kayıtlar; toplu güncelleme yok.
- Aşama 4 İstatistikler: TAMAM (Haziran 2026). GET /api/ram/activities/statistics;
  _require_ram_ready + ram_id izolasyonu, tarih filtresi (date_from/date_to, ters aralıkta 400).
  Backend aggregate: summary, target_types (4'ü de), monthly (yıl+ay), titles, activity_types,
  districts (ad çözümlü), institutions (exact). Frontend İstatistikler sekmesi: 5 özet kartı,
  hedef türü barları, aylık barlar, 4 tablo. Yıl Sonu Raporu hâlâ "Yakında".
- Aşama 5 Raporlar / PDF: TAMAM (Haziran 2026). GET /api/ram/activities/report
  (detailed=true|false); _require_ram_ready + ram_id izolasyonu, tarih filtresi (ters aralıkta 400).
  İstatistik matematiği ortak _compute_ram_statistics helper'ına refactor edildi — /statistics ve
  /report aynı kaynağı kullanır (davranış değişmedi). RAM adı token bağlamından (rams tablosu).
  Frontend: "Raporlar / PDF" sekmesi (tarih + Özet/Ayrıntılı seçimi), jspdf+autotable+Roboto TTF
  ile client-side PDF (src/lib/ramReportPdf.js). Boş veride PDF üretilmez, uyarı gösterilir.
- Sonraki: Genel Admin RAM aktif/pasif & şifre sıfırlama (P2).

## RAM Risk Haritası Entegrasyonu (dinamik görünürlük)
- Aşama 1 (TAMAM): 015_ram_districts.sql — 15 ilçe → 6 RAM eşlemesi (UNIQUE(district_id), RLS on).
- Aşama 2 (TAMAM): backend visibility temeli — _ram_responsible_district_ids,
  _ram_scoped_school_ids, _aggregate_snapshots'a geriye uyumlu district_ids (boş liste = 0 veri).
- Aşama 3 (TAMAM, Haziran 2026): RAM submission list/detail.
  * Backend: GET /api/ram/risk-map/districts (yalnız sorumlu ilçeler),
    GET /api/ram/risk-map/submissions (token→ram_id→scoped school_ids; kapsam dışı district_id genişletmez),
    GET /api/ram/risk-map/submissions/{id} (sahiplik gate: submission ilçesi sorumlu ilçelerde değilse/yoksa aynı 404).
    Ortak _build_submission_detail helper'ı admin + RAM detay için tek doğruluk kaynağı.
  * Frontend: RamModules'a "Risk Haritası" kartı; /ram/risk-map (liste) + /ram/risk-map/submissions/:id (detay).
  * Genel Admin ve peer-comparison davranışı korundu.
- Sonraki: Aşama 5 "RAM'a Gönder" son kontrol.
- Aşama 4 RAM aggregate Risk Haritası (TAMAM, Haziran 2026):
  * Backend: GET /api/ram/risk-map/aggregate (scope=token→ram_id→responsible districts;
    district_id query sorumlu kümeyle KESİŞTİRİLİR, kapsam dışı → 0; boş scope → 0 veri, asla tüm Adana),
    GET /api/ram/risk-map/refs (RAM-gated: academic_years + education_levels).
    Ortak _aggregate_snapshots kullanıldı — yeni matematik yok, latest-version dedup korunuyor.
  * Frontend: RamAggregateRiskMap.jsx (/ram/risk-map/aggregate); RamRiskMap header'a "RAM Geneli Risk Haritası" butonu.
    Filtreler: Eğitim Yılı, İlçe (yalnız sorumlu), Kademe. 5 özet kartı + 8 alan + 36 madde (admin UX yeniden kullanıldı).
  * Genel Admin aggregate ve peer-comparison regresyonu korundu.

- RİBA Frontend – Yeni Uygulama Formu (TAMAM, Haziran 2026):
  * SchoolRibaNew.jsx placeholder → gerçek "Yeni RİBA Uygulaması" formu. Backend/schema değişmedi.
  * Veri kaynağı: GET /api/school/students (academic_year adı + classes[{id,level,branch}]) — yeni endpoint yok.
  * Form: aktif eğitim yılı (salt okunur), uygulama adı "{yıl} RİBA Uygulaması" (salt okunur), çoklu sınıf seçimi (kart/checkbox, ≥1 zorunlu), toplam öğretmen sayısı (int ≥0, zorunlu).
  * Submit → POST /api/school/riba/applications body YALNIZCA {teacher_count, school_class_ids}. Çift gönderim engeli + "Oluşturuluyor…".
  * Hatalar: 409 "zaten" → "Bu eğitim öğretim yılı için zaten bir RİBA uygulaması bulunuyor."; 409 aktif yıl yok → RAM mesajı; diğer → genel mesaj (ham detail gösterilmez).
  * Başarı → /school/riba'ya dön + flash "RİBA uygulaması taslak olarak oluşturuldu." (SchoolRiba.jsx flash state eklendi).
  * Test: syntax/build kontrolü (webpack compiled successfully). Gerçek DB testi kullanıcı Preview'da yapacak.
  * Sonraki: application listeleme, activate/başlat, formlar/QR, katılım, sonuçlar.

- RİBA Sonuçlar Paneli — Backend + Frontend (Haziran 2026):
  * `GET /api/school/riba/applications/{id}/results` (read-only, yalnız closed/finalized; snapshot-only; ASP/avg/rank yeniden hesaplanmaz; `_riba_meb_code_sort_key` doğal sıralama; snapshot bütünlük kontrolü + kontrollü 500; 409 draft/active).
  * Frontend `SchoolRibaManage.jsx`: closed/finalized'da "Sonuçlar" bölümü → Sınıf Sonuçları | Okul Sonucu sekmeleri; ResultsPanel/HowCalculated/CountChip bileşenleri.
  * Sınıf: tek sınıfta ad, çoklu sınıfta selector; response counts (Okul Öncesi'nde Öğrenci kartı gizli — education_level_id!==1); MEB Kodu|Rehberlik İhtiyacı|ASP; ASP null → "Hesaplama için yeterli veri bulunmamaktadır."
  * Okul: Sıra(snapshot rank)|MEB Kodu|İhtiyaç|Ortalama ASP; null → aynı metin; rank/average frontend'de hesaplanmaz; ilk3/vurgu yok.
  * "Nasıl hesaplandı?" collapsible (sabit metin, teknik sayılar yok). Responsive (yatay scroll). E2E: kapalı Okul Öncesi verisiyle (1 sınıf 4/A, 0/1/0, 27 target ASP null, 27 school avg/rank null) doğrulandı; DB write yok.

- RİBA Özel Hedef Finalize — Backend + Frontend (Haziran 2026):
  * `POST /api/school/riba/applications/{id}/finalize` (yalnız closed; iki farklı target zorunlu 422; kademe + snapshot-set doğrulaması target_id ile; ASP/rank NULL engel değil; tek atomik koşullu update status=finalized+finalized_at; 409 yarış). Results API `application.finalized_at` + `special_targets[]` döndürüyor + finalized integrity guard.
  * Frontend `SchoolRibaManage.jsx` ResultsPanel: closed'da "Okul Özel Hedefleri" seçim kartı (2 select, duplicate engeli, preselect yok, ASP/rank yardımcı bilgi—sıralama değişmez), "Özel Hedefleri Kaydet ve Sonuçlandır" → confirmation modal → POST finalize (loading "Sonuçlandırılıyor…", çift tık guard). Başarıda flash + reload. finalized'da read-only 2 hedef + finalized_at; düzenle butonu yok.

## Backlog / Sonraki olası görevler
- RLS policy tasarımı (tüm tablolarda RLS ON, policy=0)
- Submission status workflow (under_review / revision_requested / approved) UI+backend
- Karşılaştırmalı analiz (kademe/okul türü/resmî-özel/ilçeler arası)
- Güvenli Supabase key rotation (kullanıcı açıkça isterse)

## 2026-06 — RAM RİBA read-only backend
- GET /api/ram/riba/submissions (RAM-scoped list; filters academic_year_id, education_level_id, district_id, q; page/page_size<=100)
- GET /api/ram/riba/submissions/{id} (metadata + all targets; out-of-scope = 404)
- Extra rams.is_active check (403) only for these two endpoints via _require_ram_riba_access.
- Next: RAM RİBA frontend list/detail, İlçe aggregations, PDF export, "Nasıl hesaplandı?" panel.

## 2026-06 — RAM RİBA frontend (salt-okunur)
- /ram/riba (RamRiba.jsx): list + filters (year/district/level via /ram/risk-map/refs & /districts), 400ms debounced search, server pagination.
- /ram/riba/submissions/:id (RamRibaSubmissionDetail.jsx): metadata, 2 special targets, all targets; NULL -> "Hesaplanamadı".
- lib/ramRibaApi.js: shared session/axios helper (403 redirect only for password_change_required).
- RamModules card added. Data note: existing submission 9a1c9a2f… has all 27 targets NULL ASP/rank (source data).

## 2026-06 — RAM RİBA özel hedef seçilme sıklığı (backend)
- GET /api/ram/riba/statistics/special-targets?academic_year_id&education_level_id[&district_id]
- Latest submission per school (submitted_at DESC, id DESC), group by target_id, competition rank, 1-decimal %; unauthorized district -> 403.
- Next: frontend for this stats endpoint; İlçe Ortalama ASP Analizi (not started).

## 2026-06 — RAM RİBA sekme yapısı + Özel Hedef İstatistikleri (frontend)
- components/RamRibaTabs.jsx: Gelen Gönderimler (/ram/riba), Özel Hedef İstatistikleri (/ram/riba/special-targets), İlçe Ortalama ASP Analizi (pasif, Yakında).
- pages/RamRibaSpecialTargets.jsx: year (auto active) + level required, optional district; summary cards, rank table, % bar.
- RamRiba.jsx only got tabs + title "RİBA"; RamModules card renamed "RİBA". Detail page untouched.

## 2026-06 — Özel Hedef İstatistikleri: "Tüm Kademeler"
- RamRibaSpecialTargets.jsx: "Tüm Kademeler" option -> one request per level (refs), separate sections, frontend sum summary, per-level error + "eksik veri" warning. Özel Eğitim excluded from all-view by name (user choice). Stale results cleared on filter change.

## 2026-06 — RAM RİBA İlçe Ortalama ASP Analizi (backend v1.0)
- GET /api/ram/riba/statistics/average-asp?academic_year_id(UUID)&education_level_id(int)[&district_id]
- Latest submission per school; NULL ASP excluded; direct school mean (not mean of district means); HALF_UP 2dp; RANK.EQ on rounded value; NULL last; ties/NULLs by meb_code; fixed `note` (not official MEB calc).
- Next: frontend for the passive "İlçe Ortalama ASP Analizi" tab.

## 2026-06 — İlçe Ortalama ASP Analizi sekmesi etkin (basit ekran)
- pages/RamRibaAverageAsp.jsx at /ram/riba/average-asp; tab enabled in RamRibaTabs. Single level, year auto-active, optional district; NULL -> "Hesaplanamadı"; shows backend `note`.
- 2026-06: ASP Analizi 'Tüm Kademeler' (per-level requests, Özel Eğitim excluded, summed cards labelled as level-based totals).
- 2026-06: Özel Hedef İstatistikleri: pure-Tailwind horizontal bar chart (top 10, count desc / meb_code asc, 0-100 scale, title + filter context), per level in Tüm Kademeler.
- 2026-06: Özel Hedef İstatistikleri PDF İndir (lib/ramRibaSpecialTargetsPdf.js, jsPDF+autotable+Roboto, vector bar chart, per-level pages in Tüm Kademeler). RAM name omitted (no endpoint) — pending small backend task.
- 2026-06: ram_name added to /ram/riba/statistics/special-targets & /average-asp (via _require_ram_riba_access rams query); Özel Hedef PDF header shows 'RAM: …'.

## 2026-06 — RAM ASP gölge doğrulama (DB'ye yazılmadı)
- Root cause of 27 NULL ASP in Çukurova submission: 1 parent response, 0 teacher → teacher stddev 0 → standard score NULL → ASP NULL (correct behavior).
- Shadow test (/tmp/riba_shadow): 6 synthetic schools (Okul Öncesi + Ortaokul), real riba_calc/_riba_compute_close_plan/RAM endpoint vs independent Excel formulas (evaluated with `formulas` lib in /tmp/fx): class 264, school 198, RAM 198 comparisons, 0 mismatches.
- 2026-06: ASP Analizi yatay çubuk grafik (top 10 by backend rank, meb_code tiebreak, fixed 0–100 scale with 50 reference line, per level in Tüm Kademeler, empty-ASP message).
- 2026-06: ASP Analizi PDF İndir (lib/ramRibaAverageAspPdf.js, standalone; RAM adı, filtre bağlamı, 0–100 grafik + 50 çizgisi, tablo NULL='Hesaplanamadı', backend note).


## 2026-06 — BEP Türkçe 1–8. sınıf staging aktarımı (TAMAMLANDI)
- Kaynak: PDRPUSULA_Turkce_1_8_Ayristirma_Duzeltilmis_Havuz.csv — 3.004 kayıt, SHA-256 13e5fb18bd6062b06f1e67818c50b7dd32747144d14ed98eb0f6804063d2c000.
- 2–8. sınıf SQL'leri (generate_tr_grade_seed_existing_version.py, --existing-version) ile üretildi: 2.719 kayıt, 0 hata. Dosyalar: /app/tools/bep_curriculum_import/output/tr_grades2_8_existing_version/ (+SHA256SUMS.txt). Kullanıcı Supabase SQL Editor'da sırayla çalıştırdı.
- Salt-okunur doğrulama: 3.004 ham kayıt, 56 tema, 56 kaynak belge, 1.047 tema kazanımı, 3.004 bileşen; 8 aktarım partisi (error_count=0); 31 bütünlük kontrolü sorunsuz; ham değerler güncel CSV ile birebir aynı.
- Durum: TYMM-2024-TR sürümü ve 8 sınıfın tamamı `draft`. Kanonik kayıt / inceleme kararı = 0; tüm kazanım ve bileşenler `unmapped`. Yayın, eşleştirme, migration yapılmadı.

### Sonraki değerlendirme konuları (açık)
- 184 `warning` ham satırı (sınıf 1: 16, 2: 55, 3: 20, 5: 75, 7: 18; 4, 6, 8: 0). Uyarı türleri: temalar arası farklı kazanım metni, görünmez karakter/fazla boşluk. Karar bekliyor.
- `curriculum_grades.import_batch_id` 8 sınıfın tamamında NULL (bağ ham satırlar üzerinden). Yayın öncesi doldurulup doldurulmayacağı kararlaştırılacak.
- Bekleyen sonraki adımlar (başlatılmadı): kanonik kaynak PDF kanıtları + eşleştirme/yayın (Aşama 2), 033_bep_records.sql, BEP RPC fonksiyonları, öğretmen arayüzü.

## BEP MODÜLÜ DURUMU: ASKIYA ALINDI (2026-06)
- Yeni bir karar alınana kadar BEP'te yeni geliştirme, migration veya veri aktarımı yapılmaz.
- Mevcut yapı aynen korunur: 032 migration, 13 curriculum_* tablosu ve Supabase'deki TYMM-2024-TR verisi (`draft`), /app/tools/bep_curriculum_import araçları ve çıktıları. Silme, geri alma veya yapı değişikliği yapılmaz.
- BEKLEMEDE: Migration 033 (bep_records), kazanım havuzu eşleştirme/yayın aktarımı (Aşama 2), BEP RPC fonksiyonları, öğretmen arayüzü, 184 uyarı satırı ve import_batch_id kararları.

## GÜNCEL GELİŞTİRME ÖNCELİĞİ (2026-06)
- P0: Öğrenci Yönetimi bölümünün Okul Risk Haritası modülünden ayrılması — UYGULANDI (yalnızca frontend, 2026-06).
  * Yeni: pages/StudentManagementHome.jsx (/school/student-management; okul adı+ilçe via GET /school/panel; Sınıf Tanımları + Öğrenciler kartları).
  * App.js: /school/student-management, /classes, /students rotaları; eski /school/classes ve /school/students → Navigate ile yeni adreslere.
  * Modules.jsx: okul görünümünde "Öğrenci Yönetimi" kartı ilk sırada; risk kartı başlığı okul görünümünde "Okul Risk Haritası" (admin görünümünde "Risk Haritası" olarak kaldı).
  * SchoolClasses/SchoolStudents: geri düğmesi → /school/student-management, metin "Öğrenci Yönetimine Dön".
  * SchoolHome.jsx: sınıf/öğrenci kartları kaldırıldı, başlık "Risk Haritası", 4 risk kartı korundu.
  * SchoolRibaNew.jsx: sınıf yok mesajına yeni Sınıf Tanımları bağlantısı.
  * Backend, API, tablolar, RLS değişmedi. Test: mock oturum + mock API ile gezinme testleri; gerçek okul hesabıyla uçtan uca test BEKLİYOR (test hesabı yok).

## 2026-06 — DNA Modülü / Migration 033 (HAZIR, UYGULANMADI)
- Dosya: /app/supabase/migrations/033_dna_foundation.sql (sha256 d3b578cd…37b9). Kaynak: kullanıcı taslağı v5 (sha256 dcaa8642…).
- 12 dna_* tablosu, tetikleyiciler, RLS (politika yok), service_role yalnızca SELECT; yazma yalnızca 6 SECURITY DEFINER RPC ile: dna_create_application, dna_activate_application, dna_close_application, dna_submit_response, dna_invalidate_response, dna_submit_to_ram. Hata kodları DN403/404/409/422.
- İzole PostgreSQL 15 (repo 001–032 + 033): 94/94 test geçti; PG kaldırıldı. Test betiği: /root/dnatest/tests.py.
- v5 canlıda çalışmazdı: districts.id smallint (v5 uuid).
- Bekleyen: kullanıcı onayı ile canlıya uygulama; 034 katalog seed; backend/arayüz (başlatılmadı). 033 artık DNA'nın; BEP kayıt şeması sonraki boş numarayı alacak.
- 2026-06: 033 kullanıcı tarafından canlıya UYGULANDI (12 tablo doğrulandı).
- 2026-06: 034_dna_catalog_seed.sql HAZIR, UYGULANMADI. Kaynak k.json (sha256 888b85ed…). 1 katalog, 7 boyut, 51 madde; 52. madde open_text_prompt. Pasif ekle → doğrula (sayı, aralık, md5 parmak izi) → aktifleştir. İzole PG15'te doğrulandı (tekrar çalıştırma ve metin değişikliği reddediliyor). Üretici: /root/dnatest/gen034.py.
- 2026-06: 034 kullanıcı tarafından canlıya UYGULANDI (katalog aktif, 7 boyut, 51 madde).

## 2026-06 — DNA Aşama 1: Okul Paneli (TAMAMLANDI)
- Backend (server.py sonu): GET /api/school/dna/applications (token→school_id ile süzülür; ad, durum, yıl, sınıflar), POST /api/school/dna/applications {name, school_class_ids} → RPC dna_create_application (p_school_id/p_account_id yalnızca oturumdan). DN403/409/422 Türkçe mesajlara eşlenir.
- Frontend: pages/SchoolDna.jsx (/school/dna, liste: Taslak/Aktif/Kapalı), pages/SchoolDnaNew.jsx (/school/dna/new, ad + sınıf seçimi; sınıflar GET /school/students'tan), Modules.jsx'e okul için "DNA" kartı (RİBA'dan sonra), App.js rotaları.
- Test (canlıya kayıt YAZILMADI): sahte istemcili backend testleri 22/22 (/root/dnatest/test_dna_api.py); canlı RPC yazmasız çağrı DN403, anon RPC/tablo erişimi 42501; Playwright sahte oturum + sahte API ile ekran akışı geçti. Gerçek okul hesabıyla uçtan uca deneme yapılmadı.
- Sonraki (başlatılmadı): etkinleştirme + bağlantı/QR, herkese açık form, kapatma, geçersiz kılma, sonuçlar/PDF, RAM gönderimi.

## 2026-06 — DNA Aşama 2: Uygulamayı Başlat + Paylaşım Bağlantısı/QR (TAMAMLANDI)
- backend/dna_link_token.py (yeni): HMAC-SHA256 deterministik token, önek "pdrpusula:dna-link:v1:{app_id}:{link_version}", gizli anahtar RIBA_LINK_SECRET (domain ayrımıyla). Ham token saklanmaz; yalnızca SHA-256 hash.
- server.py: POST /api/school/dna/applications/{id}/activate → RPC dna_activate_application (okul/hesap oturumdan; hash backend'de üretilir). GET /api/school/dna/applications/{id}/share → yalnızca okulun kendi AKTİF uygulaması; token yeniden üretilir ve kayıtlı hash ile karşılaştırılır.
- Frontend: components/DnaActivateButton.jsx (onaylı başlatma), components/DnaShareCard.jsx (bağlantı, QR, kopyala, cihaz paylaşımı), SchoolDna.jsx satırlara bağlandı. Bağlantı: {origin}/dna/respond/{token}.
- Test: sahte istemci 25/25 (/root/dnatest/test_dna_stage2.py) + Aşama 1 22/22; Playwright sahte oturumla başlatma/QR/kopyalama/yenileme geçti; canlı uç noktalar oturumsuz 401. Canlı "deneme" taslağı draft, erişim bağlantısı yok (salt-okunur kontrol).
- Bilinen eksik: /dna/respond/:token öğrenci formu henüz yok (Aşama 3) — bağlantı şu an boş sayfa açar.

## 2026-06 — DNA Aşama 3: Herkese açık öğrenci formu (TAMAMLANDI)
- server.py: GET /api/dna/respond/{token} (okul adı, yıl, uygulamanın sınıfları, 51 madde, 52. açık uçlu soru; kimlik/hash yok), POST /api/dna/respond/{token} → RPC dna_submit_response (yalnızca URL token'ının hash'i). Girdi doğrulama (51 cevap, 0/1/2 tam sayı, ad/soyad ≤60, numara ≤20, açık metin ≤2000), IP+bağlantı başına 10 dk'da 30 deneme sınırı (bellekte), tekrar yanıt 409, kapalı/geçersiz bağlantı 404. Loglarda kişisel veri yok.
- Frontend: pages/DnaRespond.jsx (/dna/respond/:token), components/DnaQuestion.jsx (Evet/Bazen/Hayır). Kısa kişisel veri bilgilendirmesi (onay kutusu YOK — kullanıcı tercihi), ilerleme sayacı, eksik soruların işaretlenmesi, teşekkür ekranı.
- Test (canlıya yanıt yazılmadı): sahte istemci 34/34 (/root/dnatest/test_dna_stage3.py) + önceki 25/25, 22/22; Playwright sahte API ile form akışı geçti; canlı bilinmeyen token GET 404.
- Bilinen sınır: gönderim sınırı bellekte tutulur (yeniden başlatmada sıfırlanır; birden çok sunucuda ortak değil).


## 2026-06 — DNA Aşama 4: Okul Yanıt Listesi + Tekil Yanıt (TAMAMLANDI, kullanıcı doğrulaması bekliyor)
- Şema/RLS/RPC DEĞİŞMEDİ: 033'teki service_role SELECT yetkisi yeterli; tüm sorgular backend'de oturumdaki school_id ile sınırlanır. Yalnızca okuma, hiçbir yazma/RPC yok.
- server.py: GET /api/school/dna/applications/{id}/responses (ad, soyad, okul no, sınıf, tarih, durum; açık uçlu metin/puan yok) ve GET /api/school/dna/applications/{id}/responses/{response_id} (7 boyuta göre gruplu 51 cevap, boyut puanı/maks, toplam puan /102, 52. açık uçlu soru+yanıt, geçersizse gerekçe). Başka okul/uygulama/biçimsiz kimlik → 404; Cache-Control: no-store; loglarda kişisel veri yok.
- Frontend: pages/SchoolDnaResponses.jsx (/school/dna/:id/responses, liste + detay paneli, boş durum), components/DnaResponseList.jsx, DnaResponseDetail.jsx; SchoolDna.jsx'te taslak olmayan uygulamalara "Yanıtları Görüntüle". Geçersiz yanıtlar "Geçersiz" etiketiyle listelenir (kullanıcı tercihi).
- Test: sahte DB + sahte oturum 33/33 (/root/dnatest/test_dna_stage4.py), regresyon 22/22, 25/25, 34/34; canlıda yalnızca limit=0 SELECT ve oturumsuz 401 kontrolü; Playwright sahte API ile liste/detay/boş durum geçti.
- Sıradaki: Aşama 5 (uygulama kapatma + geçersiz kılma), raporlar/PDF, RAM gönderimi.

## 2026-06 — DNA Yanıt Kaydetme Hatası Teşhisi (AÇIK — kullanıcıdan canlı SQL sonucu bekleniyor)
- Belirti: canlı deneme uygulamasında gönderim 500; Supabase RPC 400, Postgres kodu 42703 (tanımsız sütun). Canlıda yanıt kaydı YOK (salt okuma: dna_responses=0, dna_answers=0).
- Elenenler: RPC imzası birebir uyumlu (OpenAPI), kullanılan 52 sütun canlıda mevcut; 001–034 izole PG15 + yerel PostgREST v12 + supabase-py 2.31 ile aynı gönderim BAŞARILI. Sonuç: canlıdaki dna_* fonksiyon/tetikleyici gövdesi depodaki 033'ten farklı.
- Kullanıcıya verilen salt okuma SQL'i: SELECT p.proname, md5(p.prosrc) ... LIKE 'dna\_%'. Beklenen md5'ler: dna_submit_response=db327edbd2e3d11b8dd530451bea820d, dna_guard_response_insert=7877891387944840fe208dd0e1ec70dd, dna_guard_answer_insert=62ba8a029cc6bd89478874094697d631, dna_check_response_complete=7c4770219b189eab22e4fb731223cf72, dna_guard_audit_insert=afb782781ffd17f5d8553f916cbe5fc4 (tam liste izole DB'den yeniden üretilebilir). Beklenen kullanıcı tetikleyici sayısı (dna_*): 36.
- Yapılan (onaylı): server.py'ye uvicorn.access log filtresi (_MaskDnaTokenFilter) — /api/dna/respond/<token> → /api/dna/respond/***. Regresyon 22/22, 25/25, 34/34, 33/33. Not: filtreden önceki eski log satırlarında token hâlâ duruyor.
