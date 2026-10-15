#!/usr/bin/env python3
"""Türkçe müfredat CSV'sinden tek sınıf için 032 uyumlu hazırlık (staging) seed SQL'i üretir.

Yalnızca dosya okur ve dosya yazar; hiçbir veritabanına bağlanmaz.
Kanonik kayıt, karar veya yayın üretmez: tüm tema eşleşmeleri 'unmapped' kalır.
Kullanım: python3 generate_tr_grade_seed.py <csv> --grade 1 --out-dir output
"""
import argparse, csv, hashlib, io, json, re, sys, unicodedata, uuid
from collections import Counter, defaultdict, OrderedDict

VALIDATOR_VERSION = "bep-tr-seed-1.0"
SUBJECT_CODE, SUBJECT_NAME = "TR", "Türkçe"
VERSION_CODE, VERSION_TITLE = "TYMM-2024-TR", "Türkiye Yüzyılı Maarif Modeli Türkçe Öğretim Programı"
NS = uuid.UUID("5b1d3c3e-6f1e-4c0b-9d2a-6a1f0e0b0c32")  # deterministik kimlik ad alanı
EXPECTED_COLUMNS = ['Kaynak CSV Satırı', 'Ders', 'Sınıf', 'Tema No', 'Tema Adı', 'Öğrenme Çıktısı Kodu',
                    'Öğrenme Çıktısı Metni', 'Bileşen Harfi', 'Süreç Bileşeni Metni', 'MEB Kaynak URL', 'Kaynak PDF',
                    'PDF Sayfa Sayısı', 'Kontrol Durumu', 'Ana Program Kanonik Metin', 'Ana Metin Kontrolü',
                    'Kod İçi Metin Çakışması', 'Yayın Kararı', 'Kaynak Kararı']
OUTCOME_FIELD, COMPONENT_FIELD = 'Öğrenme Çıktısı Metni', 'Süreç Bileşeni Metni'
TR_LETTERS = set("abcçdefgğhıijklmnoöprsştuüvyz")
CONTAMINATION = [
    (re.compile(r'T\.?[DKOY]\.?\d\.\d'), 'metin içinde başka kazanım kodu'),
    (re.compile(r'İçerik Çerçevesi'), "metin içinde 'İçerik Çerçevesi'"),
    (re.compile(r'(?:^|[\s\.])[a-zçğıöşü]\)\s'), 'metin içinde harfli madde başı'),
    (re.compile(r'[a-zçğıöşü][a-zçğıöşü]\)\s?[A-ZÇĞİÖŞÜ]'), 'sözcüğe yapışık madde başı'),
]
INVISIBLE = re.compile(r'[\u00a0\u200b\u200c\u200d\ufeff\t\r\n]')


def key(s):  # karşılaştırma anahtarı: NFC + baş/son boşluk; harf dönüşümü yok (Türkçe İ/ı)
    return unicodedata.normalize('NFC', s).strip()


def uid(*parts):
    return str(uuid.uuid5(NS, "|".join(str(p) for p in parts)))


def q(v):
    if v is None:
        return "NULL"
    return "'" + str(v).replace("'", "''") + "'"


def row_json(r):
    return json.dumps(r, ensure_ascii=False, sort_keys=True, separators=(',', ':'))


def validate(rows, grade):
    errors, warnings = [], []
    g = [r for r in rows if r['Sınıf'].strip() == str(grade)]
    if not g:
        errors.append(f"{grade}. sınıfa ait satır yok")
        return g, errors, warnings
    seen_src, seen_key = set(), set()
    theme_name, theme_url = {}, {}
    to_text = defaultdict(set)
    code_text = defaultdict(set)
    for r in g:
        n = r['Kaynak CSV Satırı']
        where = f"satır {n}"
        for col in ['Kaynak CSV Satırı', 'Ders', 'Sınıf', 'Tema No', 'Tema Adı', 'Öğrenme Çıktısı Kodu',
                    OUTCOME_FIELD, 'Bileşen Harfi', COMPONENT_FIELD, 'MEB Kaynak URL']:
            if not r[col].strip():
                errors.append(f"{where}: boş zorunlu alan '{col}'")
        if r['Ders'].strip() != SUBJECT_NAME:
            errors.append(f"{where}: ders '{r['Ders']}' beklenmiyor")
        if not n.isdigit() or n in seen_src:
            errors.append(f"{where}: kaynak satır no geçersiz/tekrarlı")
        seen_src.add(n)
        if not r['Tema No'].isdigit():
            errors.append(f"{where}: tema no tam sayı değil")
        code = r['Öğrenme Çıktısı Kodu']
        if not re.fullmatch(rf'T\.[DKOY]\.{grade}\.\d{{1,2}}', code):
            errors.append(f"{where}: kod biçimi/sınıf uyumsuz '{code}'")
        lab = r['Bileşen Harfi']
        if lab not in TR_LETTERS:
            errors.append(f"{where}: bileşen harfi geçersiz '{lab}'")
        k = (r['Tema No'], key(code), key(lab))
        if k in seen_key:
            errors.append(f"{where}: mükerrer (tema, kod, harf) {k}")
        seen_key.add(k)
        for col in (OUTCOME_FIELD, COMPONENT_FIELD):
            for pat, msg in CONTAMINATION:
                if pat.search(r[col]):
                    errors.append(f"{where}: {col}: {msg}")
            if INVISIBLE.search(r[col]) or '  ' in r[col] or r[col] != r[col].strip():
                warnings.append(f"{where}: {col}: görünmez karakter/fazla boşluk")
            if unicodedata.normalize('NFC', r[col]) != r[col]:
                warnings.append(f"{where}: {col}: NFC dışı Unicode")
        t = r['Tema No']
        theme_name.setdefault(t, set()).add(r['Tema Adı'])
        theme_url.setdefault(t, set()).add(r['MEB Kaynak URL'])
        to_text[(t, key(code))].add(r[OUTCOME_FIELD])
        code_text[key(code)].add(r[OUTCOME_FIELD])
    for t, v in theme_name.items():
        if len(v) > 1: errors.append(f"tema {t}: birden fazla tema adı")
    for t, v in theme_url.items():
        if len(v) > 1: errors.append(f"tema {t}: birden fazla kaynak URL")
    urls = [next(iter(v)) for v in theme_url.values()]
    if len(set(urls)) != len(urls):
        errors.append("farklı temalar aynı kaynak URL'yi kullanıyor")
    for k2, v in to_text.items():
        if len(v) > 1: errors.append(f"tema {k2[0]} / {k2[1]}: aynı tema içinde farklı kazanım metni")
    conflicts = sorted(c for c, v in code_text.items() if len(v) > 1)
    for c in conflicts:
        warnings.append(f"{c}: temalar arasında farklı kazanım metni (karar gerektirir; aynen korunur)")
    return g, errors, warnings, conflicts


def build_sql(g, grade, subset_sha, full_sha, file_name, warnings, conflicts):
    V = uid('version', VERSION_CODE)
    G = uid('grade', VERSION_CODE, grade)
    B = uid('batch', VERSION_CODE, grade, subset_sha)
    themes = OrderedDict()
    for r in sorted(g, key=lambda r: int(r['Kaynak CSV Satırı'])):
        themes.setdefault(int(r['Tema No']), r)
    out = io.StringIO()
    w = out.write
    w(f"-- PDRPUSULA BEP — Türkçe {grade}. sınıf HAZIRLIK (staging) aktarımı. MIGRATION DEĞİLDİR.\n")
    w(f"-- Üreten: {VALIDATOR_VERSION}. Kaynak: {file_name}\n")
    w(f"-- Tam dosya SHA-256: {full_sha}\n-- {grade}. sınıf alt küme SHA-256: {subset_sha}\n")
    w("-- Kanonik kayıt, karar ve yayın içermez; tüm eşleşmeler 'unmapped' kalır; öğretmen kataloğu boş kalır.\n")
    w("-- Tek transaction olarak çalıştırılmalıdır. Sürüm zaten varsa hiçbir şey yazmadan durur.\n")
    w("BEGIN;\n")
    w(f"DO $$ BEGIN IF EXISTS (SELECT 1 FROM public.curriculum_versions v JOIN public.curriculum_subjects s ON s.id = v.subject_id "
      f"WHERE s.code = {q(SUBJECT_CODE)} AND v.version_code = {q(VERSION_CODE)}) OR EXISTS (SELECT 1 FROM public.curriculum_versions WHERE id = {q(V)}) "
      f"THEN RAISE EXCEPTION 'Sürüm {VERSION_CODE} zaten var; aktarım durduruldu'; END IF; END $$;\n")
    w(f"INSERT INTO public.curriculum_subjects(code, name) VALUES ({q(SUBJECT_CODE)}, {q(SUBJECT_NAME)}) ON CONFLICT (code) DO NOTHING;\n")
    sub = f"(SELECT id FROM public.curriculum_subjects WHERE code = {q(SUBJECT_CODE)})"
    w(f"INSERT INTO public.curriculum_versions(id, subject_id, version_code, title) VALUES ({q(V)}, {sub}, {q(VERSION_CODE)}, {q(VERSION_TITLE)});\n")
    for t, r in themes.items():
        w(f"INSERT INTO public.curriculum_source_documents(id, version_id, doc_type, grade, theme_no, title, publisher, url) VALUES "
          f"({q(uid('doc', VERSION_CODE, grade, t))}, {q(V)}, 'theme_page', {grade}, {t}, {q(r['Tema Adı'])}, 'MEB', {q(r['MEB Kaynak URL'])});\n")
    w(f"INSERT INTO public.curriculum_grades(id, version_id, subject_id, grade) VALUES ({q(G)}, {q(V)}, {sub}, {grade});\n")
    report = {"source_file": file_name, "full_file_sha256": full_sha, "subset": f"Sınıf = {grade}",
              "subset_sha256": subset_sha, "rows": len(g), "themes": len(themes),
              "normalization": "anahtar = NFC + baş/son boşluk; harf dönüşümü yok",
              "warnings": warnings, "code_text_conflicts": conflicts}
    w(f"INSERT INTO public.curriculum_import_batches(id, version_id, file_name, file_sha256, row_count, error_count, warning_count, validation_report, validator_version) VALUES "
      f"({q(B)}, {q(V)}, {q(file_name + f' [Sınıf={grade}]')}, {q(subset_sha)}, {len(g)}, 0, {len(warnings)}, {q(json.dumps(report, ensure_ascii=False))}::jsonb, {q(VALIDATOR_VERSION)});\n")
    for r in g:
        n = int(r['Kaynak CSV Satırı'])
        issues = [f"{key(r['Öğrenme Çıktısı Kodu'])}: temalar arasında farklı kazanım metni"] if key(r['Öğrenme Çıktısı Kodu']) in conflicts else []
        rj = row_json(r)
        w(f"INSERT INTO public.curriculum_import_rows(id, batch_id, source_row_no, raw_values, raw_sha256, grade, theme_no, published_code, published_label, row_status, issues) VALUES "
          f"({q(uid('row', B, n))}, {q(B)}, {n}, {q(rj)}::jsonb, {q(hashlib.sha256(rj.encode('utf-8')).hexdigest())}, {grade}, {int(r['Tema No'])}, "
          f"{q(r['Öğrenme Çıktısı Kodu'])}, {q(r['Bileşen Harfi'])}, {q('warning' if issues else 'ok')}, {q(json.dumps(issues, ensure_ascii=False))}::jsonb);\n")
    for t, r in themes.items():
        w(f"INSERT INTO public.curriculum_themes(id, version_id, grade_id, theme_no, published_name, source_document_id, sort_order) VALUES "
          f"({q(uid('theme', G, t))}, {q(V)}, {q(G)}, {t}, {q(r['Tema Adı'])}, {q(uid('doc', VERSION_CODE, grade, t))}, {t});\n")
    to_ids, to_order, comp_order = {}, Counter(), Counter()
    for r in sorted(g, key=lambda r: int(r['Kaynak CSV Satırı'])):
        t, code = int(r['Tema No']), r['Öğrenme Çıktısı Kodu']
        tk = (t, key(code))
        if tk not in to_ids:
            to_order[t] += 1
            to_ids[tk] = uid('theme_outcome', G, t, key(code))
            w(f"INSERT INTO public.curriculum_theme_outcomes(id, version_id, grade_id, theme_id, published_code, published_code_key, published_text, import_row_id, source_field, source_document_id, sort_order_in_theme) VALUES "
              f"({q(to_ids[tk])}, {q(V)}, {q(G)}, {q(uid('theme', G, t))}, {q(code)}, {q(key(code))}, {q(r[OUTCOME_FIELD])}, "
              f"{q(uid('row', B, int(r['Kaynak CSV Satırı'])))}, {q(OUTCOME_FIELD)}, {q(uid('doc', VERSION_CODE, grade, t))}, {to_order[t]});\n")
        comp_order[tk] += 1
        n = int(r['Kaynak CSV Satırı'])
        w(f"INSERT INTO public.curriculum_theme_components(id, theme_outcome_id, theme_id, published_label, published_label_key, published_text, import_row_id, source_field, sort_order_in_theme) VALUES "
          f"({q(uid('theme_component', B, n))}, {q(to_ids[tk])}, {q(uid('theme', G, t))}, {q(r['Bileşen Harfi'])}, {q(key(r['Bileşen Harfi']))}, "
          f"{q(r[COMPONENT_FIELD])}, {q(uid('row', B, n))}, {q(COMPONENT_FIELD)}, {comp_order[tk]});\n")
    w("COMMIT;\n")
    return out.getvalue(), report, {"rows": len(g), "themes": len(themes), "theme_outcomes": len(to_ids), "theme_components": len(g),
                                    "source_documents": len(themes), "warning_rows": sum(1 for r in g if key(r['Öğrenme Çıktısı Kodu']) in conflicts),
                                    "version_id": V, "grade_id": G, "batch_id": B}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('csv'); ap.add_argument('--grade', type=int, required=True); ap.add_argument('--out-dir', required=True)
    a = ap.parse_args()
    raw = open(a.csv, 'rb').read()
    full_sha = hashlib.sha256(raw).hexdigest()
    text = raw.decode('utf-8-sig')
    reader = csv.DictReader(io.StringIO(text, newline=''))
    if reader.fieldnames != EXPECTED_COLUMNS:
        sys.exit(f"HATA: sütunlar beklenenle aynı değil: {reader.fieldnames}")
    rows = list(reader)
    g, errors, warnings, *rest = validate(rows, a.grade)
    conflicts = rest[0] if rest else []
    import os
    os.makedirs(a.out_dir, exist_ok=True)
    base = os.path.join(a.out_dir, f"tr_grade{a.grade}")
    subset_sha = hashlib.sha256("\n".join(row_json(r) for r in sorted(g, key=lambda r: int(r['Kaynak CSV Satırı']))).encode('utf-8')).hexdigest()
    summary = {"validator_version": VALIDATOR_VERSION, "source_file": os.path.basename(a.csv), "full_file_sha256": full_sha,
               "full_file_rows": len(rows), "grade": a.grade, "subset_sha256": subset_sha, "errors": errors, "warnings": warnings}
    if errors:
        json.dump(summary, open(base + "_validation_report.json", 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
        sys.exit(f"HATA: {len(errors)} doğrulama hatası; SQL üretilmedi. Rapor: {base}_validation_report.json")
    sql, report, counts = build_sql(g, a.grade, subset_sha, full_sha, os.path.basename(a.csv), warnings, conflicts)
    summary["expected_counts"] = counts
    open(base + "_staging_seed.sql", 'w', encoding='utf-8').write(sql)
    json.dump(summary, open(base + "_validation_report.json", 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    print(json.dumps({"errors": 0, "warnings": len(warnings), **counts}, ensure_ascii=False))


if __name__ == '__main__':
    main()
