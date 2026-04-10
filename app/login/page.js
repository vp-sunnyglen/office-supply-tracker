"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const ALLOWED_PASSWORD = process.env.NEXT_PUBLIC_APP_PASSWORD;

export default function Login() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  function handleLogin() {
    if (!name.trim()) { setError("Please enter your name."); return; }
    if (password !== ALLOWED_PASSWORD) { setError("Incorrect password. Please try again."); return; }
    // Save name to sessionStorage so the app knows who is logged in
    sessionStorage.setItem("supply_user", name.trim());
    router.push("/");
  }

  function handleKey(e) { if (e.key === "Enter") handleLogin(); }

  return (
    <div style={{ minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f1f5f9",fontFamily:"sans-serif" }}>
      <div style={{ background:"white",borderRadius:16,padding:40,maxWidth:380,width:"100%",boxShadow:"0 4px 24px rgba(0,0,0,0.08)",textAlign:"center" }}>
        <div style={{ fontSize:48,marginBottom:12 }}>📦</div>
        <h1 style={{ fontSize:22,fontWeight:700,color:"#1e293b",margin:"0 0 4px" }}>Supply Tracker</h1>
        <p style={{ color:"#64748b",fontSize:14,margin:"0 0 28px" }}>Sunnyglen.org Office Supplies</p>

        {error && (
          <div style={{ background:"#fef2f2",border:"1px solid #fca5a5",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:13,color:"#991b1b" }}>
            ⛔ {error}
          </div>
        )}

        <div style={{ textAlign:"left",marginBottom:14 }}>
          <label style={{ fontSize:13,color:"#475569",display:"block",marginBottom:4 }}>Your Name</label>
          <input
            type="text"
            placeholder="e.g. Maria Lopez"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={handleKey}
            style={{ width:"100%",padding:"10px 12px",borderRadius:8,border:"1px solid #cbd5e1",fontSize:14,boxSizing:"border-box" }}
          />
        </div>

        <div style={{ textAlign:"left",marginBottom:20 }}>
          <label style={{ fontSize:13,color:"#475569",display:"block",marginBottom:4 }}>App Password</label>
          <input
            type="password"
            placeholder="Enter the team password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={handleKey}
            style={{ width:"100%",padding:"10px 12px",borderRadius:8,border:"1px solid #cbd5e1",fontSize:14,boxSizing:"border-box" }}
          />
        </div>

        <button onClick={handleLogin} style={{
          width:"100%",padding:"12px 20px",borderRadius:10,border:"none",
          background:"#1e3a5f",color:"white",cursor:"pointer",fontSize:15,fontWeight:600
        }}>
          Sign In
        </button>

        <p style={{ marginTop:20,fontSize:12,color:"#94a3b8" }}>
          For Sunnyglen.org staff only. Contact your office manager for the password.
        </p>
      </div>
    </div>
  );
}
