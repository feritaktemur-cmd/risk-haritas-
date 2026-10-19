-- PDRPUSULA / DNA (Devamsızlık Nedenleri Anketi) / Migration 033
-- DURUM: UYGULANMADI. Canlıya yalnızca kullanıcı onayıyla, Supabase SQL Editor'da (postgres rolü) çalıştırılır.
-- Kaynak: 033_dna_foundation_TASLAK_v5.sql (sha256 dcaa8642...) düzeltilmiş hâli.
-- Kapsam: 12 DNA tablosu, bütünlük kısıtları, tetikleyiciler, RLS, ayrıcalıklar ve atomik RPC'ler.
-- Kapsam dışı: 034 katalog seed'i. Mevcut hiçbir tablo değiştirilmez.
-- Bağımlılıklar (canlı şemada doğrulandı): schools(id uuid), school_classes(id uuid),
-- academic_years(id uuid, is_active), school_accounts(id uuid, school_id uuid), districts(id smallint).
-- Hata kodları: DN403 yetki, DN404 bulunamadı, DN409 durum/çakışma, DN422 geçersiz girdi.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Katalog
-- ---------------------------------------------------------------------------
CREATE TABLE public.dna_catalogs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 catalog_code text NOT NULL CHECK (length(btrim(catalog_code)) > 0),
 catalog_version text NOT NULL CHECK (length(btrim(catalog_version)) > 0),
 source_file text NOT NULL,
 result_sheet_file text,
 item_count smallint NOT NULL DEFAULT 51 CHECK (item_count = 51),
 dimension_count smallint NOT NULL DEFAULT 7 CHECK (dimension_count = 7),
 open_text_prompt text NOT NULL CHECK (length(btrim(open_text_prompt)) > 0),
 open_text_max_length integer NOT NULL DEFAULT 2000 CHECK (open_text_max_length BETWEEN 1 AND 2000),
 is_active boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (catalog_code, catalog_version)
);
CREATE UNIQUE INDEX dna_catalog_one_active ON public.dna_catalogs (is_active) WHERE is_active;

CREATE TABLE public.dna_dimensions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 catalog_id uuid NOT NULL REFERENCES public.dna_catalogs(id) ON DELETE RESTRICT,
 dimension_no smallint NOT NULL CHECK (dimension_no BETWEEN 1 AND 7),
 name text NOT NULL CHECK (length(btrim(name)) > 0),
 first_item smallint NOT NULL CHECK (first_item BETWEEN 1 AND 51),
 last_item smallint NOT NULL CHECK (last_item BETWEEN 1 AND 51),
 item_count smallint NOT NULL CHECK (item_count > 0),
 UNIQUE (catalog_id, dimension_no),
 UNIQUE (id, catalog_id),
 CHECK (last_item >= first_item AND item_count = last_item - first_item + 1)
);

CREATE TABLE public.dna_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 catalog_id uuid NOT NULL REFERENCES public.dna_catalogs(id) ON DELETE RESTRICT,
 dimension_id uuid NOT NULL,
 item_no smallint NOT NULL CHECK (item_no BETWEEN 1 AND 51),
 text text NOT NULL CHECK (length(btrim(text)) > 0),
 source_page smallint CHECK (source_page BETWEEN 1 AND 3),
 UNIQUE (catalog_id, item_no),
 UNIQUE (id, catalog_id),
 FOREIGN KEY (dimension_id, catalog_id) REFERENCES public.dna_dimensions(id, catalog_id) ON DELETE RESTRICT
);

-- ---------------------------------------------------------------------------
-- 2. Uygulama, sınıflar, erişim bağlantısı
-- ---------------------------------------------------------------------------
CREATE TABLE public.dna_applications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
 academic_year_id uuid NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
 catalog_id uuid NOT NULL REFERENCES public.dna_catalogs(id) ON DELETE RESTRICT,
 name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
 status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','closed')),
 opened_at timestamptz,
 closed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 created_by_account_id uuid NOT NULL REFERENCES public.school_accounts(id) ON DELETE RESTRICT,
 UNIQUE (id, school_id),
 UNIQUE (id, catalog_id),
 UNIQUE (id, academic_year_id),
 CHECK ((status='draft' AND opened_at IS NULL AND closed_at IS NULL)
     OR (status='active' AND opened_at IS NOT NULL AND closed_at IS NULL)
     OR (status='closed' AND opened_at IS NOT NULL AND closed_at IS NOT NULL AND closed_at >= opened_at))
);
CREATE INDEX dna_applications_school_year_idx ON public.dna_applications(school_id, academic_year_id);

CREATE TABLE public.dna_application_classes (
 application_id uuid NOT NULL REFERENCES public.dna_applications(id) ON DELETE RESTRICT,
 school_class_id uuid NOT NULL REFERENCES public.school_classes(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (application_id, school_class_id)
);
CREATE INDEX dna_application_classes_class_idx ON public.dna_application_classes(school_class_id);

CREATE TABLE public.dna_access_links (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 application_id uuid NOT NULL UNIQUE REFERENCES public.dna_applications(id) ON DELETE RESTRICT,
 token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
 link_version integer NOT NULL DEFAULT 1 CHECK (link_version > 0),
 is_active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 deactivated_at timestamptz,
 CHECK ((is_active AND deactivated_at IS NULL) OR (NOT is_active AND deactivated_at IS NOT NULL))
);

-- ---------------------------------------------------------------------------
-- 3. Yanıtlar (students tablosuna bağ YOK; otomatik eşleştirme yapılmaz)
-- ---------------------------------------------------------------------------
CREATE TABLE public.dna_responses (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 application_id uuid NOT NULL,
 school_id uuid NOT NULL,
 school_class_id uuid NOT NULL,
 first_name text NOT NULL CHECK (first_name = btrim(first_name) AND char_length(first_name) BETWEEN 1 AND 60),
 last_name text NOT NULL CHECK (last_name = btrim(last_name) AND char_length(last_name) BETWEEN 1 AND 60),
 student_number text NOT NULL CHECK (student_number = btrim(student_number) AND char_length(student_number) BETWEEN 1 AND 20),
 student_number_norm text GENERATED ALWAYS AS (upper(regexp_replace(student_number, '[[:space:]]+', '', 'g'))) STORED,
 open_text text CHECK (open_text IS NULL OR (open_text = btrim(open_text) AND char_length(open_text) BETWEEN 1 AND 2000)),
 total_score smallint NOT NULL CHECK (total_score BETWEEN 0 AND 102),
 status text NOT NULL DEFAULT 'valid' CHECK (status IN ('valid','invalidated')),
 submitted_at timestamptz NOT NULL DEFAULT now(),
 invalidated_at timestamptz,
 invalidated_by_account_id uuid REFERENCES public.school_accounts(id) ON DELETE RESTRICT,
 invalidation_reason text,
 UNIQUE (id, application_id),
 FOREIGN KEY (application_id, school_id) REFERENCES public.dna_applications(id, school_id) ON DELETE RESTRICT,
 FOREIGN KEY (application_id, school_class_id) REFERENCES public.dna_application_classes(application_id, school_class_id) ON DELETE RESTRICT,
 CHECK ((status='valid' AND invalidated_at IS NULL AND invalidated_by_account_id IS NULL AND invalidation_reason IS NULL)
     OR (status='invalidated' AND invalidated_at IS NOT NULL AND invalidated_by_account_id IS NOT NULL
         AND char_length(btrim(invalidation_reason)) BETWEEN 10 AND 500))
);
CREATE UNIQUE INDEX dna_one_valid_response_per_student
 ON public.dna_responses(application_id, school_class_id, student_number_norm) WHERE status='valid';
CREATE INDEX dna_responses_application_status_idx ON public.dna_responses(application_id, status);

CREATE TABLE public.dna_answers (
 response_id uuid NOT NULL REFERENCES public.dna_responses(id) ON DELETE RESTRICT,
 item_id uuid NOT NULL REFERENCES public.dna_items(id) ON DELETE RESTRICT,
 value smallint NOT NULL CHECK (value BETWEEN 0 AND 2),
 PRIMARY KEY (response_id, item_id)
);

-- details alanına kişisel veri (ad, numara, açık uçlu metin) YAZILMAZ.
CREATE TABLE public.dna_audit_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 application_id uuid NOT NULL REFERENCES public.dna_applications(id) ON DELETE RESTRICT,
 response_id uuid,
 event_type text NOT NULL CHECK (event_type IN ('created','activated','class_set','response_submitted','response_invalidated','closed','submitted_to_ram')),
 actor_account_id uuid REFERENCES public.school_accounts(id) ON DELETE RESTRICT,
 reason text CHECK (reason IS NULL OR char_length(reason) <= 500),
 details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details) = 'object'),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (response_id, application_id) REFERENCES public.dna_responses(id, application_id) ON DELETE RESTRICT
);
CREATE INDEX dna_audit_events_application_idx ON public.dna_audit_events(application_id, created_at);

-- ---------------------------------------------------------------------------
-- 4. RAM'e isteğe bağlı toplu gönderim (değişmez anlık görüntü; kimlik/metin YOK)
-- ---------------------------------------------------------------------------
CREATE TABLE public.dna_ram_submissions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 application_id uuid NOT NULL UNIQUE REFERENCES public.dna_applications(id) ON DELETE RESTRICT,
 school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
 district_id smallint NOT NULL REFERENCES public.districts(id) ON DELETE RESTRICT,
 academic_year_id uuid NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
 catalog_id uuid NOT NULL REFERENCES public.dna_catalogs(id) ON DELETE RESTRICT,
 school_name text NOT NULL,
 district_name text NOT NULL,
 academic_year_name text NOT NULL,
 valid_response_count integer NOT NULL CHECK (valid_response_count >= 1),
 approved_by_account_id uuid NOT NULL REFERENCES public.school_accounts(id) ON DELETE RESTRICT,
 submitted_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (application_id, school_id) REFERENCES public.dna_applications(id, school_id) ON DELETE RESTRICT,
 FOREIGN KEY (application_id, catalog_id) REFERENCES public.dna_applications(id, catalog_id) ON DELETE RESTRICT,
 FOREIGN KEY (application_id, academic_year_id) REFERENCES public.dna_applications(id, academic_year_id) ON DELETE RESTRICT
);
CREATE INDEX dna_ram_submissions_district_year_idx ON public.dna_ram_submissions(district_id, academic_year_id);

CREATE TABLE public.dna_ram_submission_dimension_results (
 submission_id uuid NOT NULL REFERENCES public.dna_ram_submissions(id) ON DELETE RESTRICT,
 dimension_no smallint NOT NULL CHECK (dimension_no BETWEEN 1 AND 7),
 dimension_name text NOT NULL,
 item_count smallint NOT NULL CHECK (item_count > 0),
 dimension_item_total integer NOT NULL CHECK (dimension_item_total >= 0),
 dimension_average_official numeric(14,4) NOT NULL CHECK (dimension_average_official >= 0),
 PRIMARY KEY (submission_id, dimension_no)
);

CREATE TABLE public.dna_ram_submission_item_results (
 submission_id uuid NOT NULL REFERENCES public.dna_ram_submissions(id) ON DELETE RESTRICT,
 item_no smallint NOT NULL CHECK (item_no BETWEEN 1 AND 51),
 dimension_no smallint NOT NULL CHECK (dimension_no BETWEEN 1 AND 7),
 item_total integer NOT NULL CHECK (item_total >= 0),
 PRIMARY KEY (submission_id, item_no)
);

-- ---------------------------------------------------------------------------
-- 5. Yardımcı fonksiyonlar (dışarıya kapalı)
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.dna_catalog_is_complete(p_catalog_id uuid) RETURNS boolean
 LANGUAGE sql STABLE SET search_path = '' AS $$
 SELECT (SELECT count(*) FROM public.dna_dimensions d WHERE d.catalog_id = p_catalog_id) = 7
    AND (SELECT count(*) FROM public.dna_items i WHERE i.catalog_id = p_catalog_id) = 51
    AND (SELECT coalesce(sum(d.item_count), 0) FROM public.dna_dimensions d WHERE d.catalog_id = p_catalog_id) = 51
    AND NOT EXISTS (
      SELECT 1 FROM public.dna_dimensions d
      WHERE d.catalog_id = p_catalog_id
        AND (SELECT count(*) FROM public.dna_items i WHERE i.dimension_id = d.id) <> d.item_count)
$$;

CREATE FUNCTION public.dna_assert_school_account(p_school_id uuid, p_account_id uuid) RETURNS void
 LANGUAGE plpgsql STABLE SET search_path = '' AS $$
BEGIN
 IF p_school_id IS NULL OR p_account_id IS NULL OR NOT EXISTS (
   SELECT 1 FROM public.school_accounts a
   WHERE a.id = p_account_id AND a.school_id = p_school_id
     AND a.is_active AND NOT a.must_change_password) THEN
   RAISE EXCEPTION USING ERRCODE = 'DN403', MESSAGE = 'dna_account_not_authorized';
 END IF;
END $$;

CREATE FUNCTION public.dna_account_belongs_to_school(p_account_id uuid, p_school_id uuid) RETURNS boolean
 LANGUAGE sql STABLE SET search_path = '' AS $$
 SELECT EXISTS (SELECT 1 FROM public.school_accounts a WHERE a.id = p_account_id AND a.school_id = p_school_id)
$$;

-- ---------------------------------------------------------------------------
-- 6. Tetikleyiciler
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.dna_reject_mutation() RETURNS trigger
 LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
 RAISE EXCEPTION 'DNA immutable record cannot be updated, deleted or truncated (%)', TG_TABLE_NAME;
END $$;

-- Madde, boyutunun resmî madde aralığında olmalı.
CREATE FUNCTION public.dna_guard_item_dimension_range() RETURNS trigger
 LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
 dimension_first smallint;
 dimension_last smallint;
BEGIN
 SELECT d.first_item, d.last_item INTO dimension_first, dimension_last
 FROM public.dna_dimensions d
 WHERE d.id = NEW.dimension_id AND d.catalog_id = NEW.catalog_id
 FOR SHARE;
 IF NOT FOUND OR NEW.item_no NOT BETWEEN dimension_first AND dimension_last THEN
   RAISE EXCEPTION 'DNA item number is outside its dimension range';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER dna_items_dimension_range_guard
 BEFORE INSERT OR UPDATE ON public.dna_items
 FOR EACH ROW EXECUTE FUNCTION public.dna_guard_item_dimension_range();

-- Kullanımdaki katalog değiştirilemez; yalnızca dna_catalogs.is_active değişebilir.
CREATE FUNCTION public.dna_guard_catalog_mutation() RETURNS trigger
 LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
 cids uuid[];
BEGIN
 IF TG_TABLE_NAME = 'dna_catalogs' THEN
   IF TG_OP = 'UPDATE' AND (to_jsonb(NEW) - 'is_active') = (to_jsonb(OLD) - 'is_active') THEN
     RETURN NEW;
   END IF;
   cids := ARRAY[OLD.id];
 ELSIF TG_OP = 'INSERT' THEN
   cids := ARRAY[NEW.catalog_id];
 ELSIF TG_OP = 'UPDATE' THEN
   cids := ARRAY[OLD.catalog_id, NEW.catalog_id];
 ELSE
   cids := ARRAY[OLD.catalog_id];
 END IF;
 IF EXISTS (SELECT 1 FROM public.dna_applications a WHERE a.catalog_id = ANY (cids)) THEN
   RAISE EXCEPTION 'DNA catalog is in use and cannot be changed';
 END IF;
 IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER dna_catalogs_guard BEFORE UPDATE OR DELETE ON public.dna_catalogs
 FOR EACH ROW EXECUTE FUNCTION public.dna_guard_catalog_mutation();
CREATE TRIGGER dna_dimensions_guard BEFORE INSERT OR UPDATE OR DELETE ON public.dna_dimensions
 FOR EACH ROW EXECUTE FUNCTION public.dna_guard_catalog_mutation();
CREATE TRIGGER dna_items_guard BEFORE INSERT OR UPDATE OR DELETE ON public.dna_items
 FOR EACH ROW EXECUTE FUNCTION public.dna_guard_catalog_mutation();

-- Uygulama yalnızca draft olarak, aktif ve eksiksiz katalogla, okulun hesabıyla oluşturulur.
CREATE FUNCTION public.dna_guard_application_insert() RETURNS trigger
 LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
 IF NEW.status <> 'draft' THEN
   RAISE EXCEPTION 'DNA applications must be created as draft';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.dna_catalogs c WHERE c.id = NEW.catalog_id AND c.is_active)
    OR NOT public.dna_catalog_is_complete(NEW.catalog_id) THEN
   RAISE EXCEPTION 'DNA application requires the active and complete catalog';
 END IF;
 IF NOT public.dna_account_belongs_to_school(NEW.created_by_account_id, NEW.school_id) THEN
   RAISE EXCEPTION 'DNA account does not belong to the application school';
 END IF;
 NEW.name := btrim(NEW.name);
 NEW.created_at := now();
 NEW.updated_at := now();
 RETURN NEW;
END $$;
CREATE TRIGGER dna_applications_insert_guard BEFORE INSERT ON public.dna_applications
 FOR EACH ROW EXECUTE FUNCTION public.dna_guard_application_insert();

-- Durum yalnızca draft -> active -> closed ilerler; zaman damgaları sunucuda atanır.
CREATE FUNCTION public.dna_guard_application_update() RETURNS trigger
 LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
 ignored text[] := ARRAY['status','opened_at','closed_at','updated_at'];
BEGIN
 IF OLD.status = 'draft' AND NEW.status = 'draft' THEN
   ignored := ignored || 'name';
   NEW.name := btrim(NEW.name);
 ELSIF OLD.status = 'draft' AND NEW.status = 'active' THEN
   IF NOT EXISTS (SELECT 1 FROM public.dna_application_classes c WHERE c.application_id = OLD.id) THEN
     RAISE EXCEPTION 'DNA application needs at least one class before activation';
   END IF;
   NEW.opened_at := now();
   NEW.closed_at := NULL;
 ELSIF OLD.status = 'active' AND NEW.status = 'closed' THEN
   NEW.opened_at := OLD.opened_at;
   NEW.closed_at := now();
 ELSE
   RAISE EXCEPTION 'Invalid DNA application state transition (% -> %)', OLD.status, NEW.status;
 END IF;
 IF (to_jsonb(NEW) - ignored) IS DISTINCT FROM (to_jsonb(OLD) - ignored) THEN
   RAISE EXCEPTION 'DNA application identity and catalog cannot change';
 END IF;
 NEW.updated_at := now();
 RETURN NEW;
END $$;
CREATE TRIGGER dna_applications_update_guard BEFORE UPDATE ON public.dna_applications
 FOR EACH ROW EXECUTE FUNCTION public.dna_guard_application_update();
CREATE TRIGGER dna_applications_delete_guard BEFORE DELETE ON public.dna_applications
 FOR EACH ROW EXECUTE FUNCTION public.dna_reject_mutation();

-- Kapanışta erişim bağlantısı otomatik pasifleşir.
CREATE FUNCTION public.dna_after_application_close() RETURNS trigger
 LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
 UPDATE public.dna_access_links
    SET is_active = false, deactivated_at = now()
  WHERE application_id = NEW.id AND is_active;
 RETURN NULL;
END $$;
CREATE TRIGGER dna_applications_after_close AFTER UPDATE OF status ON public.dna_applications
 FOR EACH ROW WHEN (OLD.status = 'active' AND NEW.status = 'closed')
 EXECUTE FUNCTION public.dna_after_application_close();

-- Sınıf seçimi yalnızca draft aşamasında ve okulun kendi sınıflarıyla yapılır.
CREATE FUNCTION public.dna_guard_application_class() RETURNS trigger
 LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
 app_school_id uuid;
 app_status text;
 class_school_id uuid;
BEGIN
 IF TG_OP = 'UPDATE' THEN
   RAISE EXCEPTION 'DNA class links cannot be updated; remove and add while draft';
 END IF;
 SELECT a.school_id, a.status INTO app_school_id, app_status
 FROM public.dna_applications a
 WHERE a.id = CASE WHEN TG_OP = 'DELETE' THEN OLD.application_id ELSE NEW.application_id END
 FOR UPDATE;
 IF NOT FOUND OR app_status <> 'draft' THEN
   RAISE EXCEPTION 'DNA application classes can only change while draft';
 END IF;
 IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
 SELECT c.school_id INTO class_school_id FROM public.school_classes c WHERE c.id = NEW.school_class_id;
 IF class_school_id IS DISTINCT FROM app_school_id THEN
   RAISE EXCEPTION 'DNA class and application must belong to the same school';
 END IF;
 NEW.created_at := now();
 RETURN NEW;
END $$;
CREATE TRIGGER dna_application_classes_guard
 BEFORE INSERT OR UPDATE OR DELETE ON public.dna_application_classes
 FOR EACH ROW EXECUTE FUNCTION public.dna_guard_application_class();

-- Bağlantı: yalnızca aktif uygulamaya eklenir; yalnızca pasifleştirme veya
-- (aktif uygulamada) sürüm artırarak token yenileme yapılabilir; yeniden aktifleşmez, silinmez.
CREATE FUNCTION public.dna_guard_access_link() RETURNS trigger
 LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
 app_status text;
BEGIN
 IF TG_OP = 'DELETE' THEN
   RAISE EXCEPTION 'DNA access links cannot be deleted';
 END IF;
 SELECT a.status INTO app_status FROM public.dna_applications a
 WHERE a.id = NEW.application_id FOR SHARE;
 IF TG_OP = 'INSERT' THEN
   IF app_status IS DISTINCT FROM 'active' OR NOT NEW.is_active OR NEW.link_version <> 1 THEN
     RAISE EXCEPTION 'DNA access link can only be created active for an active application';
   END IF;
   NEW.created_at := now();
   RETURN NEW;
 END IF;
 IF NEW.application_id <> OLD.application_id OR NEW.id <> OLD.id OR NEW.created_at <> OLD.created_at THEN
   RAISE EXCEPTION 'DNA access link identity cannot change';
 END IF;
 IF OLD.is_active AND NOT NEW.is_active
    AND NEW.token_hash = OLD.token_hash AND NEW.link_version = OLD.link_version THEN
   NEW.deactivated_at := now();
   RETURN NEW;
 END IF;
 IF OLD.is_active AND NEW.is_active AND app_status = 'active'
    AND NEW.link_version = OLD.link_version + 1 AND NEW.token_hash <> OLD.token_hash
    AND NEW.deactivated_at IS NULL THEN
   RETURN NEW;
 END IF;
 RAISE EXCEPTION 'Invalid DNA access link change';
END $$;
CREATE TRIGGER dna_access_links_guard BEFORE INSERT OR UPDATE OR DELETE ON public.dna_access_links
 FOR EACH ROW EXECUTE FUNCTION public.dna_guard_access_link();

-- Yanıt yalnızca aktif uygulamaya, geçerli olarak eklenir.
CREATE FUNCTION public.dna_guard_response_insert() RETURNS trigger
 LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
 app_status text;
BEGIN
 SELECT a.status INTO app_status FROM public.dna_applications a
 WHERE a.id = NEW.application_id FOR SHARE;
 IF app_status IS DISTINCT FROM 'active' THEN
   RAISE EXCEPTION 'DNA responses require an active application';
 END IF;
 IF NEW.status <> 'valid' THEN
   RAISE EXCEPTION 'DNA responses must be inserted as valid';
 END IF;
 NEW.submitted_at := now();
 RETURN NEW;
END $$;
CREATE TRIGGER dna_responses_insert_guard BEFORE INSERT ON public.dna_responses
 FOR EACH ROW EXECUTE FUNCTION public.dna_guard_response_insert();

-- Yalnızca aktif uygulamada valid -> invalidated geçişi; içerik değişmez. Kapanıştan sonra kilitli.
CREATE FUNCTION public.dna_guard_response_update() RETURNS trigger
 LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
 app_status text;
 ignored text[] := ARRAY['status','invalidated_at','invalidated_by_account_id','invalidation_reason','student_number_norm'];
BEGIN
 SELECT a.status INTO app_status FROM public.dna_applications a
 WHERE a.id = OLD.application_id FOR SHARE;
 IF app_status IS DISTINCT FROM 'active' THEN
   RAISE EXCEPTION 'DNA responses are locked after closure';
 END IF;
 IF OLD.status <> 'valid' OR NEW.status <> 'invalidated' THEN
   RAISE EXCEPTION 'Only valid-to-invalidated transition is allowed';
 END IF;
 IF (to_jsonb(NEW) - ignored) IS DISTINCT FROM (to_jsonb(OLD) - ignored) THEN
   RAISE EXCEPTION 'DNA response contents are immutable';
 END IF;
 IF NOT public.dna_account_belongs_to_school(NEW.invalidated_by_account_id, OLD.school_id) THEN
   RAISE EXCEPTION 'DNA account does not belong to the response school';
 END IF;
 NEW.invalidated_at := now();
 RETURN NEW;
END $$;
CREATE TRIGGER dna_responses_update_guard BEFORE UPDATE ON public.dna_responses
 FOR EACH ROW EXECUTE FUNCTION public.dna_guard_response_update();
CREATE TRIGGER dna_responses_delete_guard BEFORE DELETE ON public.dna_responses
 FOR EACH ROW EXECUTE FUNCTION public.dna_reject_mutation();

-- Cevap maddesi uygulamanın kataloğundan olmalı; yanıt aktif uygulamada ve geçerli olmalı.
CREATE FUNCTION public.dna_guard_answer_insert() RETURNS trigger
 LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
 expected_catalog_id uuid;
 application_status text;
 response_status text;
BEGIN
 SELECT a.catalog_id, a.status, r.status INTO expected_catalog_id, application_status, response_status
 FROM public.dna_responses r
 JOIN public.dna_applications a ON a.id = r.application_id
 WHERE r.id = NEW.response_id
 FOR SHARE OF a;
 IF NOT FOUND OR application_status <> 'active' OR response_status <> 'valid' THEN
   RAISE EXCEPTION 'DNA answers require a valid response in an active application';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.dna_items i WHERE i.id = NEW.item_id AND i.catalog_id = expected_catalog_id) THEN
   RAISE EXCEPTION 'DNA answer item does not belong to the application catalog';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER dna_answers_insert_guard BEFORE INSERT ON public.dna_answers
 FOR EACH ROW EXECUTE FUNCTION public.dna_guard_answer_insert();
CREATE TRIGGER dna_answers_update_guard BEFORE UPDATE OR DELETE ON public.dna_answers
 FOR EACH ROW EXECUTE FUNCTION public.dna_reject_mutation();

-- Transaction sonunda: her yanıtın tam 51 cevabı olmalı ve total_score cevap toplamına eşit olmalı.
CREATE FUNCTION public.dna_check_response_complete() RETURNS trigger
 LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
 rid uuid := CASE WHEN TG_TABLE_NAME = 'dna_responses' THEN (to_jsonb(NEW) ->> 'id')::uuid
                   ELSE (to_jsonb(NEW) ->> 'response_id')::uuid END;
 expected integer;
 answer_count integer;
 answer_sum integer;
 stored_total integer;
BEGIN
 SELECT c.item_count, r.total_score INTO expected, stored_total
 FROM public.dna_responses r
 JOIN public.dna_applications a ON a.id = r.application_id
 JOIN public.dna_catalogs c ON c.id = a.catalog_id
 WHERE r.id = rid;
 SELECT count(*), coalesce(sum(x.value), 0) INTO answer_count, answer_sum
 FROM public.dna_answers x WHERE x.response_id = rid;
 IF answer_count <> expected OR answer_sum <> stored_total THEN
   RAISE EXCEPTION 'DNA response must have exactly % answers and a matching total score', expected;
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER dna_responses_complete_check AFTER INSERT ON public.dna_responses
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.dna_check_response_complete();
CREATE CONSTRAINT TRIGGER dna_answers_complete_check AFTER INSERT ON public.dna_answers
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.dna_check_response_complete();

-- Denetim kaydı: işlemi yapan hesap uygulamanın okuluna ait olmalı; yalnızca eklenir.
CREATE FUNCTION public.dna_guard_audit_insert() RETURNS trigger
 LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
 IF NEW.actor_account_id IS NOT NULL AND NOT EXISTS (
   SELECT 1 FROM public.dna_applications a
   WHERE a.id = NEW.application_id
     AND public.dna_account_belongs_to_school(NEW.actor_account_id, a.school_id)) THEN
   RAISE EXCEPTION 'DNA audit actor does not belong to the application school';
 END IF;
 NEW.created_at := now();
 RETURN NEW;
END $$;
CREATE TRIGGER dna_audit_events_insert_guard BEFORE INSERT ON public.dna_audit_events
 FOR EACH ROW EXECUTE FUNCTION public.dna_guard_audit_insert();
CREATE TRIGGER dna_audit_events_update_guard BEFORE UPDATE OR DELETE ON public.dna_audit_events
 FOR EACH ROW EXECUTE FUNCTION public.dna_reject_mutation();

-- RAM gönderimi: yalnızca kapanmış uygulama, okulun kendi hesabı, okulun gerçek ilçesi.
CREATE FUNCTION public.dna_guard_ram_submission_insert() RETURNS trigger
 LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
 app_status text;
BEGIN
 SELECT a.status INTO app_status FROM public.dna_applications a
 WHERE a.id = NEW.application_id FOR SHARE;
 IF app_status IS DISTINCT FROM 'closed' THEN
   RAISE EXCEPTION 'DNA RAM submission requires a closed application';
 END IF;
 IF NOT public.dna_account_belongs_to_school(NEW.approved_by_account_id, NEW.school_id) THEN
   RAISE EXCEPTION 'DNA account does not belong to the submission school';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.schools s WHERE s.id = NEW.school_id AND s.district_id = NEW.district_id) THEN
   RAISE EXCEPTION 'DNA RAM submission district does not match the school';
 END IF;
 NEW.submitted_at := now();
 RETURN NEW;
END $$;
CREATE TRIGGER dna_ram_submissions_insert_guard BEFORE INSERT ON public.dna_ram_submissions
 FOR EACH ROW EXECUTE FUNCTION public.dna_guard_ram_submission_insert();

-- Transaction sonunda: anlık görüntü, geçerli yanıtlardan yeniden hesaplanan değerlerle birebir aynı olmalı.
CREATE FUNCTION public.dna_check_ram_submission() RETURNS trigger
 LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
 actual_count integer;
BEGIN
 SELECT count(*) INTO actual_count FROM public.dna_responses r
 WHERE r.application_id = NEW.application_id AND r.status = 'valid';
 IF actual_count <> NEW.valid_response_count THEN
   RAISE EXCEPTION 'DNA RAM submission response count mismatch';
 END IF;
 IF EXISTS (
   (SELECT s.item_no, s.dimension_no, s.item_total
      FROM public.dna_ram_submission_item_results s WHERE s.submission_id = NEW.id)
   EXCEPT
   (SELECT i.item_no, d.dimension_no,
           coalesce(sum(x.value), 0)::integer
      FROM public.dna_items i
      JOIN public.dna_dimensions d ON d.id = i.dimension_id
      LEFT JOIN (public.dna_answers x
                 JOIN public.dna_responses r ON r.id = x.response_id
                  AND r.application_id = NEW.application_id AND r.status = 'valid')
             ON x.item_id = i.id
     WHERE i.catalog_id = NEW.catalog_id
     GROUP BY i.item_no, d.dimension_no))
   OR (SELECT count(*) FROM public.dna_ram_submission_item_results s WHERE s.submission_id = NEW.id) <> 51 THEN
   RAISE EXCEPTION 'DNA RAM submission item results do not match valid responses';
 END IF;
 IF EXISTS (
   (SELECT s.dimension_no, s.dimension_name, s.item_count, s.dimension_item_total, s.dimension_average_official
      FROM public.dna_ram_submission_dimension_results s WHERE s.submission_id = NEW.id)
   EXCEPT
   (SELECT d.dimension_no, d.name, d.item_count, t.total,
           round(t.total::numeric / d.item_count, 4)
      FROM public.dna_dimensions d
      JOIN LATERAL (
        SELECT coalesce(sum(s.item_total), 0)::integer AS total
        FROM public.dna_ram_submission_item_results s
        WHERE s.submission_id = NEW.id AND s.dimension_no = d.dimension_no) t ON true
     WHERE d.catalog_id = NEW.catalog_id))
   OR (SELECT count(*) FROM public.dna_ram_submission_dimension_results s WHERE s.submission_id = NEW.id) <> 7 THEN
   RAISE EXCEPTION 'DNA RAM submission dimension results do not match item results';
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER dna_ram_submissions_complete_check AFTER INSERT ON public.dna_ram_submissions
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.dna_check_ram_submission();

CREATE TRIGGER dna_ram_submissions_update_guard BEFORE UPDATE OR DELETE ON public.dna_ram_submissions
 FOR EACH ROW EXECUTE FUNCTION public.dna_reject_mutation();
CREATE TRIGGER dna_ram_dimensions_update_guard BEFORE UPDATE OR DELETE ON public.dna_ram_submission_dimension_results
 FOR EACH ROW EXECUTE FUNCTION public.dna_reject_mutation();
CREATE TRIGGER dna_ram_items_update_guard BEFORE UPDATE OR DELETE ON public.dna_ram_submission_item_results
 FOR EACH ROW EXECUTE FUNCTION public.dna_reject_mutation();

-- TRUNCATE satır tetikleyicilerini atlattığı için tüm DNA tablolarında ayrıca engellenir.
DO $$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY[
  'dna_catalogs','dna_dimensions','dna_items','dna_applications',
  'dna_application_classes','dna_access_links','dna_responses','dna_answers',
  'dna_audit_events','dna_ram_submissions',
  'dna_ram_submission_dimension_results','dna_ram_submission_item_results'
 ] LOOP
   EXECUTE format('CREATE TRIGGER %I BEFORE TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.dna_reject_mutation()', t || '_truncate_guard', t);
 END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 7. Atomik RPC'ler (SECURITY DEFINER; yalnızca service_role çalıştırabilir)
-- Backend p_school_id ve p_account_id değerlerini YALNIZCA oturum token'ından verir.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.dna_create_application(
 p_school_id uuid, p_account_id uuid, p_name text, p_class_ids uuid[]
) RETURNS uuid
 LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 v_year_id uuid;
 v_catalog_id uuid;
 v_app_id uuid;
 v_class_count integer;
BEGIN
 PERFORM public.dna_assert_school_account(p_school_id, p_account_id);
 IF p_name IS NULL OR char_length(btrim(p_name)) NOT BETWEEN 1 AND 200 THEN
   RAISE EXCEPTION USING ERRCODE = 'DN422', MESSAGE = 'dna_invalid_name';
 END IF;
 v_class_count := coalesce(cardinality(p_class_ids), 0);
 IF v_class_count = 0
    OR v_class_count <> (SELECT count(DISTINCT c) FROM unnest(p_class_ids) c WHERE c IS NOT NULL)
    OR v_class_count <> (SELECT count(*) FROM public.school_classes sc
                         WHERE sc.id = ANY (p_class_ids) AND sc.school_id = p_school_id) THEN
   RAISE EXCEPTION USING ERRCODE = 'DN422', MESSAGE = 'dna_invalid_classes';
 END IF;
 SELECT y.id INTO v_year_id FROM public.academic_years y WHERE y.is_active;
 IF v_year_id IS NULL THEN
   RAISE EXCEPTION USING ERRCODE = 'DN409', MESSAGE = 'dna_no_active_academic_year';
 END IF;
 SELECT c.id INTO v_catalog_id FROM public.dna_catalogs c WHERE c.is_active;
 IF v_catalog_id IS NULL OR NOT public.dna_catalog_is_complete(v_catalog_id) THEN
   RAISE EXCEPTION USING ERRCODE = 'DN409', MESSAGE = 'dna_no_active_catalog';
 END IF;
 INSERT INTO public.dna_applications (school_id, academic_year_id, catalog_id, name, created_by_account_id)
 VALUES (p_school_id, v_year_id, v_catalog_id, btrim(p_name), p_account_id)
 RETURNING id INTO v_app_id;
 INSERT INTO public.dna_application_classes (application_id, school_class_id)
 SELECT v_app_id, c FROM unnest(p_class_ids) c;
 INSERT INTO public.dna_audit_events (application_id, event_type, actor_account_id, details)
 VALUES (v_app_id, 'created', p_account_id, '{}'::jsonb),
        (v_app_id, 'class_set', p_account_id, jsonb_build_object('class_count', v_class_count));
 RETURN v_app_id;
END $$;

CREATE FUNCTION public.dna_activate_application(
 p_application_id uuid, p_school_id uuid, p_account_id uuid, p_token_hash text
) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 v_status text;
BEGIN
 PERFORM public.dna_assert_school_account(p_school_id, p_account_id);
 SELECT a.status INTO v_status FROM public.dna_applications a
 WHERE a.id = p_application_id AND a.school_id = p_school_id FOR UPDATE;
 IF NOT FOUND THEN
   RAISE EXCEPTION USING ERRCODE = 'DN404', MESSAGE = 'dna_application_not_found';
 END IF;
 IF v_status <> 'draft' THEN
   RAISE EXCEPTION USING ERRCODE = 'DN409', MESSAGE = 'dna_application_not_draft';
 END IF;
 IF p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$' THEN
   RAISE EXCEPTION USING ERRCODE = 'DN422', MESSAGE = 'dna_invalid_token_hash';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.dna_application_classes c WHERE c.application_id = p_application_id) THEN
   RAISE EXCEPTION USING ERRCODE = 'DN409', MESSAGE = 'dna_application_has_no_classes';
 END IF;
 UPDATE public.dna_applications SET status = 'active' WHERE id = p_application_id;
 INSERT INTO public.dna_access_links (application_id, token_hash) VALUES (p_application_id, p_token_hash);
 INSERT INTO public.dna_audit_events (application_id, event_type, actor_account_id)
 VALUES (p_application_id, 'activated', p_account_id);
END $$;

CREATE FUNCTION public.dna_close_application(
 p_application_id uuid, p_school_id uuid, p_account_id uuid
) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 v_status text;
BEGIN
 PERFORM public.dna_assert_school_account(p_school_id, p_account_id);
 SELECT a.status INTO v_status FROM public.dna_applications a
 WHERE a.id = p_application_id AND a.school_id = p_school_id FOR UPDATE;
 IF NOT FOUND THEN
   RAISE EXCEPTION USING ERRCODE = 'DN404', MESSAGE = 'dna_application_not_found';
 END IF;
 IF v_status <> 'active' THEN
   RAISE EXCEPTION USING ERRCODE = 'DN409', MESSAGE = 'dna_application_not_active';
 END IF;
 UPDATE public.dna_applications SET status = 'closed' WHERE id = p_application_id;
 INSERT INTO public.dna_audit_events (application_id, event_type, actor_account_id)
 VALUES (p_application_id, 'closed', p_account_id);
END $$;

-- Herkese açık gönderim: kimlik yalnızca token hash'inden çözülür.
-- p_answers biçimi: {"1":2,"2":0,...,"51":1} (51 anahtar, değerler 0/1/2).
CREATE FUNCTION public.dna_submit_response(
 p_token_hash text, p_school_class_id uuid, p_first_name text, p_last_name text,
 p_student_number text, p_answers jsonb, p_open_text text
) RETURNS uuid
 LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 v_app public.dna_applications%ROWTYPE;
 v_max_open integer;
 v_first text := btrim(coalesce(p_first_name, ''));
 v_last text := btrim(coalesce(p_last_name, ''));
 v_number text := btrim(coalesce(p_student_number, ''));
 v_open text := nullif(btrim(coalesce(p_open_text, '')), '');
 v_valid_count integer;
 v_total integer;
 v_response_id uuid;
BEGIN
 SELECT a.* INTO v_app
 FROM public.dna_access_links l
 JOIN public.dna_applications a ON a.id = l.application_id
 WHERE l.token_hash = p_token_hash AND l.is_active
 FOR SHARE OF a;
 IF NOT FOUND THEN
   RAISE EXCEPTION USING ERRCODE = 'DN404', MESSAGE = 'dna_link_invalid';
 END IF;
 IF v_app.status <> 'active' THEN
   RAISE EXCEPTION USING ERRCODE = 'DN409', MESSAGE = 'dna_application_not_open';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.dna_application_classes c
                WHERE c.application_id = v_app.id AND c.school_class_id = p_school_class_id) THEN
   RAISE EXCEPTION USING ERRCODE = 'DN422', MESSAGE = 'dna_invalid_class';
 END IF;
 IF char_length(v_first) NOT BETWEEN 1 AND 60 OR char_length(v_last) NOT BETWEEN 1 AND 60
    OR char_length(v_number) NOT BETWEEN 1 AND 20 THEN
   RAISE EXCEPTION USING ERRCODE = 'DN422', MESSAGE = 'dna_invalid_identity';
 END IF;
 SELECT c.open_text_max_length INTO v_max_open FROM public.dna_catalogs c WHERE c.id = v_app.catalog_id;
 IF v_open IS NOT NULL AND char_length(v_open) > v_max_open THEN
   RAISE EXCEPTION USING ERRCODE = 'DN422', MESSAGE = 'dna_open_text_too_long';
 END IF;
 IF p_answers IS NULL OR jsonb_typeof(p_answers) <> 'object'
    OR (SELECT count(*) FROM jsonb_object_keys(p_answers)) <> 51 THEN
   RAISE EXCEPTION USING ERRCODE = 'DN422', MESSAGE = 'dna_invalid_answers';
 END IF;
 SELECT count(*), coalesce(sum((p_answers ->> i.item_no::text)::integer), 0)
   INTO v_valid_count, v_total
 FROM public.dna_items i
 WHERE i.catalog_id = v_app.catalog_id
   AND jsonb_typeof(p_answers -> i.item_no::text) = 'number'
   AND (p_answers ->> i.item_no::text) IN ('0', '1', '2');
 IF v_valid_count <> 51 THEN
   RAISE EXCEPTION USING ERRCODE = 'DN422', MESSAGE = 'dna_invalid_answers';
 END IF;
 BEGIN
   INSERT INTO public.dna_responses (application_id, school_id, school_class_id, first_name, last_name,
                                     student_number, open_text, total_score)
   VALUES (v_app.id, v_app.school_id, p_school_class_id, v_first, v_last, v_number, v_open, v_total)
   RETURNING id INTO v_response_id;
 EXCEPTION WHEN unique_violation THEN
   RAISE EXCEPTION USING ERRCODE = 'DN409', MESSAGE = 'dna_duplicate_response';
 END;
 INSERT INTO public.dna_answers (response_id, item_id, value)
 SELECT v_response_id, i.id, (p_answers ->> i.item_no::text)::smallint
 FROM public.dna_items i WHERE i.catalog_id = v_app.catalog_id;
 INSERT INTO public.dna_audit_events (application_id, response_id, event_type)
 VALUES (v_app.id, v_response_id, 'response_submitted');
 RETURN v_response_id;
END $$;

CREATE FUNCTION public.dna_invalidate_response(
 p_response_id uuid, p_school_id uuid, p_account_id uuid, p_reason text
) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 v_app_id uuid;
 v_app_status text;
 v_resp_status text;
 v_reason text := btrim(coalesce(p_reason, ''));
BEGIN
 PERFORM public.dna_assert_school_account(p_school_id, p_account_id);
 SELECT a.id, a.status, r.status INTO v_app_id, v_app_status, v_resp_status
 FROM public.dna_responses r
 JOIN public.dna_applications a ON a.id = r.application_id
 WHERE r.id = p_response_id AND a.school_id = p_school_id
 FOR UPDATE OF a;
 IF NOT FOUND THEN
   RAISE EXCEPTION USING ERRCODE = 'DN404', MESSAGE = 'dna_response_not_found';
 END IF;
 IF v_app_status <> 'active' THEN
   RAISE EXCEPTION USING ERRCODE = 'DN409', MESSAGE = 'dna_application_not_active';
 END IF;
 IF v_resp_status <> 'valid' THEN
   RAISE EXCEPTION USING ERRCODE = 'DN409', MESSAGE = 'dna_response_already_invalidated';
 END IF;
 IF char_length(v_reason) NOT BETWEEN 10 AND 500 THEN
   RAISE EXCEPTION USING ERRCODE = 'DN422', MESSAGE = 'dna_invalid_reason';
 END IF;
 UPDATE public.dna_responses
    SET status = 'invalidated', invalidated_at = now(),
        invalidated_by_account_id = p_account_id, invalidation_reason = v_reason
  WHERE id = p_response_id;
 INSERT INTO public.dna_audit_events (application_id, response_id, event_type, actor_account_id, reason)
 VALUES (v_app_id, p_response_id, 'response_invalidated', p_account_id, v_reason);
END $$;

-- Okulun açık onayıyla, kapanmış uygulamanın toplu sonuçları RAM'e bir kez gönderilir.
CREATE FUNCTION public.dna_submit_to_ram(
 p_application_id uuid, p_school_id uuid, p_account_id uuid
) RETURNS uuid
 LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 v_app public.dna_applications%ROWTYPE;
 v_count integer;
 v_submission_id uuid;
BEGIN
 PERFORM public.dna_assert_school_account(p_school_id, p_account_id);
 SELECT a.* INTO v_app FROM public.dna_applications a
 WHERE a.id = p_application_id AND a.school_id = p_school_id FOR UPDATE;
 IF NOT FOUND THEN
   RAISE EXCEPTION USING ERRCODE = 'DN404', MESSAGE = 'dna_application_not_found';
 END IF;
 IF v_app.status <> 'closed' THEN
   RAISE EXCEPTION USING ERRCODE = 'DN409', MESSAGE = 'dna_application_not_closed';
 END IF;
 IF EXISTS (SELECT 1 FROM public.dna_ram_submissions s WHERE s.application_id = p_application_id) THEN
   RAISE EXCEPTION USING ERRCODE = 'DN409', MESSAGE = 'dna_already_submitted';
 END IF;
 SELECT count(*) INTO v_count FROM public.dna_responses r
 WHERE r.application_id = p_application_id AND r.status = 'valid';
 IF v_count < 1 THEN
   RAISE EXCEPTION USING ERRCODE = 'DN409', MESSAGE = 'dna_no_valid_responses';
 END IF;
 INSERT INTO public.dna_ram_submissions (application_id, school_id, district_id, academic_year_id, catalog_id,
   school_name, district_name, academic_year_name, valid_response_count, approved_by_account_id)
 SELECT v_app.id, s.id, s.district_id, y.id, v_app.catalog_id, s.name, d.name, y.name, v_count, p_account_id
 FROM public.schools s
 JOIN public.districts d ON d.id = s.district_id
 JOIN public.academic_years y ON y.id = v_app.academic_year_id
 WHERE s.id = v_app.school_id
 RETURNING id INTO v_submission_id;
 INSERT INTO public.dna_ram_submission_item_results (submission_id, item_no, dimension_no, item_total)
 SELECT v_submission_id, i.item_no, d.dimension_no,
        coalesce(sum(x.value), 0)::integer
 FROM public.dna_items i
 JOIN public.dna_dimensions d ON d.id = i.dimension_id
 LEFT JOIN (public.dna_answers x
            JOIN public.dna_responses r ON r.id = x.response_id
             AND r.application_id = v_app.id AND r.status = 'valid')
        ON x.item_id = i.id
 WHERE i.catalog_id = v_app.catalog_id
 GROUP BY i.item_no, d.dimension_no;
 INSERT INTO public.dna_ram_submission_dimension_results
   (submission_id, dimension_no, dimension_name, item_count, dimension_item_total, dimension_average_official)
 SELECT v_submission_id, d.dimension_no, d.name, d.item_count, t.total, round(t.total::numeric / d.item_count, 4)
 FROM public.dna_dimensions d
 JOIN LATERAL (
   SELECT coalesce(sum(s.item_total), 0)::integer AS total
   FROM public.dna_ram_submission_item_results s
   WHERE s.submission_id = v_submission_id AND s.dimension_no = d.dimension_no) t ON true
 WHERE d.catalog_id = v_app.catalog_id;
 INSERT INTO public.dna_audit_events (application_id, event_type, actor_account_id, details)
 VALUES (v_app.id, 'submitted_to_ram', p_account_id, jsonb_build_object('valid_response_count', v_count));
 RETURN v_submission_id;
END $$;

-- ---------------------------------------------------------------------------
-- 8. RLS ve ayrıcalıklar: politika yok (varsayılan ret). service_role yalnızca OKUR;
-- tüm yazmalar RPC'ler üzerinden yapılır. anon/authenticated hiçbir erişime sahip değildir.
-- ---------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY[
  'dna_catalogs','dna_dimensions','dna_items','dna_applications',
  'dna_application_classes','dna_access_links','dna_responses','dna_answers',
  'dna_audit_events','dna_ram_submissions',
  'dna_ram_submission_dimension_results','dna_ram_submission_item_results'
 ] LOOP
   EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
   EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated, service_role', t);
   EXECUTE format('GRANT SELECT ON TABLE public.%I TO service_role', t);
 END LOOP;
END $$;

DO $$
DECLARE f regprocedure;
BEGIN
 FOR f IN
   SELECT p.oid::regprocedure FROM pg_proc p
   JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname LIKE 'dna\_%'
 LOOP
   EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', f);
 END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.dna_create_application(uuid, uuid, text, uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.dna_activate_application(uuid, uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.dna_close_application(uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.dna_submit_response(text, uuid, text, text, text, jsonb, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.dna_invalidate_response(uuid, uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.dna_submit_to_ram(uuid, uuid, uuid) TO service_role;

COMMIT;
