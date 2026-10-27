// DNA bireysel değerlendirme: sabit metinler ve saf hesaplama (yapay zekâ / harici API yok).

export const DNA_GUIDANCE_TEXTS = {
  1: {
    assessment: "Öğrencinin yanıtları, okul ortamı, okulun işleyişi veya kurallarıyla ilişkili bazı durumların okula devamını etkileyebileceğini düşündürmektedir.",
    advice: "Öğrenciyle yapılacak bireysel görüşmede okul ortamına ilişkin düşünceleri, beklentileri ve yaşadığı güçlükler ele alınmalı; ihtiyaç duyulan konularda okul yönetimiyle iş birliği değerlendirilmelidir.",
  },
  2: {
    assessment: "Öğrencinin yanıtları, ders süreçleri veya öğretmenleriyle kurduğu ilişkilerle bağlantılı bazı güçlüklerin okula devamıyla ilişkili olabileceğini göstermektedir.",
    advice: "Öğrencinin derslerde yaşadığı deneyimler, öğretmenleriyle iletişimi ve öğrenme ortamına ilişkin beklentileri bireysel görüşmede ele alınmalı; gerektiğinde ilgili öğretmenlerle destekleyici iş birliği kurulmalıdır.",
  },
  3: {
    assessment: "Öğrencinin yanıtları, aile yaşantısı ve ev ortamıyla ilişkili bazı koşulların okula devamını etkileyebileceğini düşündürmektedir.",
    advice: "Öğrencinin aile ortamı, günlük sorumlulukları ve evde karşılaştığı güçlükler bireysel görüşmede ele alınmalı; öğrencinin güvenliği ve yararı gözetilerek uygun durumlarda aileyle iş birliği planlanmalıdır.",
  },
  4: {
    assessment: "Öğrencinin yanıtları, ulaşım, çevresel koşullar veya okul dışındaki günlük yaşam düzeninin okula devamıyla ilişkili olabileceğini düşündürmektedir.",
    advice: "Öğrencinin okula ulaşım koşulları, günlük yaşam düzeni ve çevresel güçlükleri belirlenmeli; çözüm gerektiren durumlarda aile ve ilgili okul birimleriyle uygulanabilir destek yolları değerlendirilmelidir.",
  },
  5: {
    assessment: "Öğrencinin yanıtları, akademik başarı beklentileri, sınavlar veya öğrenme süreçlerinde yaşadığı güçlüklerin okula devamıyla ilişkili olabileceğini düşündürmektedir.",
    advice: "Öğrencinin akademik beklentileri, derslerde zorlandığı alanlar ve sınavlara ilişkin düşünceleri bireysel görüşmede ele alınmalı; ihtiyaçlarına uygun akademik ve psikolojik danışma desteği planlanmalıdır.",
  },
  6: {
    assessment: "Öğrencinin yanıtları, okula yönelik tutumu, motivasyonu veya kişisel yaşantısıyla ilişkili bazı durumların okula devamını etkileyebileceğini düşündürmektedir.",
    advice: "Öğrencinin okula ilişkin duygu ve düşünceleri, okula aidiyet algısı, motivasyonu ve günlük yaşam düzeni bireysel görüşmede ele alınmalı; öğrenciyle birlikte uygulanabilir bir okula devam planı hazırlanmalıdır.",
  },
  7: {
    assessment: "Öğrencinin yanıtları, akran ilişkileri, arkadaş grubundaki deneyimleri veya sosyal kabul süreçleriyle ilişkili durumların okula devamını etkileyebileceğini düşündürmektedir.",
    advice: "Öğrencinin arkadaş ilişkileri, sosyal destek kaynakları ve olası dışlanma veya zorbalık deneyimleri güvenli bir bireysel görüşmede ele alınmalı; ihtiyaç halinde uygun koruyucu ve destekleyici çalışmalar planlanmalıdır.",
  },
};

export const DNA_GUIDANCE_DISCLAIMER =
  "Bu değerlendirme, öğrencinin DNA yanıtlarından elde edilen boyut ortalamalarına dayalı bireysel bir rehberlik göstergesidir. Resmî grup değerlendirmesi, psikolojik tanı veya kesin devamsızlık nedeni olarak yorumlanmamalıdır. Sonuçlar, öğrenciyle yapılacak bireysel görüşme ve diğer bilgilerle birlikte değerlendirilmelidir.";
export const DNA_GUIDANCE_ALL_ZERO =
  "Öğrencinin yanıtlarında belirgin bir devamsızlık nedeni bildirilmemiştir. Devamsızlık durumu bireysel görüşmeyle araştırılabilir.";
export const DNA_GUIDANCE_INVALID = "Bu yanıt geçersiz kılındığından bireysel değerlendirme oluşturulmamıştır.";
export const DNA_ATTENTION_TITLE = "Özel Dikkat Gerektiren Yanıtlar";
export const DNA_ATTENTION_NOTE =
  "Aşağıdaki maddelere verilen yanıtlar okul rehberlik servisi tarafından bireysel görüşmeyle ayrıca değerlendirilmelidir.";
export const DNA_ATTENTION_ITEMS = [18, 23, 24, 31, 43, 49, 50];

export function computeDnaGuidance(dimensions) {
  const averages = dimensions.map((d) => ({
    dimension_no: d.dimension_no,
    name: d.name,
    average: d.items.length ? d.score / d.items.length : 0,
  }));
  const positive = averages.filter((a) => a.average > 0).sort((a, b) => b.average - a.average || a.dimension_no - b.dimension_no);
  const cutoff = positive.length >= 2 ? positive[1].average : 0;
  const highlighted = positive.filter((a, i) => i < 2 || a.average === cutoff);
  const attention = dimensions
    .flatMap((d) => d.items)
    .filter((i) => DNA_ATTENTION_ITEMS.includes(i.item_no) && (i.value === 2 || i.value === 1))
    .sort((a, b) => a.item_no - b.item_no);
  return { averages, highlighted, allZero: positive.length === 0, attention };
}
