import { siteUrl } from "@/lib/article-server";
export const dynamic="force-dynamic";
export async function GET(){
 try{
  const response=await fetch(`${process.env.BACKEND_URL||"http://127.0.0.1:8080"}/api/v1/stats`,{cache:"no-store",signal:AbortSignal.timeout(5000)});
  if(!response.ok)throw new Error();
  const stats=await response.json();const count=Math.max(1,Math.ceil(stats.articles/1000));
  const escape=(s:string)=>s.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll('"',"&quot;");
  const entries=Array.from({length:count},(_,i)=>`<sitemap><loc>${escape(siteUrl)}/sitemap/${i}.xml</loc></sitemap>`).join("");
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</sitemapindex>`,{headers:{"Content-Type":"application/xml","Cache-Control":"public, max-age=300"}});
 }catch{return new Response("Published sitemap is temporarily unavailable",{status:503,headers:{"Retry-After":"60"}});}
}
