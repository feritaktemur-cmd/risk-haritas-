"""RİBA saf hesaplama çekirdeği.

Bu modül YALNIZCA saf (yan etkisiz) matematik içerir. Supabase, FastAPI,
ağ veya I/O bağımlılığı yoktur. Girdi olarak sayısal listeler / sözlükler alır,
çıktı olarak skorlar üretir. Böylece kolayca test edilebilir ve DB orkestrasyonu
(server.py) bu fonksiyonları çağırır.

Terimler:
- Frekans (F): Bir hedefin (target) belirli bir grup + sınıf içinde seçilme sayısı.
- Standart Puan: Bir hedefin frekansının, aynı grup/sınıftaki tüm hedeflerin
  frekans dağılımına göre standartlaştırılmış hali.
- ASP: Bir hedefin, kademeye özgü grup ağırlıklarıyla hesaplanan nihai puanı.
"""
from math import sqrt


class RibaAnswerError(ValueError):
    """Bir RİBA form cevap setindeki bütünlük hatası (geçersiz/eksik cevap)."""


VALID_OPTIONS = ("A", "B")


def _target_for_answer(question, selected_option):
    """Bir cevabın seçilen A/B değerine göre hedef (target_id) karşılığını döner.

    Yalnız 'A' veya 'B' kabul edilir; başka bir değerde açık hata üretilir.
    İlgili seçeneğin target_id'si tanımsızsa açık hata üretilir.
    """
    if selected_option not in VALID_OPTIONS:
        raise RibaAnswerError(
            f"Geçersiz seçim: {selected_option!r}. Yalnız 'A' veya 'B' kabul edilir."
        )
    key = "option_a_target_id" if selected_option == "A" else "option_b_target_id"
    target_id = question.get(key)
    if target_id is None:
        raise RibaAnswerError(
            f"Soru için {key} tanımsız (question_id={question.get('question_id')!r})."
        )
    return target_id


def build_target_frequencies(questions, answers):
    """Bir RİBA formundaki cevaplardan hedef frekanslarını üretir.

    questions: her biri {question_id, option_a_target_id, option_b_target_id}
               içeren iterable (formun TÜM soruları).
    answers:   her biri {question_id, selected_option} ('A'|'B') içeren iterable.

    Dönüş: {target_id: frekans} sözlüğü. Her geçerli cevap, seçilen A/B'ye ait
    hedefin frekansını 1 artırır. Aynı hedef farklı sorularda seçilmişse her
    seçim ayrı ayrı eklenir.

    Bütünlük kuralları (hepsi açık hata üretir; sessizce devam edilmez):
    - Geçersiz A/B seçimi -> RibaAnswerError
    - Cevaplarda formda olmayan question_id -> RibaAnswerError
    - Aynı soru için birden fazla cevap -> RibaAnswerError
    - Cevaplanmamış/eksik soru (tam form değil) -> RibaAnswerError
    """
    q_by_id = {}
    for q in questions:
        qid = q.get("question_id")
        if qid is None:
            raise RibaAnswerError("Soru kaydında question_id tanımsız.")
        if qid in q_by_id:
            raise RibaAnswerError(f"Yinelenen soru tanımı: question_id={qid!r}.")
        q_by_id[qid] = q

    frequencies = {}
    answered = set()
    for a in answers:
        qid = a.get("question_id")
        if qid not in q_by_id:
            raise RibaAnswerError(f"Formda olmayan soruya cevap: question_id={qid!r}.")
        if qid in answered:
            raise RibaAnswerError(f"Aynı soru için birden fazla cevap: question_id={qid!r}.")
        answered.add(qid)
        target_id = _target_for_answer(q_by_id[qid], a.get("selected_option"))
        frequencies[target_id] = frequencies.get(target_id, 0) + 1

    missing = set(q_by_id) - answered
    if missing:
        raise RibaAnswerError(
            f"Eksik/cevapsız soru var; tam form değil. Eksik question_id sayısı: {len(missing)}."
        )

    return frequencies


# --- Kademe (education_level_id) sabitleri ---
# Migration 019'daki form dağılımıyla uyumlu:
#   1 = Okul Öncesi (yalnız veli, öğretmen)
#   2 = İlkokul, 3 = Ortaokul, 4 = Lise (öğrenci, veli, öğretmen)
LEVEL_PRESCHOOL = 1
LEVEL_PRIMARY = 2
LEVEL_MIDDLE = 3
LEVEL_HIGH = 4

# Kademe bazlı grup ağırlıkları. İlkokul toplamı 1.01'dir ve NORMALİZE EDİLMEZ.
GROUP_WEIGHTS = {
    LEVEL_PRESCHOOL: {"parent": 0.49, "teacher": 0.51},
    LEVEL_PRIMARY: {"student": 0.27, "parent": 0.36, "teacher": 0.38},
    LEVEL_MIDDLE: {"student": 0.39, "parent": 0.28, "teacher": 0.33},
    LEVEL_HIGH: {"student": 0.39, "parent": 0.28, "teacher": 0.33},
}


def arithmetic_mean(values):
    """Frekans listesinin aritmetik ortalaması. Liste boşsa None."""
    if not values:
        return None
    return sum(values) / len(values)


def sample_stddev(values):
    """Örneklem standart sapması (n-1), MEB Excel STDEV ile uyumlu.

    n < 2 ise None döner (tanımsız).
    """
    n = len(values)
    if n < 2:
        return None
    mean = sum(values) / n
    variance = sum((x - mean) ** 2 for x in values) / (n - 1)
    return sqrt(variance)


def standard_score(frequency, mean, stddev, n):
    """Tek bir frekans için standart puan: ((F - mean) / stddev) * 10 + 50.

    n < 2 veya stddev == 0 (ya da mean/stddev None) ise puan uydurulmaz -> None.
    Yuvarlama yapılmaz.
    """
    if n is None or n < 2:
        return None
    if mean is None or stddev is None or stddev == 0:
        return None
    return ((frequency - mean) / stddev) * 10 + 50


def standardize_frequencies(frequencies):
    """Bir grup/sınıftaki tüm hedeflerin frekans listesini standart puanlara çevirir.

    Ortalama ve standart sapma bir kez hesaplanır, her frekans için standart puan
    üretilir. n < 2 veya stddev == 0 ise her puan None olur.
    """
    n = len(frequencies)
    mean = arithmetic_mean(frequencies)
    stddev = sample_stddev(frequencies)
    return [standard_score(f, mean, stddev, n) for f in frequencies]


def level_weights(education_level_id):
    """Kademe için grup ağırlıklarını döner. Bilinmeyen kademe için None."""
    return GROUP_WEIGHTS.get(education_level_id)


def compute_asp(education_level_id, group_scores):
    """Bir hedefin ASP'sini hesaplar.

    group_scores: {"student": puan|None, "parent": puan|None, "teacher": puan|None}
    Yalnızca ilgili kademede ZORUNLU olan gruplar dikkate alınır.
    Zorunlu grupların herhangi birinin puanı eksik/None ise ASP None olur.
    ASP = Σ (grup_ağırlığı * grup_standart_puanı). Yuvarlama yapılmaz.
    """
    weights = GROUP_WEIGHTS.get(education_level_id)
    if weights is None:
        return None
    total = 0.0
    for group, weight in weights.items():
        score = group_scores.get(group)
        if score is None:
            return None
        total += weight * score
    return total
