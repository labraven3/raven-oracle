"use client";

import { useEffect, useState } from "react";

export default function SiteHeader() {
  const [light, setLight] = useState(false);
  useEffect(() => { const saved = localStorage.getItem("raven-theme"); const next = saved === "light"; setLight(next); document.documentElement.classList.toggle("light", next); }, []);
  const toggle = () => { const next = !light; setLight(next); localStorage.setItem("raven-theme", next ? "light" : "dark"); document.documentElement.classList.toggle("light", next); };
  const bg = light ? "#f5f3f8" : "#06060a"; const text = light ? "#17131e" : "#f7f5fb"; const muted = light ? "#77717f" : "#77727f"; const border = light ? "rgba(25,18,40,.12)" : "rgba(255,255,255,.09)";
  return <header style={{position:"sticky",top:0,zIndex:50,borderBottom:`1px solid ${border}`,background:`${bg}e8`,backdropFilter:"blur(18px)"}}><div style={{maxWidth:1240,margin:"auto",minHeight:72,padding:"0 24px",display:"flex",alignItems:"center",gap:26}}><a href="/" style={{display:"flex",alignItems:"center",gap:11,minWidth:205}}><span style={{width:40,height:40,display:"grid",placeItems:"center",borderRadius:12,background:"linear-gradient(135deg,#9b5cff,#5b21b6)",color:"white",fontWeight:900}}>R</span><span><b style={{display:"block",fontSize:13,letterSpacing:".18em",color:text}}>RAVEN ORACLE</b><small style={{display:"block",marginTop:3,color:muted,fontSize:8,letterSpacing:".16em"}}>NFT COMMUNITY PLATFORM</small></span></a><nav style={{display:"flex",flex:1,justifyContent:"center",gap:24,fontSize:12,color:muted}}><a href="/raffles">Raffles</a><a href="/projects">NFT Projects</a><a href="/alpha">King of Alpha</a><a href="/how-it-works">How it works</a></nav><div style={{display:"flex",alignItems:"center",gap:8}}><button onClick={toggle} style={{border:`1px solid ${border}`,background:light?"#fff":"#0d0c12",color:text,borderRadius:10,padding:"9px 11px",fontSize:12}} aria-label="Toggle theme">{light?"☾":"☀"}</button><a href="/account" style={{borderRadius:10,background:text,color:light?"#fff":"#08070a",padding:"10px 15px",fontSize:11,fontWeight:800}}>Account</a></div></div></header>;
}
