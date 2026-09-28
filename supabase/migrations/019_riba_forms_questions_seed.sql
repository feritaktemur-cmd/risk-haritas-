-- ============================================================
-- Migration 019: Official MEB RİBA Forms and Questions Seed
-- Kaynak:
--   - Resmî MEB RİBA form PDF'leri (11 form)
--   - Resmî MEB RİBA Sınıf Sonuç Çizelgeleri / "madde" sözlüğü
--
-- İçerik:
--   11 form
--   180 soru
--   360 A/B seçeneği -> kademe bazlı MEB M-kodu eşleşmesi
--
-- İlke:
--   Kullanıcıya gösterilen A/B metni resmî form PDF'sinden alınmıştır.
--   M-kod eşleşmesi resmî Sınıf Sonuç Çizelgesi "madde" sözlüğünden alınmıştır.
--   Mevcut kayıtlar overwrite edilmez.
-- ============================================================

BEGIN;

-- 1) Formlar
INSERT INTO public.riba_forms
    (education_level_id, participant_type, version, is_active)
VALUES
    (1, 'parent', 1, true),
    (1, 'teacher', 1, true),
    (2, 'parent', 1, true),
    (2, 'student', 1, true),
    (2, 'teacher', 1, true),
    (3, 'parent', 1, true),
    (3, 'student', 1, true),
    (3, 'teacher', 1, true),
    (4, 'parent', 1, true),
    (4, 'student', 1, true),
    (4, 'teacher', 1, true)
ON CONFLICT (education_level_id, participant_type, version) DO NOTHING;

-- 2) Sorular + A/B -> MEB hedef eşleşmeleri
WITH question_seed (
    education_level_id,
    participant_type,
    version,
    question_no,
    option_a_text,
    option_a_meb_code,
    option_b_text,
    option_b_meb_code
) AS (
    VALUES
    (1, 'parent', 1, 1, 'Arkadaşlarıyla iş birliği yaparak ve paylaşarak oynamayı öğrenme', 'M20', 'Sorunlarını nasıl çözebileceğini öğrenme (ör., çözüm yolları üretme, yardım isteme)', 'M11'),
    (1, 'parent', 1, 2, 'Tehlikeli olabilecek durumlarda (ör., bahçede koşma, yüksekten atlama, sivri cisimler kullanma) dikkatli davranmayı öğrenme', 'M12', 'İrade geliştirmeyle ilgili temel düzeyde beceriler kazanma (Ör., Bir oyuncak satın almak için para biriktirmek)', 'M24'),
    (1, 'parent', 1, 3, 'Öfkesini kontrol etmeyi öğrenme', 'M06', 'Sınıf kuralları hakkında bilgilenme', 'M29'),
    (1, 'parent', 1, 4, 'İncitici bir davranışla (kötü söz söyleme, alay etme, vurma vb.) karşılaştığında ne yapması gerektiğini öğrenme', 'M05', 'Kişisel özellikleriyle değerli bir birey olduğunu hissetme', 'M01'),
    (1, 'parent', 1, 5, 'Özgüven kazanma konusunda desteklenme (ör., kararlarını bağımsız verme, yalnızken bile kendini güvende hissetme)', 'M02', 'Başkaları hatırlatmadan sorumluluklarını yerine getirebilme becerisi kazanma (ör., oyuncaklarını toplama, tabağını masadan kaldırma)', 'M18'),
    (1, 'parent', 1, 6, 'Duygularını (ör., mutluluk, üzüntü, korku ve şaşkınlık) tanıma', 'M03', 'Blok, oyun hamuru gibi materyaller ile yaratıcılıklarını kullanarak kendini ifade etme', 'M38'),
    (1, 'parent', 1, 7, 'Rehber öğretmeni/psikolojik danışmanı tanıma ve ondan hangi konularda yardım alacaklarını öğrenme', 'M36', 'İletişim becerileri kazanma (ör., söz kesmeden dinlemek, soru sorma ve uyarıları dikkate alma)', 'M08'),
    (1, 'parent', 1, 8, 'Arkadaş edinme ve arkadaşlarıyla iyi geçinme (ör., kavga etmeden oyun oynama, oyuncaklarını paylaşma)', 'M07', 'Karar vermeyle ilgili temel düzeyde beceriler kazanma (ör., verilen seçenekler arasından uygun olanı seçme)', 'M09'),
    (1, 'parent', 1, 9, 'Zamanı planlamayı öğrenme (ör., uyuma, dinlenme, oyun oynama süresi)', 'M35', 'Mesleklerin toplumdaki önemini fark etme ve olumlu tutum geliştirme (Ör., itfaiyeci hayat kurtarmaktadır.)', 'M27'),
    (1, 'parent', 1, 10, 'İhtiyacı olduğunda doğru kişilerden yardım isteme (ör., incitici bir davranışla karşılaştığında öğretmeninden yardım isteme)', 'M39', 'Duygu ve düşüncelerini ifade etme', 'M04'),
    (1, 'parent', 1, 11, '“HAYIR!” diyebilmeyi öğrenme (ör., bir şey yapmak istemediğinde ya da tehlikeli durumlardan kaçınması gerektiğinde)', 'M10', 'Bireysel farklılıklara (karşı cins, özel gereksinimli birey ve göçmenler) saygılı davranmayı öğrenme', 'M22'),
    (1, 'parent', 1, 12, 'Sağlıklı yaşam, kişisel bakım ve hijyen konusunda bilgilenme (ör., sağlıklı beslenme, ellerini yıkama)', 'M13', 'İstismardan korunmayı öğrenme', 'M14'),
    (1, 'parent', 1, 13, 'Dikkatini odaklama ve sürdürme becerileri kazanma', 'M34', 'Tablet, televizyon ve telefonu kullanırken ailenin belirlediği içeriklere ve kullanım süresine uyma', 'M15'),
    (1, 'teacher', 1, 1, 'Arkadaşlarıyla iş birliği yaparak ve paylaşarak oynamayı öğrenme', 'M20', 'Problem çözme becerilerini öğrenme', 'M11'),
    (1, 'teacher', 1, 2, 'Okulda fiziksel güvenliklerini sağlayacak davranışlar kazanma', 'M12', 'İrade geliştirmeyle ilgili temel düzeyde beceriler kazanma (Ör., Bir oyuncak satın almak için para biriktirmek)', 'M24'),
    (1, 'teacher', 1, 3, 'Öfke kontrolüyle ilgili temel düzeyde beceriler kazanma', 'M06', 'Okul ve sınıf kuralları hakkında bilgilenme', 'M29'),
    (1, 'teacher', 1, 4, 'İncitici bir davranışla (kötü söz söyleme, alay etme, vurma vb.) karşılaştığında ne yapması gerektiğini öğrenme', 'M05', 'Kendilerine özgü özellikleriyle değerli bireyler olduklarını hissetme', 'M01'),
    (1, 'teacher', 1, 5, 'Özgüven kazanma konusunda desteklenme', 'M02', 'Başkaları hatırlatmadan sorumluluklarını yerine getirebilme becerisi kazanma (ör., oyuncaklarını toplama, tabağını masadan kaldırma)', 'M18'),
    (1, 'teacher', 1, 6, 'Duygularını (ör., mutluluk, üzüntü, korku ve şaşkınlık) tanıma', 'M03', 'Blok, oyun hamuru gibi materyaller ile yaratıcılıklarını kullanarak kendini ifade etme', 'M38'),
    (1, 'teacher', 1, 7, 'Rehber öğretmeni/psikolojik danışmanı tanıma ve ondan hangi konularda yardım alacaklarını öğrenme', 'M36', 'İletişim becerileri kazanma (ör., söz kesmeden dinlemek, soru sorma ve yönergeleri takip etme)', 'M08'),
    (1, 'teacher', 1, 8, 'Arkadaş edinme ve arkadaşlarıyla iyi geçinme', 'M07', 'Karar vermeyle ilgili temel düzeyde beceriler kazanma', 'M09'),
    (1, 'teacher', 1, 9, 'Zamanı planlamayı öğrenme', 'M35', 'Mesleklerin toplumdaki önemini fark etme ve olumlu tutum geliştirme', 'M27'),
    (1, 'teacher', 1, 10, 'Yardım arama becerilerini geliştirme (ör., nereden ve kimden yardım isteyeceğini bilme)', 'M39', 'Duygu ve düşüncelerini ifade etme', 'M04'),
    (1, 'teacher', 1, 11, 'İlişkilerinde kişisel sınırlarını koruma (ör., “HAYIR!” deme becerisi)', 'M10', 'Bireysel farklılıklara (ör., karşı cinsiyet, engelli öğrenci ve göçmenler) saygılı davranmayı öğrenme', 'M22'),
    (1, 'teacher', 1, 12, 'Sağlıklı yaşam, kişisel bakım ve hijyen konusunda bilgilenme', 'M13', 'İstismardan korunmayı öğrenme', 'M14'),
    (1, 'teacher', 1, 13, 'Dikkatini odaklama ve sürdürme becerileri kazanma', 'M34', 'Okuryazarlığa hazırlık çalışmalarında hazırbulunuşluklarını destekleme', 'M37'),
    (2, 'student', 1, 1, 'Çevremdeki insanların mesleklerini öğrenmek (ör., Hastanede doktor ve hemşireler çalışır.)', 'M19', 'Okul kurallarını öğrenmek', 'M28'),
    (2, 'student', 1, 2, 'Gelecekte başarılı olmak için kendime uygun hedefler belirlemek (ör., Başarılı bir sporcu olmak isteyen bir öğrenci her gün antrenman yapar.)', 'M27', 'Severek yapabileceğim şeyleri öğrenmek (ör., Bir öğrenci sesi güzel olsun ya da olmasın şarkı söylemeyi sevebilir. Bu öğrencinin müziğe ilgisi vardır denir.)', 'M21'),
    (2, 'student', 1, 3, 'Bilgisayar, cep telefonu, tablet veya televizyonu kullanırken yaşıma uygun içerik seçmek ve kullanım süresini belirlemek', 'M12', 'Başkaları hatırlatmadan sorumluluklarımı yerine getirmek (ör., ödevlerimi tamamlamak; odamı, eşyalarımı düzenlemek, temiz tutmak vb.)', 'M02'),
    (2, 'student', 1, 4, 'Okulda, evde ve arkadaşlık ilişkilerimde doğru kararlar almak', 'M11', 'Bedenimi korumayı öğrenmek (ör., Başkalarının bedenime izinsiz dokunmasına izin vermemek)', 'M36'),
    (2, 'student', 1, 5, 'Sorunlarımı nasıl çözebileceğimi öğrenmek', 'M13', 'Rehber öğretmen/psikolojik danışmandan hangi konularda yardım alabileceğimi öğrenmek', 'M35'),
    (2, 'student', 1, 6, 'Yeni arkadaşlar edinmek ve arkadaşlarımla iyi geçinmeyi öğrenmek', 'M08', 'Oyun oynarken, ödev yaparken arkadaşlarımla yardımlaşmayı öğrenmek', 'M16'),
    (2, 'student', 1, 7, 'Tehlikeli olabilecek durumlarda dikkatli davranmayı öğrenmek (ör., Bu tehlikeli durumlar merdivenden dikkatsizce inip çıkmak, koridorda koşmak olabilir)', 'M15', 'Ders çalıştığım sırada silgiyle oynama, resim çizme gibi dikkatimi dağıtan davranışlardan uzak durmayı öğrenmek', 'M32'),
    (2, 'student', 1, 8, 'Ders çalışma ortamımı (odamı, masamı) nasıl düzenleyeceğimi bilmek', 'M29', 'Hangi ortaokullara gidebileceğimi öğrenmek', 'M31'),
    (2, 'student', 1, 9, 'Okula her gün mutlu bir şekilde gelme isteğimi artırmak', 'M26', 'Yaşadığım duyguları tanımak (ör., sevdiğim oyuncağı kaybettiğimde üzülmek, lunaparka gidince mutlu olmak)', 'M04'),
    (2, 'student', 1, 10, 'Duygularımı ve isteklerimi saygılı bir şekilde karşımdakine iletmek', 'M05', 'Zorbalıkla karşılaştığımda (ör., kötü söz söyleme, vurma) ne yapmam gerektiğini öğrenmek', 'M06'),
    (2, 'student', 1, 11, 'Bir çocuk olarak hak ve sorumluluklarımı öğrenmek', 'M01', 'Kolay öğrendiğim, başkalarından daha iyi yapabildiğim şeyleri öğrenmek (Bir öğrenci zor matematik sorularını hızlı ve doğru çözüyorsa matematiğe yeteneği var demektir. Çok hızlı koşuyorsa, spora yeteneği vardır.)', 'M22'),
    (2, 'student', 1, 12, 'Okuldaki kurslar, kulüpler (ör., spor, satranç, tiyatro) ve yarışmalar gibi etkinlikler hakkında bilgilenmek', 'M33', 'Nasıl ders çalışmam gerektiğini öğrenmek', 'M24'),
    (2, 'student', 1, 13, 'Başkalarının ne hissettiklerini ve ne düşündüklerini anlamak', 'M09', 'Derslerde zorlandığımda bile başarılı olacağıma inanmak', 'M25'),
    (2, 'student', 1, 14, '“HAYIR!” diyebilmeyi öğrenmek (ör., bir şey yapmak istemediğimde ya da tehlikeli durumlardan kaçınmam gerektiğinde)', 'M10', 'Bir mesleğe sahip olmanın önemini anlamak (ör., Bir mesleğim olursa para kazanırım.)', 'M18'),
    (2, 'student', 1, 15, 'Ders çalışmak ve oyun oynamak için zamanı planlamayı öğrenmek', 'M30', 'Zorlandığım konularda doğru kişilerden yardım istemek (ör., zorbalığa uğradığımda bir yetişkinden yardım istemek; dersi anlamadığımda öğretmenden yardım istemek)', 'M45'),
    (2, 'parent', 1, 1, 'Özgüvenini geliştirme', 'M42', 'Sağlıklı yaşam becerilerini (spor yapmak, sağlıklı beslenmek gibi) kazanma', 'M44'),
    (2, 'parent', 1, 2, 'Başarılı olmak için hedefler belirleme', 'M27', 'İlgilerini (kodlama, spor, resim, müzik gibi) keşfetme', 'M21'),
    (2, 'parent', 1, 3, 'Hem ilişkilerini hem de haklarını koruyacak şekilde çatışmalarını çözmeyi öğrenme', 'M40', 'Sorumluluklarının (ör., ödevlerini tamamlama, odasını, eşyalarını düzenleme ve temiz tutma) bilincinde olma', 'M02'),
    (2, 'parent', 1, 4, 'Rehber öğretmen/psikolojik danışmandan hangi konularda yardım alabileceğini öğrenme', 'M35', 'Aile üyeleriyle iletişimini güçlendirme', 'M38'),
    (2, 'parent', 1, 5, 'Arkadaş edinme ve arkadaşlık ilişkilerini sürdürme', 'M08', 'Okula devam etme isteğini arttırma', 'M26'),
    (2, 'parent', 1, 6, 'Tehlikeli olabilecek durumlarda (merdivenden inip çıkarken ya da koridorda koşma, servis kurallarına uyma gibi) dikkatli davranma', 'M15', 'Ders çalıştığı sırada silgiyle oynama, resim çizme gibi dikkatini dağıtan davranışlardan uzak durmayı öğrenme', 'M32'),
    (2, 'parent', 1, 7, 'Ders çalışma ortamını (odasını, masasını) nasıl düzenleyeceğini öğrenme', 'M29', 'Ortaokullar hakkında bilgi edinme', 'M31'),
    (2, 'parent', 1, 8, 'Duygularını ve isteklerini saygılı bir şekilde ifade etme', 'M05', 'Zorbalıkla karşılaştığında (ör., kötü söz söyleme, vurma) ne yapması gerektiğini bilme', 'M06'),
    (2, 'parent', 1, 9, 'Bilgisayar, cep telefonu, tablet veya televizyonu kullanırken uygun içerik seçme ve kullanma süresini belirleme', 'M12', 'Yeteneklerini (neleri iyi yapabildiğini) tanıma', 'M22'),
    (2, 'parent', 1, 10, 'Okuldaki kulüpler (spor, satranç, tiyatro vb.) ve yarışmalar gibi etkinlikler hakkında bilgilenme', 'M33', 'Verimli ders çalışmayı öğrenme', 'M24'),
    (2, 'parent', 1, 11, 'İstismardan korunmayı öğrenme', 'M36', 'Derslerde zorlandığında bile çalışarak başarılı olacağına inanma', 'M25'),
    (2, 'parent', 1, 12, 'Kendini korumak için “HAYIR” diyebilmeyi öğrenme', 'M10', 'Meslek edinmenin önemini anlama', 'M18'),
    (2, 'parent', 1, 13, 'Ders çalışmak ve oyun oynamak için zamanını planlama', 'M30', 'Zorlandığı konularda doğru kişilerden yardım isteme (ör., zorbalığa uğradığında bir yetişkinden yardım isteme; dersi anlamadığında öğretmeninden yardım isteme)', 'M45'),
    (2, 'teacher', 1, 1, 'Özgüvenlerini geliştirme', 'M42', 'Okul kurallarını öğrenme', 'M28'),
    (2, 'teacher', 1, 2, 'Akademik hedefler belirleme', 'M27', 'İlgilerini (kodlama, spor, resim, müzik gibi) keşfetme', 'M21'),
    (2, 'teacher', 1, 3, 'Çatışma çözme becerilerini geliştirme', 'M07', 'Sorumluluklarının (ör., ödevlerini tamamlaması ve materyalleri unutmaması) bilincinde olma', 'M02'),
    (2, 'teacher', 1, 4, 'Karar alma becerilerini geliştirme', 'M11', 'Davranışlarının sorumluluğunu alma', 'M14'),
    (2, 'teacher', 1, 5, 'Sorun çözme becerilerini öğrenme', 'M13', 'Rehberlik ve psikolojik danışma servisinden hangi konularda yardım alabileceklerini öğrenme', 'M35'),
    (2, 'teacher', 1, 6, 'Arkadaş edinme ve arkadaşlık ilişkilerini sürdürme', 'M08', 'İş birliği kurma becerilerini güçlendirme (ör., grup çalışmaları ve grup oyunlarında birlikte hareket edebilme)', 'M16'),
    (2, 'teacher', 1, 7, 'Üst öğrenim kurumları hakkında bilgi edinme', 'M31', 'Bireysel farklılıklara saygı göstermeyi öğrenme', 'M41'),
    (2, 'teacher', 1, 8, 'Okulda fiziksel güvenliklerini sağlayacak davranışlar kazanma', 'M15', 'Dikkat geliştirme becerileri kazanma', 'M32'),
    (2, 'teacher', 1, 9, 'Okula devam motivasyonlarını artırma', 'M26', 'Duygularını (ör., mutluluk, üzüntü, korku ve şaşkınlık) tanıma', 'M04'),
    (2, 'teacher', 1, 10, 'Okul dışı etkinlikler (eğitsel, kültürel, sosyal ve sportif faaliyetler) hakkında bilgilenme', 'M34', 'Teknoloji bağımlılığına karşı koruyucu temel beceriler edinme', 'M12'),
    (2, 'teacher', 1, 11, 'Duygularını ve isteklerini saygılı bir şekilde ifade etme', 'M05', 'Zorbalıkla karşılaştığında (ör., kötü söz söyleme, vurma) ne yapmaları gerektiğini bilme', 'M06'),
    (2, 'teacher', 1, 12, 'Çocuk hakları ve sorumluluklarını öğrenme', 'M01', 'Yeteneklerini (neleri iyi yapabildiklerini) tanıma', 'M22'),
    (2, 'teacher', 1, 13, 'Derslerde zorlansa bile başarılı olacağına inanma', 'M25', 'Verimli ders çalışma tekniklerini öğrenme', 'M24'),
    (2, 'teacher', 1, 14, 'Sağlıklı yaşam becerilerini (spor yapmak, sağlıklı beslenmek gibi) kazanma', 'M44', 'İstismardan korunmayı öğrenme', 'M36'),
    (2, 'teacher', 1, 15, 'İlişkilerinde kişisel sınırlarını koruma', 'M10', 'Mesleki farkındalıklarını (meslek edinmenin önemi, mesleklerin özellikleri gibi) geliştirme', 'M18'),
    (2, 'teacher', 1, 16, 'Zaman yönetimi becerilerini geliştirme', 'M30', 'Yardım arama becerilerini geliştirme (ör., nereden ve kimden yardım isteyeceğini bilme)', 'M45'),
    (3, 'student', 1, 1, 'Sorunları tanımlayıp çeşitli çözümler içinden en mantıklı olanı uygulamak', 'M12', 'Kendimeuygundersçalışmabecerilerinigeliştirmek(ör.,planyapmak,görselleştirmek, not çıkartmak, çalışma ortamımı düzenlemek)', 'M30'),
    (3, 'student', 1, 2, 'Hayatımla ilgili konularda karar verme becerilerimi geliştirmek (ör., kıyafet seçme, arkadaş seçme, okul seçme)', 'M08', 'Okula devam etme isteğimi artırmak', 'M29'),
    (3, 'student', 1, 3, 'Arkadaşlık kurma becerilerimi geliştirmek (ör., insanlarla tanışmak, arkadaş edinmek ve arkadaşlıklarımı sürdürmek)', 'M07', 'Liselere giriş sınavları hakkında bilgilenmek', 'M36'),
    (3, 'student', 1, 4, 'Okuldaki kulüpler (spor, satranç, tiyatro vb.) ve yarışmalar gibi etkinlikler hakkında bilgilenmek', 'M34', 'İlişkilerimi bozmadan haklarımı savunmayı öğrenmek', 'M15'),
    (3, 'student', 1, 5, 'Zorlandığım konularda doğru kişilerden yardım isteme becerilerimi geliştirmek (ör., zorbalığa uğradığımda rehber öğretmen/psikolojik danışmana ulaşmak; yapamadığım soruları arkadaşlara ya da öğretmene sormak)', 'M48', 'Başkaları hatırlatmadan sorumluluklarımı yerine getirmek (ör., ödevlerimi tamamlama; odamı, eşyalarımı düzenlemek, temiz tutmak)', 'M04'),
    (3, 'student', 1, 6, 'Duygularım (üzüntü, öfke, kaygı vb.) ortaya çıktığında, bunları kontrol etmeyi öğrenmek', 'M42', 'Bilgisayar, cep telefonu, tablet veya televizyonu kullanırken uygun içerik seçmek ve kullanım süresini belirlemek', 'M11'),
    (3, 'student', 1, 7, 'Zamanımı planlamayı öğrenmek (ör., ders çalışmak, arkadaşlarla buluşmak, oyun oynamak)', 'M31', 'Ergenlikteki değişikliklerle ilgili bilgilenmek (ör., bedendeki değişimler, sivilcelerin çıkması, anne ve babayla çatışmalar)', 'M13'),
    (3, 'student', 1, 8, 'Hak ve sorumluluklarımı öğrenmek', 'M14', 'Yeteneklerimi (neleri iyi yapabildiğimi) tanımak', 'M23'),
    (3, 'student', 1, 9, 'Ortaokuldan sonra gidebileceğim eğitim kurumlarını tanımak', 'M32', 'Yaşamdaki zorluklar karşısında duygusal açıdan dayanıklı olmak (ör., okul değiştirme, ebeveynlerin boşanması, yakınların ölümü)', 'M47'),
    (3, 'student', 1, 10, 'Madde kullanımı, oyun ve sosyal medya gibi bağımlılık türleri ve korunma yöntemleri hakkında bilgilenmek', 'M16', 'Duygu ve düşüncelerimi saygılı ve açık bir şekilde ifade etmek', 'M03'),
    (3, 'student', 1, 11, 'Kişisel özelliklerim ile belli meslekler arasında ilişkiler kurmak (Ör., Çocukları seven bir öğrencinin büyüyünce öğretmen olmayı istemesi)', 'M39', 'İnsanlarla anlaşmazlıklarımı, her iki tarafın da isteklerini karşılayacak şekilde çözmeyi öğrenmek', 'M19'),
    (3, 'student', 1, 12, 'Farklı özelliklere sahip bireylere saygı göstermeyi öğrenmek (ör., cinsiyet, özel gereksinimli öğrenci)', 'M45', 'Öfkemi kontrol etmek', 'M06'),
    (3, 'student', 1, 13, 'Bir şeyi yapmak istemediğimde “HAYIR” diyebilmek', 'M09', 'Okul ve sınıf kurallarını benimsemek', 'M27'),
    (3, 'student', 1, 14, 'İletişim becerilerimi geliştirmek (ör., karşımızdakinin beden ve yüz hareketlerinden duygularını tahmin etmek, söz kesmeden dinlemek)', 'M10', 'Rehber öğretmenden/psikolojik danışmandan hangi konularda yardım alabileceğimi öğrenmek', 'M38'),
    (3, 'student', 1, 15, 'Kendime güvenmeyi öğrenmek', 'M01', 'İlgilerimi (ör., kodlama, spor, resim ve müzik) keşfetmek', 'M22'),
    (3, 'student', 1, 16, 'Sınav kaygısı ile başa çıkmayı öğrenmek', 'M37', 'Bedenimi korumayı öğrenmek (ör., başkalarının bedenime dokunmasına izin vermemek)', 'M41'),
    (3, 'student', 1, 17, 'Riskli davranışlardan kaçınmayı öğrenmek (ör., tehlikeli arkadaş gruplarına katılmaktan, okuldan kaçmaktan ve kavgaya karışmaktan kaçınmak)', 'M18', 'Sağlıklı yaşam becerilerini kazanmak (ör., spor yapmak, sağlıklı beslenmek)', 'M44'),
    (3, 'student', 1, 18, 'Zorbalığa uğradığımda ne yapmam gerektiğini öğrenmek (ör., alay etme, vurma, fotoğraflarımı sosyal medyada izinsiz paylaşma)', 'M05', 'Duygularımı (mutluluk, öfke, kaygı, üzüntü, korku, şaşkınlık gibi) tanımak', 'M02'),
    (3, 'parent', 1, 1, 'Ders çalıştığı sırada dikkatini dağıtan davranışlardan uzak durmayı öğrenme', 'M33', 'Ders çalışma becerilerini (derslerini düzenli çalışma, çalışırken telefon/tabletle ilgilenmeme gibi) geliştirme', 'M30'),
    (3, 'parent', 1, 2, 'Kendisi ile ilgili konularda karar verme becerilerini geliştirme (ör., kıyafet seçme, arkadaş seçme, okul seçme)', 'M08', 'Okula devam etme isteğini arttırma', 'M29'),
    (3, 'parent', 1, 3, 'Arkadaşlık kurma becerilerini geliştirme (ör., insanlarla tanışma, arkadaş edinme ve arkadaşlıklarını sürdürme)', 'M07', 'Liselere giriş sınavları hakkında bilgilenme', 'M36'),
    (3, 'parent', 1, 4, 'Okuldaki kulüpler (spor, satranç, tiyatro vb.) ve yarışmalar gibi etkinlikler hakkında bilgilenme', 'M34', 'Haklarını savunmasını öğrenme', 'M15'),
    (3, 'parent', 1, 5, 'Zorlandığı konularda doğru kişilerden yardım isteme becerilerini geliştirme (ör., zorbalığa uğradığında rehber öğretmen/psikolojik danışmana ulaşma; yapamadığı soruları arkadaşlarına ya da öğretmenine sorma)', 'M48', 'Sorumluluklarının bilincinde olma (ör., ödevlerini tamamlama; odasını, eşyalarını düzenleme, temiz tutma)', 'M04'),
    (3, 'parent', 1, 6, 'Zorbalığa uğradığında ne yapması gerektiğini bilme (ör., alay etme, vurma, fotoğraflarının sosyal medyada izinsiz paylaşılması)', 'M05', 'Bilgisayar, cep telefonu, tablet veya televizyonu kullanırken uygun içerik seçme ve kullanma sürelerini ayarlama', 'M11'),
    (3, 'parent', 1, 7, 'Zamanını planlamayı öğrenme (ör., ders çalışmak, arkadaşlarla buluşmak, oyun oynamak)', 'M31', 'Ergenlikteki değişikliklerle ilgili bilgilenme (ör., bedendeki değişimler, sivilcelerin çıkması, anne ve babayla çatışmalar)', 'M13'),
    (3, 'parent', 1, 8, 'İnsanlarla anlaşmazlıklarını, her iki tarafın da isteklerini karşılayacak şekilde çözmeyi öğrenme', 'M19', 'Yeteneklerini (neleri iyi yapabildiğini) tanıma', 'M23'),
    (3, 'parent', 1, 9, 'Ortaokuldan sonra gidebileceği eğitim kurumlarını tanıma', 'M32', 'Yaşamdaki zorluklar karşısında duygusal açıdan dayanıklı olma (ör., okul değiştirme, ebeveynlerin boşanması, yakınların ölümü)', 'M47'),
    (3, 'parent', 1, 10, 'Madde kullanımı, oyun ve sosyal medya gibi bağımlılık türleri ve korunma yöntemleri hakkında bilgilenme', 'M16', 'Duygu ve düşüncelerini saygılı ve açık bir şekilde ifade etme', 'M03'),
    (3, 'parent', 1, 11, 'Aile üyeleriyle iletişimini güçlendirme', 'M46', 'Öfkesini kontrol etme', 'M06'),
    (3, 'parent', 1, 12, 'Riskli durumlardan kaçınmak için “HAYIR” deme becerisini geliştirme', 'M09', 'Okul ve sınıf kurallarını benimseme', 'M27'),
    (3, 'parent', 1, 13, 'İletişim becerilerini geliştirme (ör., söz kesmeden dinleme, göz teması kurma)', 'M10', 'Rehber öğretmenden/psikolojik danışmandan hangi konularda yardım alabileceğini öğrenme', 'M38'),
    (3, 'parent', 1, 14, 'Kendine güvenmeyi öğrenme', 'M01', 'İlgilerini (ör., kodlama, spor, resim ve müzik) keşfetme', 'M22'),
    (3, 'parent', 1, 15, 'Sınav kaygısı ile başa çıkmayı öğrenme', 'M37', 'İstismardan korunmayı öğrenme', 'M41'),
    (3, 'parent', 1, 16, 'Riskli davranışlardan kaçınmayı öğrenme (ör., tehlikeli arkadaş gruplarına katılmaktan, okuldan kaçmaktan ve kavgaya karışmaktan kaçınmak)', 'M18', 'Sağlıklı yaşam becerilerini (ör., spor yapmak, sağlıklı beslenmek) edinme', 'M44'),
    (3, 'teacher', 1, 1, 'Problem çözme becerilerini güçlendirme', 'M12', 'Ders çalışma becerilerini (plan yapmak, görselleştirmek, not çıkartmak, öz değerlendirme gibi) geliştirme', 'M30'),
    (3, 'teacher', 1, 2, 'Karar alma becerilerini güçlendirme', 'M08', 'Okula devam motivasyonlarını artırma', 'M29'),
    (3, 'teacher', 1, 3, 'Arkadaşlık kurma becerilerini geliştirme', 'M07', 'Liselere giriş sınavları hakkında bilgilenme', 'M36'),
    (3, 'teacher', 1, 4, 'Okuldaki kulüpler (spor, satranç, tiyatro vb.) ve yarışmalar gibi etkinlikler hakkında bilgilenme', 'M34', 'İlişkilerini bozmadan haklarını savunmayı öğrenme', 'M15'),
    (3, 'teacher', 1, 5, 'Yardım arama becerilerini geliştirme (ör., nereden ve kimden yardım isteyeceğini bilme)', 'M48', 'Sorumluluklarının bilincinde olma (ör., ödevlerini tamamlama, materyallerini unutmama)', 'M04'),
    (3, 'teacher', 1, 6, 'Duygu düzenleme becerilerini (olaylara farklı açıdan bakmak, duyguyla arasına mesafe koymak, duygusal destek aramak vb.) kazanma', 'M42', 'Teknoloji bağımlılığına karşı koruyucu ek beceriler kazanma', 'M11'),
    (3, 'teacher', 1, 7, 'Zaman yönetimi becerilerini güçlendirme', 'M31', 'Ergenlikteki bedensel ve psikolojik değişikliklere uyum sağlama', 'M13'),
    (3, 'teacher', 1, 8, 'Hak ve sorumluluklarını bilme', 'M14', 'Yeteneklerini (neleri iyi yapabildiklerini) tanıma', 'M23'),
    (3, 'teacher', 1, 9, 'Üst öğrenim kurumları hakkında bilgi edinme', 'M32', 'Yaşamdaki zorluklar karşısında duygusal açıdan dayanıklı olma (ör., okul değiştirme, ebeveynlerin boşanması, yakınların ölümü)', 'M47'),
    (3, 'teacher', 1, 10, 'Madde kullanımı, oyun ve sosyal medya gibi bağımlılık türleri ve korunma yöntemleri hakkında bilgilenme', 'M16', 'Duygu ve düşüncelerini saygılı ve açık bir şekilde ifade etme', 'M03'),
    (3, 'teacher', 1, 11, 'Dikkat geliştirme becerilerini iyileştirme', 'M33', 'Kişilerarası çatışma çözme becerilerini geliştirme', 'M19'),
    (3, 'teacher', 1, 12, 'Bireysel farklılıklara saygı göstermeyi öğrenme', 'M45', 'Öfkelerini kontrol etme', 'M06'),
    (3, 'teacher', 1, 13, 'İlişkilerinde kişisel sınırlarını koruma', 'M09', 'Okul ve sınıf kurallarını benimseme', 'M27'),
    (3, 'teacher', 1, 14, 'İletişim becerilerini iyileştirme', 'M10', 'Rehberlik ve psikolojik danışma servisinden hangi konularda yardım alabileceklerini öğrenme', 'M38'),
    (3, 'teacher', 1, 15, 'Kendine güvenmeyi öğrenme', 'M01', 'İlgilerini (ör., kodlama, spor, resim ve müzik) keşfetme', 'M22'),
    (3, 'teacher', 1, 16, 'Sınav kaygısı ile başa çıkma becerileri kazanma', 'M37', 'İstismardan korunmayı öğrenme', 'M41'),
    (3, 'teacher', 1, 17, 'Riskli davranışlardan kaçınmayı öğrenme (ör., tehlikeli arkadaş gruplarına katılmaktan, okuldan kaçmaktan ve kavgaya karışmaktan kaçınmak)', 'M18', 'Sağlıklı yaşam becerilerini (ör., spor yapmak, sağlıklı beslenmek) edinme', 'M44'),
    (3, 'teacher', 1, 18, 'Zorbalığa uğradığında ne yapmaları gerektiğini bilme', 'M05', 'Duygularını (mutluluk, üzüntü, korku, şaşkınlık gibi) tanıma', 'M02'),
    (4, 'student', 1, 1, 'İlişkilerimi bozmadan haklarımı savunmayı öğrenmek', 'M05', 'Verimli ders çalışma becerilerimi geliştirmek', 'M24'),
    (4, 'student', 1, 2, 'Stresle baş etmeyi öğrenmek', 'M08', 'Hayatımla ilgili konularda karar verme becerilerimi geliştirmek (ör., arkadaş seçme, okul seçme, kariyer planlama)', 'M03'),
    (4, 'student', 1, 3, 'Yaşamdaki zorluklar karşısında duygusal açıdan dayanıklı olmak (ör., okul değiştirme, ebeveynlerin boşanması, yakınların ölümü)', 'M36', 'Bir şeyi yapmak istemediğimde, “HAYIR” diyebilme becerisini kazanmak', 'M01'),
    (4, 'student', 1, 4, 'Yeteneklerimi (neleri iyi yapabildiğimi) tanımak', 'M21', 'Okul kuralları (sınıf geçme, ödül, disiplin gibi konular) hakkında bilgilenmek', 'M30'),
    (4, 'student', 1, 5, 'Ergenlik döneminin duygusal değişimleriyle ilgili bilgi edinmek', 'M09', 'İletişim becerilerimi güçlendirmek (ör., beden dilini anlamak, empati kurmak)', 'M06'),
    (4, 'student', 1, 6, 'Harekete geçmeden önce anlık isteğimi değil, davranışımın sonuçlarını göz önünde bulundurmak (ör., ders çalışırken telefonunu başka odaya koymak, tartışmalar şiddetlendiğinde ortamdan uzaklaşmak)', 'M39', 'Ergenlik dönemi gelişim özellikleri konusunda bilgilenmek (ör., bedensel ve ruhsal değişiklikler)', 'M10'),
    (4, 'student', 1, 7, 'İstismar (fiziksel, duygusal vb.) ve ihmal türlerinden korunmayı öğrenmek', 'M15', 'Üst öğrenim olanakları hakkında bilgilenmek', 'M28'),
    (4, 'student', 1, 8, 'Üniversite sınavları hakkında bilgilenmek', 'M29', 'Teknoloji bağımlılığından korunma becerilerimi geliştirmek', 'M17'),
    (4, 'student', 1, 9, 'Karşı cinsle sağlıklı iletişim kurabilme becerisi kazanmak', 'M14', 'Farklı kariyer seçeneklerinde nelerin gerekli olduğunu öğrenmek ve buna göre hedeflerimi gözden geçirmek (ör., deneme sınav sonuçlarıyla istediğim bölümlerin başarı sıralarını karşılaştırmak)', 'M26'),
    (4, 'student', 1, 10, 'Mesleklerle ilgili çeşitli kaynaklardan bilgi edinmek (ör., iş yerlerini gezme, meslek insanın okula davet edilmesi, internet kaynakları)', 'M19', 'İlgi, yetenek ve değerlerime uygun kariyer seçeneklerini analiz etmek', 'M23'),
    (4, 'student', 1, 11, 'Zorlandığım konularda doğru kişilerden yardım isteme becerilerimi geliştirmek (ör., zorbalıkla karşılaştığımda rehber öğretmen/psikolojik danışmana ulaşmak; yapamadığım soruları arkadaşlara ya da öğretmene sormak)', 'M42', 'Öfkemi kontrol etme becerilerimi güçlendirmek', 'M02'),
    (4, 'student', 1, 12, 'Rehber öğretmenden/psikolojik danışmandan hangi konularda yardım alabileceğimi öğrenmek', 'M34', 'Bağımlılık yapan maddelerin etkileri hakkında bilgilenmek', 'M13'),
    (4, 'student', 1, 13, 'İnsanlarla anlaşmazlıklarımı, ilişkilerimi bozmayacak ve haklarımı savunacak şekilde çözmek', 'M11', 'Okul dışı etkinlikler (eğitsel, kültürel, sosyal ve sportif faaliyetler) hakkında bilgilenmek', 'M32'),
    (4, 'student', 1, 14, 'Sağlıklı yaşam becerilerini kazanmak (ör., spor yapmak, sağlıklı beslenmek, kişisel hijyene dikkat etmek)', 'M35', 'Meslek seçiminde nelere önem verildiğini öğrenmek (ör., işin kazancı, saygınlığı, çalışma ortamı)', 'M22'),
    (4, 'student', 1, 15, 'İlgilerimi (kodlama, spor, resim, müzik gibi) keşfetmek', 'M20', 'Dijital okur-yazarlık becerilerini geliştirmek (ör., sahte videoları ayırt etmek, kötü amaçlı yazılımları indirmemek ve kişisel verileri paylaşmamak)', 'M16'),
    (4, 'student', 1, 16, 'Özgüvenimi geliştirmek', 'M04', 'Zamanı planlama becerilerimi geliştirmek', 'M25'),
    (4, 'student', 1, 17, 'Okul kulüpleri (spor, satranç, tiyatro vb.) ve yarışmalar gibi etkinlikler hakkında bilgilenmek', 'M31', 'Sınav kaygısı ile başa çıkmayı öğrenmek', 'M27'),
    (4, 'student', 1, 18, 'Zorbalıkla karşılaştığımda ne yapmam gerektiğini öğrenmek (ör., alay etme, vurma, fotoğraflarımı sosyal medyada izinsiz paylaşma)', 'M38', 'Aile üyeleriyle iletişimimi güçlendirmek', 'M40'),
    (4, 'student', 1, 19, 'Duygularımı düzenlemeyi öğrenmek (ör., öfkelenince, üzülünce, kaygılanınca sakinleşmek için yürüyüşe çıkmak, biriyle dertleşmek, olaylara farklı açıdan bakmak)', 'M41', 'Farklı özelliklere sahip bireylere saygı göstermeyi öğrenmek (ör., karşı cins, özel gereksinimli birey ve göçmenler)', 'M37'),
    (4, 'student', 1, 20, 'Okula devam etme isteğimi artırmak', 'M43', 'Okulda seçebileceğim alan/dal hakkında bilgilenmek', 'M44'),
    (4, 'parent', 1, 1, 'Haklarını savunmasını öğrenme', 'M05', 'Verimli ders çalışma becerilerini geliştirme', 'M24'),
    (4, 'parent', 1, 2, 'Stresle baş etmeyi öğrenme', 'M08', 'Yaşamıyla ilgili önemli konularda mantıklı kararlar alma', 'M03'),
    (4, 'parent', 1, 3, 'Yaşamdaki zorluklar karşısında duygusal açıdan dayanıklı olma (ör., okul değiştirme, ebeveynlerin boşanması, yakınların ölümü)', 'M36', 'Riskli durumlardan kaçınmak için “HAYIR” deme becerisini geliştirme', 'M01'),
    (4, 'parent', 1, 4, 'Yeteneklerini (neleri iyi yapabildiğini) tanıma', 'M21', 'Okul kuralları (sınıf geçme, ödül, disiplin gibi konular) hakkında bilgilenme', 'M30'),
    (4, 'parent', 1, 5, 'Ergenlik döneminin duygusal sorunlarıyla baş etmeyi öğrenme', 'M09', 'İletişim becerilerini geliştirme (ör., söz kesmeden dinleme, göz teması kurma)', 'M06'),
    (4, 'parent', 1, 6, 'Harekete geçmeden önce anlık isteklerini değil, davranışının sonuçlarını göz önünde bulundurma (ör., ders çalışırken telefonunu başka odaya koymak, tartışmalar şiddetlendiğinde ortamdan uzaklaşmak)', 'M39', 'Ergenlik dönemi gelişim özellikleri konusunda bilgilenme (ör., bedensel ve ruhsal değişiklikler)', 'M10'),
    (4, 'parent', 1, 7, 'İstismar (fiziksel ve duygusal vb.) ve ihmal türlerinden korunmayı öğrenme', 'M15', 'Üst öğrenim olanakları hakkında bilgilenme', 'M28'),
    (4, 'parent', 1, 8, 'Üniversite sınavları hakkında bilgilenme', 'M29', 'Teknoloji bağımlılığının olumsuz etkilerinden korunmayı öğrenme', 'M17'),
    (4, 'parent', 1, 9, 'Karşı cinsle sağlıklı iletişim kurabilme becerisi kazanma', 'M14', 'Farklı kariyer seçeneklerinde nelerin gerekli olduğunu öğrenme ve buna göre hedeflerini gözden geçirme (ör., deneme sınav sonuçlarıyla istediği bölümlerin başarı sıralarını karşılaştırmak)', 'M26'),
    (4, 'parent', 1, 10, 'Mesleklerle ilgili bilgi edinme', 'M19', 'İlgi, yetenek ve değerlerine uygun kariyer seçeneklerini analiz etme', 'M23'),
    (4, 'parent', 1, 11, 'Zorlandığı konularda doğru kişilerden yardım isteme becerilerini geliştirme (ör., zorbalığa uğradığında rehber öğretmen/psikolojik danışmana ulaşma; yapamadığı soruları arkadaşlarına ya da öğretmenine sorma)', 'M42', 'Öfkesini kontrol etme', 'M02'),
    (4, 'parent', 1, 12, 'Rehber öğretmenden/psikolojik danışmandan hangi konularda yardım alabileceğini öğrenme', 'M34', 'Bağımlılık yapan maddelerin olumsuz etkileri hakkında bilgilenme', 'M13'),
    (4, 'parent', 1, 13, 'İnsanlarla anlaşmazlıklarını, ilişkilerini bozmayacak ve haklarını savunacak şekilde çözme', 'M11', 'Okul dışı etkinlikler (eğitsel, kültürel, sosyal ve sportif faaliyetler) hakkında bilgilenme', 'M32'),
    (4, 'parent', 1, 14, 'Sağlıklı yaşam becerilerini edinme (ör., spor yapma, sağlıklı beslenme ve kişisel hijyene dikkat etme)', 'M35', 'Meslek seçiminde nelere önem verildiğini fark etme (ör., işin kazancı, saygınlığı, çalışma ortamı)', 'M22'),
    (4, 'parent', 1, 15, 'İlgilerini (kodlama, spor, resim, müzik gibi) keşfetme', 'M20', 'Dijital okur-yazarlık becerilerini geliştirme (ör., sahte videoları ayırt etmek, kötü amaçlı yazılımları indirmemek ve kişisel verileri paylaşmamak)', 'M16'),
    (4, 'parent', 1, 16, 'Kendine güvenmeyi öğrenme', 'M04', 'Zaman planlama becerilerini geliştirme', 'M25'),
    (4, 'parent', 1, 17, 'Okul kulüpleri (spor, satranç, tiyatro vb.) ve yarışmalar gibi etkinlikler hakkında bilgilenme', 'M31', 'Sınav kaygısı ile başa çıkmayı öğrenme', 'M27'),
    (4, 'parent', 1, 18, 'Zorbalıkla karşılaştığında ne yapması gerektiğini bilme (ör., alay etme, vurma, fotoğraflarının sosyal medyada izinsiz paylaşılması)', 'M38', 'Aile üyeleriyle iletişimini güçlendirme', 'M40'),
    (4, 'parent', 1, 19, 'Okula devam etme isteğini artırma', 'M43', 'Okulda seçebileceği alan/dal hakkında bilgilenme', 'M44'),
    (4, 'teacher', 1, 1, 'İlişkilerini bozmadan haklarını savunmayı öğrenme', 'M05', 'Verimli ders çalışma becerilerini geliştirme', 'M24'),
    (4, 'teacher', 1, 2, 'Stresle baş etme becerileri kazanma', 'M08', 'Karar alma becerilerini geliştirme', 'M03'),
    (4, 'teacher', 1, 3, 'Yaşamdaki zorluklar karşısında duygusal açıdan dayanıklı olma (ör., okul değiştirme, ebeveynlerin boşanması, yakınların ölümü)', 'M36', 'İlişkilerinde kişisel sınırlarını koruma (ör., “HAYIR” diyebilme becerisini kazanma)', 'M01'),
    (4, 'teacher', 1, 4, 'Yeteneklerini (neleri iyi yapabildiklerini) tanıma', 'M21', 'Okul kuralları (sınıf geçme, ödül, disiplin gibi konular) hakkında bilgilenme', 'M30'),
    (4, 'teacher', 1, 5, 'Ergenlik döneminin duygusal sorunlarıyla baş etmeyi öğrenme', 'M09', 'İletişim becerilerini (beden dili, etkin dinleme, empati vb.) geliştirme', 'M06'),
    (4, 'teacher', 1, 6, 'Harekete geçmeden önce anlık isteklerini değil, davranışlarının sonuçlarını göz önünde bulundurma (ör., arkadaşıyla konuşmak yerine dersi dinlemek, tartışmalar şiddetlendiğinde ortamdan uzaklaşmak)', 'M39', 'Ergenlik dönemi gelişim özellikleri konusunda bilgilenme (bedensel ve duygusal değişiklikler)', 'M10'),
    (4, 'teacher', 1, 7, 'İhmal ve istismardan korunmayı öğrenme', 'M15', 'Üst öğrenim olanakları hakkında bilgilenme', 'M28'),
    (4, 'teacher', 1, 8, 'Üniversite sınavları hakkında bilgilenme', 'M29', 'Teknoloji bağımlılığından korunma becerilerini geliştirme', 'M17'),
    (4, 'teacher', 1, 9, 'Karşı cinsle sağlıklı iletişim kurabilme becerileri kazanma', 'M14', 'Farklı kariyer seçeneklerinde nelerin gerekli olduğunu öğrenme ve buna göre hedeflerini gözden geçirme (ör., deneme sınav sonuçlarıyla istedikleri bölümlerin başarı sıralarını karşılaştırmak)', 'M26'),
    (4, 'teacher', 1, 10, 'Mesleklerle ilgili bilgi edinme', 'M19', 'İlgi, yetenek ve değerlerine uygun kariyer seçeneklerini analiz etme', 'M23'),
    (4, 'teacher', 1, 11, 'Yardım arama becerilerini geliştirme (ör., nereden ve kimden yardım isteyeceğini bilme)', 'M42', 'Öfkelerini kontrol etme becerilerini güçlendirme', 'M02'),
    (4, 'teacher', 1, 12, 'Rehberlik ve psikolojik danışma servisinden hangi konularda yardım alabileceklerini öğrenme', 'M34', 'Bağımlılık yapan maddelerin olumsuz etkileri hakkında bilgilenme', 'M13'),
    (4, 'teacher', 1, 13, 'Kişilerarası çatışma çözme becerilerini geliştirme', 'M11', 'Okul dışı etkinlikler (eğitsel, kültürel, sosyal ve sportif faaliyetler) hakkında bilgilenme', 'M32'),
    (4, 'teacher', 1, 14, 'Sağlıklı yaşam becerilerini edinme (ör., spor yapma, sağlıklı beslenme ve kişisel hijyene dikkat etme)', 'M35', 'Meslek seçiminde nelere önem verildiğini fark etme (ör., işin kazancı, saygınlığı, çalışma ortamı)', 'M22'),
    (4, 'teacher', 1, 15, 'İlgilerini (kodlama, spor, resim, müzik gibi) keşfetme', 'M20', 'Dijital okur-yazarlık becerilerini geliştirme (ör., sahte videoları ayırt etmek, kötü amaçlı yazılımları indirmemek ve kişisel verileri paylaşmamak)', 'M16'),
    (4, 'teacher', 1, 16, 'Özgüvenlerini geliştirme', 'M04', 'Zamanı planlama becerilerini geliştirme', 'M25'),
    (4, 'teacher', 1, 17, 'Okul kulüpleri (spor, satranç, tiyatro vb.) ve yarışmalar gibi etkinlikler hakkında bilgilenme', 'M31', 'Sınav kaygısı ile başa çıkma becerileri kazanma', 'M27'),
    (4, 'teacher', 1, 18, 'Zorbalıkla karşılaştığında ne yapmaları gerektiğini bilme', 'M38', 'Duygu düzenleme becerilerini (olaylara farklı açıdan bakmak, duygusal destek aramak) kazanma', 'M41'),
    (4, 'teacher', 1, 19, 'Okula devam etme isteklerini artırma', 'M43', 'Okulda seçebilecekleri alan/dal hakkında bilgilenme', 'M44')
)
INSERT INTO public.riba_questions
    (form_id, question_no, option_a_text, option_a_target_id, option_b_text, option_b_target_id)
SELECT
    f.id,
    qs.question_no,
    qs.option_a_text,
    ta.id,
    qs.option_b_text,
    tb.id
FROM question_seed qs
JOIN public.riba_forms f
  ON f.education_level_id = qs.education_level_id
 AND f.participant_type = qs.participant_type
 AND f.version = qs.version
JOIN public.riba_targets ta
  ON ta.education_level_id = qs.education_level_id
 AND ta.meb_code = qs.option_a_meb_code
JOIN public.riba_targets tb
  ON tb.education_level_id = qs.education_level_id
 AND tb.meb_code = qs.option_b_meb_code
ON CONFLICT (form_id, question_no) DO NOTHING;

-- 3) Güvenlik doğrulaması:
-- Bu migration sonunda Version 1 resmî RİBA setinde tam 11 form ve 180 soru olmalıdır.
DO $$
DECLARE
    v_form_count INTEGER;
    v_question_count INTEGER;
BEGIN
    SELECT COUNT(*)
      INTO v_form_count
    FROM public.riba_forms
    WHERE version = 1
      AND education_level_id IN (1,2,3,4)
      AND (
          (education_level_id = 1 AND participant_type IN ('parent','teacher'))
          OR
          (education_level_id IN (2,3,4) AND participant_type IN ('student','parent','teacher'))
      );

    SELECT COUNT(*)
      INTO v_question_count
    FROM public.riba_questions q
    JOIN public.riba_forms f ON f.id = q.form_id
    WHERE f.version = 1
      AND f.education_level_id IN (1,2,3,4)
      AND (
          (f.education_level_id = 1 AND f.participant_type IN ('parent','teacher'))
          OR
          (f.education_level_id IN (2,3,4) AND f.participant_type IN ('student','parent','teacher'))
      );

    IF v_form_count <> 11 THEN
        RAISE EXCEPTION 'RİBA form seed doğrulaması başarısız. Beklenen: 11, bulunan: %', v_form_count;
    END IF;

    IF v_question_count <> 180 THEN
        RAISE EXCEPTION 'RİBA soru seed doğrulaması başarısız. Beklenen: 180, bulunan: %', v_question_count;
    END IF;
END $$;

COMMIT;
