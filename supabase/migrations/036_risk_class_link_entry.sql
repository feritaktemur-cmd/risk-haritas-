-- =====================================================================
-- 036: Okul Risk Haritası — Sınıfa özel bağlantıyla öğrenci veri girişi
-- ---------------------------------------------------------------------
-- YALNIZCA YENİ NESNELER eklenir. Mevcut tablolar (students,
-- student_class_enrollments, student_risks, student_risk_assessments,
-- risk_categories ...), mevcut fonksiyonlar, tetikleyiciler ve manuel veri
-- girişi DEĞİŞMEZ.
--
-- Akış:
--   1) Okul, sınıf + aktif eğitim yılı için bağlantı oluşturur
--      (risk_link_create). Veritabanında yalnızca token hash'i tutulur.
--   2) Öğrenci bağlantıyla formu gönderir (risk_link_submit). Yanıt
--      YALNIZCA bekleme alanına (risk_link_pending_*) yazılır; Risk
--      Haritası ve istatistikler bu tabloları OKUMAZ.
--   3) Rehber öğretmen yanıtı reddeder (risk_link_reject) veya onaylar
--      (risk_link_approve). Onay tek transaction'da: öğrenci eşleştirme /
--      yeni kayıt + sınıf kaydı + student_risks + student_risk_assessments.
--      Tamamlanmış değerlendirmenin üzerine ASLA yazılmaz.
--
-- Erişim: üç tablo da RLS açık + politikasız; anon/authenticated hiçbir
-- yetkiye sahip değildir. service_role yalnızca SELECT yapabilir; tüm
-- yazmalar SECURITY DEFINER fonksiyonlarla yapılır. Okul kimliği backend
-- tarafından doğrulanmış oturumdan verilir ve fonksiyon içinde okul
-- hesabıyla yeniden doğrulanır.
--
-- Hata kodları (SQLSTATE, sınıf RK):
--   RK400 geçersiz girdi · RK403 yetkisiz hesap · RK404 bulunamadı
--   RK409 durum çakışması (MESSAGE alanı ayrıntıyı verir) · RK410 bağlantı geçersiz
-- =====================================================================
BEGIN;

DO $$
BEGIN
 IF to_regclass('public.student_risk_assessments') IS NULL
    OR to_regclass('public.risk_categories') IS NULL THEN
   RAISE EXCEPTION '036: önce 009-011 migration''ları uygulanmalı';
 END IF;
 IF to_regclass('public.risk_class_links') IS NOT NULL THEN
   RAISE EXCEPTION '036 zaten uygulanmış';
 END IF;
END $$;

-- ---------------------------------------------------------------------
-- 1. Tablolar
-- ---------------------------------------------------------------------
CREATE TABLE public.risk_class_links (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
 school_class_id uuid NOT NULL REFERENCES public.school_classes(id) ON DELETE RESTRICT,
 academic_year_id uuid NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
 token_hash text NOT NULL,
 is_active boolean NOT NULL DEFAULT true,
 expires_at timestamptz NULL,
 created_by_account_id uuid NOT NULL REFERENCES public.school_accounts(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 deactivated_at timestamptz NULL,
 deactivated_by_account_id uuid NULL REFERENCES public.school_accounts(id) ON DELETE RESTRICT,
 CONSTRAINT uq_risk_class_links_token_hash UNIQUE (token_hash),
 CONSTRAINT chk_risk_class_links_token_hash CHECK (token_hash ~ '^[0-9a-f]{64}$'),
 CONSTRAINT chk_risk_class_links_expiry CHECK (expires_at IS NULL OR expires_at > created_at),
 CONSTRAINT chk_risk_class_links_deactivation CHECK (
   (is_active AND deactivated_at IS NULL AND deactivated_by_account_id IS NULL)
   OR (NOT is_active AND deactivated_at IS NOT NULL AND deactivated_by_account_id IS NOT NULL)),
 CONSTRAINT uq_risk_class_links_id_scope UNIQUE (id, school_id, school_class_id, academic_year_id)
);
-- Bir sınıf + yıl için aynı anda yalnızca bir aktif bağlantı.
CREATE UNIQUE INDEX ux_risk_class_links_one_active
 ON public.risk_class_links (school_class_id, academic_year_id) WHERE is_active;
CREATE INDEX ix_risk_class_links_school ON public.risk_class_links (school_id, academic_year_id);

CREATE TABLE public.risk_link_pending_responses (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 link_id uuid NOT NULL,
 school_id uuid NOT NULL,
 school_class_id uuid NOT NULL,
 academic_year_id uuid NOT NULL,
 first_name text NOT NULL,
 last_name text NOT NULL,
 student_number text NOT NULL,
 status text NOT NULL DEFAULT 'pending',
 submitted_at timestamptz NOT NULL DEFAULT now(),
 decided_at timestamptz NULL,
 decided_by_account_id uuid NULL REFERENCES public.school_accounts(id) ON DELETE RESTRICT,
 reject_reason text NULL,
 matched_student_id uuid NULL REFERENCES public.students(id) ON DELETE RESTRICT,
 created_student boolean NULL,
 CONSTRAINT fk_risk_pending_link_scope FOREIGN KEY (link_id, school_id, school_class_id, academic_year_id)
   REFERENCES public.risk_class_links (id, school_id, school_class_id, academic_year_id) ON DELETE RESTRICT,
 CONSTRAINT chk_risk_pending_status CHECK (status IN ('pending', 'approved', 'rejected')),
 CONSTRAINT chk_risk_pending_first_name CHECK (first_name = btrim(first_name) AND char_length(first_name) BETWEEN 1 AND 60),
 CONSTRAINT chk_risk_pending_last_name CHECK (last_name = btrim(last_name) AND char_length(last_name) BETWEEN 1 AND 60),
 CONSTRAINT chk_risk_pending_student_number CHECK (student_number ~ '^[0-9A-Za-z-]{1,20}$'),
 CONSTRAINT chk_risk_pending_reason CHECK (reject_reason IS NULL OR char_length(reject_reason) BETWEEN 1 AND 300),
 CONSTRAINT chk_risk_pending_decision CHECK (
   (status = 'pending' AND decided_at IS NULL AND decided_by_account_id IS NULL
      AND matched_student_id IS NULL AND created_student IS NULL AND reject_reason IS NULL)
   OR (status = 'approved' AND decided_at IS NOT NULL AND decided_by_account_id IS NOT NULL
      AND matched_student_id IS NOT NULL AND created_student IS NOT NULL AND reject_reason IS NULL)
   OR (status = 'rejected' AND decided_at IS NOT NULL AND decided_by_account_id IS NOT NULL
      AND matched_student_id IS NULL AND created_student IS NULL))
);
CREATE INDEX ix_risk_pending_school_status ON public.risk_link_pending_responses (school_id, academic_year_id, status, submitted_at DESC);
CREATE INDEX ix_risk_pending_class ON public.risk_link_pending_responses (school_class_id, academic_year_id);
-- Olası tekrar aramaları için (okul numarası / ad soyad).
CREATE INDEX ix_risk_pending_number ON public.risk_link_pending_responses (school_id, academic_year_id, student_number);
CREATE INDEX ix_risk_pending_name ON public.risk_link_pending_responses (school_id, academic_year_id, lower(first_name), lower(last_name));

CREATE TABLE public.risk_link_pending_answers (
 pending_response_id uuid NOT NULL REFERENCES public.risk_link_pending_responses(id) ON DELETE RESTRICT,
 risk_category_id uuid NOT NULL REFERENCES public.risk_categories(id) ON DELETE RESTRICT,
 note text NULL,
 PRIMARY KEY (pending_response_id, risk_category_id),
 CONSTRAINT chk_risk_pending_answer_note CHECK (note IS NULL OR (note = btrim(note) AND char_length(note) BETWEEN 1 AND 500))
);

-- ---------------------------------------------------------------------
-- 2. Tetikleyiciler (bütünlük ve değişmezlik)
-- ---------------------------------------------------------------------
CREATE FUNCTION public.risk_link_reject_mutation() RETURNS trigger
 LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
 RAISE EXCEPTION 'risk link record cannot be modified this way (%: %)', TG_TABLE_NAME, TG_OP;
END $$;

CREATE FUNCTION public.risk_link_guard_link() RETURNS trigger
 LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
 IF TG_OP = 'INSERT' THEN
   IF NOT NEW.is_active THEN RAISE EXCEPTION 'new risk link must be active'; END IF;
   IF NOT EXISTS (SELECT 1 FROM public.school_classes c WHERE c.id = NEW.school_class_id AND c.school_id = NEW.school_id) THEN
     RAISE EXCEPTION 'risk link class does not belong to school';
   END IF;
   IF NOT EXISTS (SELECT 1 FROM public.school_accounts a WHERE a.id = NEW.created_by_account_id AND a.school_id = NEW.school_id) THEN
     RAISE EXCEPTION 'risk link creator does not belong to school';
   END IF;
   RETURN NEW;
 END IF;
 -- UPDATE: yalnızca aktif -> pasif geçişi
 IF NOT OLD.is_active OR NEW.is_active
    OR (to_jsonb(NEW) - 'is_active' - 'deactivated_at' - 'deactivated_by_account_id')
       IS DISTINCT FROM (to_jsonb(OLD) - 'is_active' - 'deactivated_at' - 'deactivated_by_account_id') THEN
   RAISE EXCEPTION 'risk link can only be deactivated once';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.school_accounts a WHERE a.id = NEW.deactivated_by_account_id AND a.school_id = NEW.school_id) THEN
   RAISE EXCEPTION 'risk link deactivator does not belong to school';
 END IF;
 RETURN NEW;
END $$;

CREATE FUNCTION public.risk_link_guard_pending() RETURNS trigger
 LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
 IF TG_OP = 'INSERT' THEN
   IF NEW.status <> 'pending' THEN RAISE EXCEPTION 'pending response must start as pending'; END IF;
   RETURN NEW;
 END IF;
 -- UPDATE: yalnızca pending -> approved/rejected ve yalnızca karar alanları
 IF OLD.status <> 'pending' OR NEW.status = 'pending'
    OR (to_jsonb(NEW) - 'status' - 'decided_at' - 'decided_by_account_id' - 'reject_reason' - 'matched_student_id' - 'created_student')
       IS DISTINCT FROM (to_jsonb(OLD) - 'status' - 'decided_at' - 'decided_by_account_id' - 'reject_reason' - 'matched_student_id' - 'created_student') THEN
   RAISE EXCEPTION 'pending response can only be decided once';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.school_accounts a WHERE a.id = NEW.decided_by_account_id AND a.school_id = NEW.school_id) THEN
   RAISE EXCEPTION 'decider does not belong to school';
 END IF;
 IF NEW.matched_student_id IS NOT NULL AND NOT EXISTS (
     SELECT 1 FROM public.students s WHERE s.id = NEW.matched_student_id AND s.school_id = NEW.school_id) THEN
   RAISE EXCEPTION 'matched student does not belong to school';
 END IF;
 RETURN NEW;
END $$;

CREATE FUNCTION public.risk_link_guard_answer() RETURNS trigger
 LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
 v_requires_note boolean;
 v_active boolean;
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.risk_link_pending_responses p
                WHERE p.id = NEW.pending_response_id AND p.status = 'pending') THEN
   RAISE EXCEPTION 'answers can only be added to a pending response';
 END IF;
 SELECT rc.requires_note, rc.is_active INTO v_requires_note, v_active
 FROM public.risk_categories rc WHERE rc.id = NEW.risk_category_id;
 IF NOT coalesce(v_active, false) THEN RAISE EXCEPTION 'risk category is not active'; END IF;
 IF v_requires_note AND NEW.note IS NULL THEN RAISE EXCEPTION 'note is required for this risk category'; END IF;
 IF NOT v_requires_note AND NEW.note IS NOT NULL THEN RAISE EXCEPTION 'note is not allowed for this risk category'; END IF;
 RETURN NEW;
END $$;

CREATE TRIGGER risk_class_links_guard BEFORE INSERT OR UPDATE ON public.risk_class_links
 FOR EACH ROW EXECUTE FUNCTION public.risk_link_guard_link();
CREATE TRIGGER risk_class_links_delete_guard BEFORE DELETE ON public.risk_class_links
 FOR EACH ROW EXECUTE FUNCTION public.risk_link_reject_mutation();
CREATE TRIGGER risk_class_links_truncate_guard BEFORE TRUNCATE ON public.risk_class_links
 FOR EACH STATEMENT EXECUTE FUNCTION public.risk_link_reject_mutation();

CREATE TRIGGER risk_link_pending_guard BEFORE INSERT OR UPDATE ON public.risk_link_pending_responses
 FOR EACH ROW EXECUTE FUNCTION public.risk_link_guard_pending();
CREATE TRIGGER risk_link_pending_delete_guard BEFORE DELETE ON public.risk_link_pending_responses
 FOR EACH ROW EXECUTE FUNCTION public.risk_link_reject_mutation();
CREATE TRIGGER risk_link_pending_truncate_guard BEFORE TRUNCATE ON public.risk_link_pending_responses
 FOR EACH STATEMENT EXECUTE FUNCTION public.risk_link_reject_mutation();

CREATE TRIGGER risk_link_answers_insert_guard BEFORE INSERT ON public.risk_link_pending_answers
 FOR EACH ROW EXECUTE FUNCTION public.risk_link_guard_answer();
CREATE TRIGGER risk_link_answers_mutation_guard BEFORE UPDATE OR DELETE ON public.risk_link_pending_answers
 FOR EACH ROW EXECUTE FUNCTION public.risk_link_reject_mutation();
CREATE TRIGGER risk_link_answers_truncate_guard BEFORE TRUNCATE ON public.risk_link_pending_answers
 FOR EACH STATEMENT EXECUTE FUNCTION public.risk_link_reject_mutation();

-- ---------------------------------------------------------------------
-- 3. Yardımcılar
-- ---------------------------------------------------------------------
CREATE FUNCTION public.risk_link_assert_school_account(p_school_id uuid, p_account_id uuid) RETURNS void
 LANGUAGE plpgsql STABLE SET search_path = '' AS $$
BEGIN
 IF p_school_id IS NULL OR p_account_id IS NULL OR NOT EXISTS (
   SELECT 1 FROM public.school_accounts a
   WHERE a.id = p_account_id AND a.school_id = p_school_id
     AND a.is_active AND NOT a.must_change_password) THEN
   RAISE EXCEPTION USING ERRCODE = 'RK403', MESSAGE = 'risk_link_account_not_authorized';
 END IF;
END $$;

-- ---------------------------------------------------------------------
-- 4. RPC: bağlantı oluşturma / yenileme (aktif eğitim yılı)
-- ---------------------------------------------------------------------
CREATE FUNCTION public.risk_link_create(
 p_school_id uuid, p_actor_account_id uuid, p_school_class_id uuid, p_token_hash text, p_expires_at timestamptz
) RETURNS uuid
 LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 v_year uuid;
 v_id uuid;
BEGIN
 PERFORM public.risk_link_assert_school_account(p_school_id, p_actor_account_id);
 IF p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$' THEN
   RAISE EXCEPTION USING ERRCODE = 'RK400', MESSAGE = 'risk_link_invalid_token_hash';
 END IF;
 IF p_expires_at IS NOT NULL AND p_expires_at <= now() THEN
   RAISE EXCEPTION USING ERRCODE = 'RK400', MESSAGE = 'risk_link_invalid_expiry';
 END IF;
 PERFORM 1 FROM public.school_classes c WHERE c.id = p_school_class_id AND c.school_id = p_school_id FOR SHARE;
 IF NOT FOUND THEN
   RAISE EXCEPTION USING ERRCODE = 'RK404', MESSAGE = 'risk_link_class_not_found';
 END IF;
 SELECT y.id INTO v_year FROM public.academic_years y WHERE y.is_active;
 IF v_year IS NULL THEN
   RAISE EXCEPTION USING ERRCODE = 'RK409', MESSAGE = 'risk_link_no_active_year';
 END IF;
 -- Eski aktif bağlantı (varsa) kapatılır: yenileme.
 UPDATE public.risk_class_links
    SET is_active = false, deactivated_at = now(), deactivated_by_account_id = p_actor_account_id
  WHERE school_class_id = p_school_class_id AND academic_year_id = v_year AND is_active;
 INSERT INTO public.risk_class_links (school_id, school_class_id, academic_year_id, token_hash, expires_at, created_by_account_id)
 VALUES (p_school_id, p_school_class_id, v_year, p_token_hash, p_expires_at, p_actor_account_id)
 RETURNING id INTO v_id;
 RETURN v_id;
EXCEPTION WHEN unique_violation THEN
 RAISE EXCEPTION USING ERRCODE = 'RK409', MESSAGE = 'risk_link_conflict';
END $$;

CREATE FUNCTION public.risk_link_deactivate(p_link_id uuid, p_school_id uuid, p_actor_account_id uuid) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 PERFORM public.risk_link_assert_school_account(p_school_id, p_actor_account_id);
 UPDATE public.risk_class_links
    SET is_active = false, deactivated_at = now(), deactivated_by_account_id = p_actor_account_id
  WHERE id = p_link_id AND school_id = p_school_id AND is_active;
 IF NOT FOUND THEN
   RAISE EXCEPTION USING ERRCODE = 'RK404', MESSAGE = 'risk_link_not_found';
 END IF;
END $$;

-- ---------------------------------------------------------------------
-- 5. RPC: herkese açık form gönderimi (yalnızca bekleme alanına yazar)
--    p_items: [{"risk_category_id": "<uuid>", "note": "<metin|null>"}, ...]
--    Boş dizi geçerlidir ("risk yok").
-- ---------------------------------------------------------------------
CREATE FUNCTION public.risk_link_submit(
 p_token_hash text, p_first_name text, p_last_name text, p_student_number text, p_items jsonb
) RETURNS uuid
 LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 l public.risk_class_links%ROWTYPE;
 v_first text := btrim(coalesce(p_first_name, ''));
 v_last text := btrim(coalesce(p_last_name, ''));
 v_number text := btrim(coalesce(p_student_number, ''));
 v_id uuid;
 v_item jsonb;
 v_cat uuid;
 v_note text;
 v_requires boolean;
 v_seen uuid[] := '{}';
BEGIN
 IF p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$' THEN
   RAISE EXCEPTION USING ERRCODE = 'RK410', MESSAGE = 'risk_link_invalid';
 END IF;
 SELECT k.* INTO l FROM public.risk_class_links k
  JOIN public.academic_years y ON y.id = k.academic_year_id AND y.is_active
  WHERE k.token_hash = p_token_hash AND k.is_active AND (k.expires_at IS NULL OR k.expires_at > now())
  FOR SHARE OF k;
 IF NOT FOUND THEN
   RAISE EXCEPTION USING ERRCODE = 'RK410', MESSAGE = 'risk_link_invalid';
 END IF;
 IF char_length(v_first) NOT BETWEEN 1 AND 60 OR char_length(v_last) NOT BETWEEN 1 AND 60 THEN
   RAISE EXCEPTION USING ERRCODE = 'RK400', MESSAGE = 'risk_link_invalid_name';
 END IF;
 IF v_number !~ '^[0-9A-Za-z-]{1,20}$' THEN
   RAISE EXCEPTION USING ERRCODE = 'RK400', MESSAGE = 'risk_link_invalid_student_number';
 END IF;
 IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) > 100 THEN
   RAISE EXCEPTION USING ERRCODE = 'RK400', MESSAGE = 'risk_link_invalid_items';
 END IF;

 INSERT INTO public.risk_link_pending_responses
   (link_id, school_id, school_class_id, academic_year_id, first_name, last_name, student_number)
 VALUES (l.id, l.school_id, l.school_class_id, l.academic_year_id, v_first, v_last, v_number)
 RETURNING id INTO v_id;

 FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
   IF jsonb_typeof(v_item) <> 'object'
      OR jsonb_typeof(v_item -> 'risk_category_id') IS DISTINCT FROM 'string'
      OR (v_item ? 'note' AND jsonb_typeof(v_item -> 'note') NOT IN ('string', 'null'))
      OR (v_item -> 'risk_category_id' #>> '{}') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
     RAISE EXCEPTION USING ERRCODE = 'RK400', MESSAGE = 'risk_link_invalid_items';
   END IF;
   v_cat := (v_item ->> 'risk_category_id')::uuid;
   IF v_cat = ANY (v_seen) THEN
     RAISE EXCEPTION USING ERRCODE = 'RK400', MESSAGE = 'risk_link_duplicate_item';
   END IF;
   v_seen := v_seen || v_cat;
   SELECT rc.requires_note INTO v_requires FROM public.risk_categories rc WHERE rc.id = v_cat AND rc.is_active;
   IF NOT FOUND THEN
     RAISE EXCEPTION USING ERRCODE = 'RK400', MESSAGE = 'risk_link_invalid_items';
   END IF;
   v_note := nullif(btrim(coalesce(v_item ->> 'note', '')), '');
   IF v_requires AND v_note IS NULL THEN
     RAISE EXCEPTION USING ERRCODE = 'RK400', MESSAGE = 'risk_link_note_required';
   END IF;
   IF v_note IS NOT NULL AND char_length(v_note) > 500 THEN
     RAISE EXCEPTION USING ERRCODE = 'RK400', MESSAGE = 'risk_link_note_too_long';
   END IF;
   INSERT INTO public.risk_link_pending_answers (pending_response_id, risk_category_id, note)
   VALUES (v_id, v_cat, CASE WHEN v_requires THEN v_note END);
 END LOOP;
 RETURN v_id;
END $$;

-- ---------------------------------------------------------------------
-- 6. RPC: reddetme
-- ---------------------------------------------------------------------
CREATE FUNCTION public.risk_link_reject(
 p_pending_id uuid, p_school_id uuid, p_actor_account_id uuid, p_reason text
) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 v_status text;
 v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
BEGIN
 PERFORM public.risk_link_assert_school_account(p_school_id, p_actor_account_id);
 IF v_reason IS NOT NULL AND char_length(v_reason) > 300 THEN
   RAISE EXCEPTION USING ERRCODE = 'RK400', MESSAGE = 'risk_link_reason_too_long';
 END IF;
 SELECT p.status INTO v_status FROM public.risk_link_pending_responses p
  WHERE p.id = p_pending_id AND p.school_id = p_school_id FOR UPDATE;
 IF NOT FOUND THEN
   RAISE EXCEPTION USING ERRCODE = 'RK404', MESSAGE = 'risk_link_pending_not_found';
 END IF;
 IF v_status <> 'pending' THEN
   RAISE EXCEPTION USING ERRCODE = 'RK409', MESSAGE = 'risk_link_already_decided';
 END IF;
 UPDATE public.risk_link_pending_responses
    SET status = 'rejected', decided_at = now(), decided_by_account_id = p_actor_account_id, reject_reason = v_reason
  WHERE id = p_pending_id;
END $$;

-- ---------------------------------------------------------------------
-- 7. RPC: onaylama (tek transaction; ya hep ya hiç)
--    p_student_id NULL  -> okul numarasıyla Havuz'da kayıt YOKSA yeni öğrenci
--                          oluşturulur; varsa RK409 student_number_exists
--                          (öğretmen açıkça eşleştirmelidir).
--    p_student_id dolu  -> aynı okuldaki mevcut öğrenciyle eşleştirilir.
--    Tamamlanmış değerlendirme veya mevcut risk satırı varsa RK409; üzerine
--    yazılmaz.
-- ---------------------------------------------------------------------
CREATE FUNCTION public.risk_link_approve(
 p_pending_id uuid, p_school_id uuid, p_actor_account_id uuid, p_student_id uuid
) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 p public.risk_link_pending_responses%ROWTYPE;
 v_student uuid;
 v_status text;
 v_created boolean := false;
 v_enr_class uuid;
BEGIN
 PERFORM public.risk_link_assert_school_account(p_school_id, p_actor_account_id);

 SELECT x.* INTO p FROM public.risk_link_pending_responses x
  WHERE x.id = p_pending_id AND x.school_id = p_school_id FOR UPDATE;
 IF NOT FOUND THEN
   RAISE EXCEPTION USING ERRCODE = 'RK404', MESSAGE = 'risk_link_pending_not_found';
 END IF;
 IF p.status <> 'pending' THEN
   RAISE EXCEPTION USING ERRCODE = 'RK409', MESSAGE = 'risk_link_already_decided';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.academic_years y WHERE y.id = p.academic_year_id AND y.is_active) THEN
   RAISE EXCEPTION USING ERRCODE = 'RK409', MESSAGE = 'risk_link_year_not_active';
 END IF;

 IF p_student_id IS NOT NULL THEN
   SELECT s.id, s.status INTO v_student, v_status FROM public.students s
    WHERE s.id = p_student_id AND s.school_id = p_school_id FOR UPDATE;
   IF NOT FOUND THEN
     RAISE EXCEPTION USING ERRCODE = 'RK404', MESSAGE = 'risk_link_student_not_found';
   END IF;
 ELSE
   IF EXISTS (SELECT 1 FROM public.students s WHERE s.school_id = p_school_id AND s.student_number = p.student_number) THEN
     RAISE EXCEPTION USING ERRCODE = 'RK409', MESSAGE = 'risk_link_student_number_exists';
   END IF;
   INSERT INTO public.students (school_id, student_number, first_name, last_name, status)
   VALUES (p_school_id, p.student_number, p.first_name, p.last_name, 'active')
   RETURNING id, status INTO v_student, v_status;
   v_created := true;
 END IF;

 IF v_status <> 'active' THEN
   RAISE EXCEPTION USING ERRCODE = 'RK409', MESSAGE = 'risk_link_student_not_active';
 END IF;

 SELECT e.school_class_id INTO v_enr_class FROM public.student_class_enrollments e
  WHERE e.student_id = v_student AND e.academic_year_id = p.academic_year_id FOR UPDATE;
 IF FOUND AND v_enr_class <> p.school_class_id THEN
   RAISE EXCEPTION USING ERRCODE = 'RK409', MESSAGE = 'risk_link_class_mismatch';
 END IF;

 IF EXISTS (SELECT 1 FROM public.student_risk_assessments a
            WHERE a.student_id = v_student AND a.academic_year_id = p.academic_year_id)
    OR EXISTS (SELECT 1 FROM public.student_risks r
               WHERE r.student_id = v_student AND r.academic_year_id = p.academic_year_id) THEN
   RAISE EXCEPTION USING ERRCODE = 'RK409', MESSAGE = 'risk_link_assessment_exists';
 END IF;

 IF v_enr_class IS NULL THEN
   INSERT INTO public.student_class_enrollments (student_id, school_id, school_class_id, academic_year_id)
   VALUES (v_student, p_school_id, p.school_class_id, p.academic_year_id);
 END IF;

 INSERT INTO public.student_risks (student_id, school_id, academic_year_id, risk_category_id, note)
 SELECT v_student, p_school_id, p.academic_year_id, a.risk_category_id, a.note
 FROM public.risk_link_pending_answers a
 JOIN public.risk_categories rc ON rc.id = a.risk_category_id AND rc.is_active
 WHERE a.pending_response_id = p.id;

 INSERT INTO public.student_risk_assessments (student_id, academic_year_id, school_id, completed_at)
 VALUES (v_student, p.academic_year_id, p_school_id, now());

 UPDATE public.risk_link_pending_responses
    SET status = 'approved', decided_at = now(), decided_by_account_id = p_actor_account_id,
        matched_student_id = v_student, created_student = v_created
  WHERE id = p.id;

 RETURN jsonb_build_object('student_id', v_student, 'created_student', v_created);
EXCEPTION WHEN unique_violation THEN
 -- Eşzamanlı onay / manuel kayıtla çakışma: tamamı geri alınır.
 RAISE EXCEPTION USING ERRCODE = 'RK409', MESSAGE = 'risk_link_concurrent_conflict';
END $$;

-- ---------------------------------------------------------------------
-- 8. RLS ve yetkiler
-- ---------------------------------------------------------------------
ALTER TABLE public.risk_class_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_link_pending_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_link_pending_answers ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text; f text;
BEGIN
 FOREACH t IN ARRAY ARRAY['risk_class_links', 'risk_link_pending_responses', 'risk_link_pending_answers'] LOOP
   EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated, service_role', t);
   EXECUTE format('GRANT SELECT ON TABLE public.%I TO service_role', t);
 END LOOP;
 FOREACH f IN ARRAY ARRAY[
   'public.risk_link_reject_mutation()', 'public.risk_link_guard_link()', 'public.risk_link_guard_pending()',
   'public.risk_link_guard_answer()', 'public.risk_link_assert_school_account(uuid, uuid)',
   'public.risk_link_create(uuid, uuid, uuid, text, timestamptz)', 'public.risk_link_deactivate(uuid, uuid, uuid)',
   'public.risk_link_submit(text, text, text, text, jsonb)', 'public.risk_link_reject(uuid, uuid, uuid, text)',
   'public.risk_link_approve(uuid, uuid, uuid, uuid)'] LOOP
   EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', f);
 END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.risk_link_create(uuid, uuid, uuid, text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.risk_link_deactivate(uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.risk_link_submit(text, text, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.risk_link_reject(uuid, uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.risk_link_approve(uuid, uuid, uuid, uuid) TO service_role;

COMMIT;
