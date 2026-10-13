import "server-only";
import { supabaseRequest } from "@/lib/supabaseServer";
import { eccMemberRegistrationsTable, eccMemberRegistrationColumns, toEccMemberRegistration, type EccMemberRegistrationRow } from "@/lib/eccMemberRegistrations";
import { hanhwalMemberRegistrationsTable, hanhwalMemberRegistrationColumns, toHanhwalMemberRegistration } from "@/lib/hanhwalMemberRegistrations";

// Called only after the original member-management GET has authorized the actor.
export async function loadClubMembers(club: "ecc" | "hanhwal", query: Record<string, string>) {
  const table = club === "ecc" ? eccMemberRegistrationsTable : hanhwalMemberRegistrationsTable;
  const columns = club === "ecc" ? eccMemberRegistrationColumns : hanhwalMemberRegistrationColumns;
  const convert = club === "ecc" ? toEccMemberRegistration : toHanhwalMemberRegistration;
  const all = [];
  let cursor = "";
  for (;;) {
    const batch = await supabaseRequest<EccMemberRegistrationRow[]>(`${table}?select=${columns}&order=id.asc&limit=500${cursor ? `&id=gt.${encodeURIComponent(cursor)}` : ""}`);
    if (!batch.length) break;
    all.push(...batch.map(convert));
    if (all.length > 20000) throw new Error("회원 자료 범위를 나누어 요청해 주세요.");
    const next = batch.at(-1)!.id;
    if (!next || next === cursor) throw new Error("Member pagination did not advance.");
    cursor = next;
  }
  const search = (query.q || "").normalize("NFKC").toLowerCase().replace(/^(?:ecc|hanhwal|hanwhal|한활)\s+/i, "");
  return all.filter(row =>
    (!search || [row.fullName, row.studentId, row.googleEmail].some(value => value.normalize("NFKC").toLowerCase().includes(search))) &&
    (!query.payment || (query.payment === "paid" ? row.paymentConfirmed : query.payment === "unpaid" ? !row.paymentConfirmed : false)) &&
    (!query.membership || (query.membership === "official" ? row.officialMember : query.membership === "pending" ? !row.officialMember : false)) &&
    (!query.nationality || row.nationality.toLowerCase() === query.nationality.toLowerCase()) &&
    (!query.gender || row.gender.toLowerCase() === query.gender.toLowerCase())
  );
}
