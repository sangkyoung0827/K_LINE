import { ClubResourceDetail } from "@/components/club-resources/ClubResourceDetail";
import { HanhwalPublicShell } from "@/components/HanhwalPublicShell";
import { getHanhwalResourceAccess } from "@/lib/hanhwalResources/server";
import { createNoIndexMetadata } from "@/lib/seo";
import "../resources.css";
export const dynamic = "force-dynamic";
export const metadata = createNoIndexMetadata({title:"Hanhwal Resource",description:"Hanhwal shared resource.",path:"/our-activities/hanhwal/resources"});
export default async function ResourcePage({params}:{params:Promise<{id:string}>}) {
  const [{id}, access] = await Promise.all([params,getHanhwalResourceAccess()]);
  return <HanhwalPublicShell><ClubResourceDetail club="hanhwal" id={id} isAdmin={access.canManage}/></HanhwalPublicShell>;
}
