import axios from "axios";
import { supabase } from "./supabaseClient";

export const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export async function authHeader() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : null;
}

// GET with RAM session; handles 401 / password-change 403. Returns data, or throws {message, status}.
export async function ramGet(navigate, path, params) {
  const h = await authHeader();
  if (!h) { navigate("/ram/login", { replace: true }); throw { silent: true }; }
  try {
    const res = await axios.get(`${API}${path}`, { headers: h, params });
    return res.data;
  } catch (err) {
    const status = err.response?.status;
    const detail = err.response?.data?.detail;
    if (status === 401) {
      await supabase.auth.signOut();
      navigate("/ram/login", { replace: true });
      throw { silent: true };
    }
    if (status === 403 && detail === "password_change_required") {
      navigate("/ram/change-password", { replace: true });
      throw { silent: true };
    }
    throw { status, message: typeof detail === "string" ? detail : null };
  }
}

export function formatDate(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" }); }
  catch (_) { return iso; }
}

export function targetLabel(t) {
  if (!t || (!t.meb_code && !t.name)) return "—";
  return [t.meb_code, t.name].filter(Boolean).join(" – ");
}
