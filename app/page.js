"use client";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const categories = ["Paper", "Printer", "Writing", "Desk", "Cleaning", "Break Room", "Other"];
const emptyForm = { name: "", category: "Desk", on_hand: 0, reorder_at: 1, vendor: "", unit_cost: 0, notes: "" };

export default function Home() {
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const [supplies, setSupplies] = useState([]);
  const [orderLog, setOrderLog] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [tab, setTab] = useState("inventory");
  const [filterCat, setFilterCat] = useState("All");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(false);

  useEffect(() => {
    // Check if user is logged in via sessionStorage
    const storedName = sessionStorage.getItem("supply_user");
    if (!storedName) { router.push("/login"); return; }
    setUserName(storedName);
    fetchAll();
    checkNotif();
  }, []);

  // Real-time updates — when anyone changes supplies, all devices update instantly
  useEffect(() => {
    const ch = supabase.channel("supplies-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "supplies" }, fetchSupplies)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  async function fetchAll() { await Promise.all([fetchSupplies(), fetchLog(), fetchAudit()]); setLoading(false); }
  async function fetchSupplies() { const { data } = await supabase.from("supplies").select("*").order("name"); setSupplies(data || []); }
  async function fetchLog() { const { data } = await supabase.from("order_log").select("*").order("ordered_at", { ascending: false }).limit(50); setOrderLog(data || []); }
  async function fetchAudit() { const { data } = await supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(100); setAuditLog(data || []); }

  function checkNotif() { if ("Notification" in window) setNotifEnabled(Notification.permission === "granted"); }
  async function requestNotif() { await Notification.requestPermission(); checkNotif(); }

  async function logAudit(action, itemName, details) {
    await fetch("/api/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_email: "", user_name: userName, action, item_name: itemName, details })
    });
    fetchAudit();
  }

  async function triggerAlert(supply) {
    if (notifEnabled) new Notification("⚠️ Low Stock Alert", { body: `${supply.name} is low (${supply.on_hand} left). Reorder from ${supply.vendor}.` });
    await fetch("/api/alert", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ supply }) });
  }

  async function updateQty(id, delta) {
    const s = supplies.find(x => x.id === id);
    const newQty = Math.max(0, s.on_hand + delta);
    setSaving(true);
    await supabase.from("supplies").update({ on_hand: newQty }).eq("id", id);
    await logAudit("Updated quantity", s.name, `${s.on_hand} → ${newQty}`);
    setSaving(false);
    if (newQty <= s.reorder_at) await triggerAlert({ ...s, on_hand: newQty });
    fetchSupplies();
  }

  async function saveItem() {
    if (!form.name.trim()) return;
    setSaving(true);
    if (editId) {
      await supabase.from("supplies").update(form).eq("id", editId);
      await logAudit("Edited item", form.name, "Item details updated");
    } else {
      await supabase.from("supplies").insert([form]);
      await logAudit("Added item", form.name, `Qty: ${form.on_hand}, Vendor: ${form.vendor}`);
    }
    setSaving(false);
    setForm(emptyForm); setEditId(null); setShowForm(false);
    fetchSupplies();
  }

  async function deleteItem(id) {
    const s = supplies.find(x => x.id === id);
    await supabase.from("supplies").delete().eq("id", id);
    await logAudit("Deleted item", s.name, "Item removed from inventory");
    fetchSupplies();
  }

  async function markOrdered(s) {
    await supabase.from("order_log").insert([{ supply_id: s.id, item_name: s.name, vendor: s.vendor, unit_cost: s.unit_cost }]);
    const newQty = s.reorder_at + 5;
    await supabase.from("supplies").update({ on_hand: newQty }).eq("id", s.id);
    await logAudit("Marked as ordered", s.name, `Qty reset to ${newQty}`);
    fetchSupplies(); fetchLog();
  }

  function editItem(s) {
    setForm({ name: s.name, category: s.category, on_hand: s.on_hand, reorder_at: s.reorder_at, vendor: s.vendor, unit_cost: s.unit_cost, notes: s.notes || "" });
    setEditId(s.id); setShowForm(true); setTab("inventory");
  }

  function signOut() { sessionStorage.removeItem("supply_user"); router.push("/login"); }

  const statusColor = s => s.on_hand === 0 ? "#ef4444" : s.on_hand <= s.reorder_at ? "#f97316" : "#22c55e";
  const statusLabel = s => s.on_hand === 0 ? "Out" : s.on_hand <= s.reorder_at ? "Low" : "OK";
  const needsReorder = supplies.filter(s => s.on_hand <= s.reorder_at);
  const filtered = filterCat === "All" ? supplies : supplies.filter(s => s.category === filterCat);

  if (loading) return <div style={S.center}>Loading your supplies...</div>;

  return (
    <div style={S.wrap}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <h1 style={S.h1}>📦 Office Supply Tracker</h1>
          <p style={S.sub}>Sunnyglen.org · Signed in as {userName}</p>
        </div>
        <div style={{ display:"flex",gap:8,alignItems:"center" }}>
          {saving && <span style={S.savingBadge}>Saving...</span>}
          {!notifEnabled && <button onClick={requestNotif} style={S.notifBtn}>🔔 Enable Alerts</button>}
          <button onClick={signOut} style={S.signOutBtn}>Sign out</button>
        </div>
      </div>

      {needsReorder.length > 0 && (
        <div style={S.banner}>⚠️ <strong>{needsReorder.length} item{needsReorder.length > 1 ? "s" : ""} need reordering:</strong> {needsReorder.map(s => s.name).join(", ")}</div>
      )}

      {/* Tabs */}
      <div style={S.tabRow}>
        {[["inventory","📋 Inventory"],["reorder",`🛒 Reorder (${needsReorder.length})`],["log","📝 Orders"],["audit","🔍 Audit Log"]].map(([k,l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ ...S.tab, ...(tab === k ? S.tabActive : {}) }}>{l}</button>
        ))}
        <button onClick={() => { setShowForm(!showForm); setEditId(null); setForm(emptyForm); }} style={S.addBtn}>
          {showForm ? "✕ Cancel" : "+ Add Item"}
        </button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div style={S.formBox}>
          <h3 style={{ margin:"0 0 12px",fontSize:15 }}>{editId ? "Edit Item" : "Add New Item"}</h3>
          <div style={S.grid2}>
            {[["Item Name","name","text"],["Vendor","vendor","text"],["On Hand","on_hand","number"],["Reorder At","reorder_at","number"],["Unit Cost ($)","unit_cost","number"]].map(([lbl,key,type]) => (
              <div key={key}>
                <label style={S.label}>{lbl}</label>
                <input type={type} value={form[key]} min={0} step={type==="number"?"0.01":undefined}
                  onChange={e => setForm({...form,[key]: type==="number" ? parseFloat(e.target.value)||0 : e.target.value})}
                  style={S.input} />
              </div>
            ))}
            <div>
              <label style={S.label}>Category</label>
              <select value={form.category} onChange={e => setForm({...form,category:e.target.value})} style={S.input}>
                {categories.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginTop:10 }}>
            <label style={S.label}>Notes</label>
            <input value={form.notes} onChange={e => setForm({...form,notes:e.target.value})} style={{...S.input,width:"100%",boxSizing:"border-box"}} />
          </div>
          <button onClick={saveItem} style={S.saveBtn}>{editId ? "Save Changes" : "Add Item"}</button>
        </div>
      )}

      {/* Inventory Tab */}
      {tab === "inventory" && (
        <>
          <div style={S.catRow}>
            {["All",...categories].map(c => (
              <button key={c} onClick={() => setFilterCat(c)} style={{...S.catBtn,...(filterCat===c?S.catBtnActive:{})}}>{c}</button>
            ))}
          </div>
          <div style={{ overflowX:"auto" }}>
            <table style={S.table}>
              <thead><tr style={{ background:"#f1f5f9" }}>
                {["Status","Item","On Hand","Reorder At","Vendor","Cost","Actions"].map(h => <th key={h} style={S.th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id} style={{ borderBottom:"1px solid #e2e8f0" }}>
                    <td style={S.td}><span style={{...S.badge,background:statusColor(s)}}>{statusLabel(s)}</span></td>
                    <td style={S.td}><strong>{s.name}</strong>{s.notes&&<div style={{fontSize:11,color:"#94a3b8"}}>{s.notes}</div>}</td>
                    <td style={S.td}>
                      <div style={{ display:"flex",alignItems:"center",gap:4 }}>
                        <button onClick={() => updateQty(s.id,-1)} style={S.qtyBtn}>−</button>
                        <span style={{ minWidth:28,textAlign:"center",fontWeight:700,color:s.on_hand<=s.reorder_at?"#ef4444":"inherit" }}>{s.on_hand}</span>
                        <button onClick={() => updateQty(s.id,1)} style={S.qtyBtn}>+</button>
                      </div>
                    </td>
                    <td style={S.td}>{s.reorder_at}</td>
                    <td style={S.td}>{s.vendor}</td>
                    <td style={S.td}>${Number(s.unit_cost).toFixed(2)}</td>
                    <td style={S.td}>
                      <button onClick={() => editItem(s)} style={S.editBtn}>Edit</button>
                      <button onClick={() => deleteItem(s.id)} style={S.delBtn}>Del</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Reorder Tab */}
      {tab === "reorder" && (
        needsReorder.length === 0
          ? <div style={S.center}>✅ All items are well stocked!</div>
          : <table style={S.table}>
              <thead><tr style={{ background:"#fff7ed" }}>
                {["Item","On Hand","Reorder At","Vendor","Cost","Action"].map(h => <th key={h} style={{...S.th,color:"#92400e"}}>{h}</th>)}
              </tr></thead>
              <tbody>
                {needsReorder.map(s => (
                  <tr key={s.id} style={{ borderBottom:"1px solid #fed7aa" }}>
                    <td style={S.td}><strong>{s.name}</strong></td>
                    <td style={{...S.td,color:s.on_hand===0?"#ef4444":"#f97316",fontWeight:700}}>{s.on_hand}</td>
                    <td style={S.td}>{s.reorder_at}</td>
                    <td style={S.td}>{s.vendor}</td>
                    <td style={S.td}>${Number(s.unit_cost).toFixed(2)}</td>
                    <td style={S.td}><button onClick={() => markOrdered(s)} style={S.orderBtn}>Mark Ordered</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
      )}

      {/* Order Log Tab */}
      {tab === "log" && (
        orderLog.length === 0
          ? <div style={S.center}>No orders logged yet.</div>
          : <table style={S.table}>
              <thead><tr style={{ background:"#f1f5f9" }}>
                {["Date","Item","Vendor","Cost"].map(h => <th key={h} style={S.th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {orderLog.map(e => (
                  <tr key={e.id} style={{ borderBottom:"1px solid #e2e8f0" }}>
                    <td style={S.td}>{new Date(e.ordered_at).toLocaleDateString()}</td>
                    <td style={S.td}>{e.item_name}</td>
                    <td style={S.td}>{e.vendor}</td>
                    <td style={S.td}>${Number(e.unit_cost).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
      )}

      {/* Audit Log Tab */}
      {tab === "audit" && (
        auditLog.length === 0
          ? <div style={S.center}>No activity recorded yet.</div>
          : <table style={S.table}>
              <thead><tr style={{ background:"#f1f5f9" }}>
                {["Date & Time","Who","Action","Item","Details"].map(h => <th key={h} style={S.th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {auditLog.map(e => (
                  <tr key={e.id} style={{ borderBottom:"1px solid #e2e8f0" }}>
                    <td style={{...S.td,color:"#64748b",whiteSpace:"nowrap"}}>{new Date(e.created_at).toLocaleString()}</td>
                    <td style={{...S.td,fontWeight:500}}>{e.user_name}</td>
                    <td style={S.td}>{e.action}</td>
                    <td style={S.td}>{e.item_name}</td>
                    <td style={{...S.td,color:"#64748b"}}>{e.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
      )}
    </div>
  );
}

const S = {
  wrap: { fontFamily:"sans-serif",maxWidth:900,margin:"0 auto",padding:16,color:"#1e293b" },
  header: { background:"#1e3a5f",color:"white",borderRadius:10,padding:"16px 20px",marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center" },
  h1: { margin:0,fontSize:20 },
  sub: { margin:"4px 0 0",fontSize:13,opacity:0.8 },
  savingBadge: { fontSize:12,background:"#f59e0b",padding:"4px 10px",borderRadius:20 },
  notifBtn: { fontSize:12,background:"#22c55e",color:"white",border:"none",padding:"6px 12px",borderRadius:20,cursor:"pointer" },
  signOutBtn: { fontSize:12,background:"rgba(255,255,255,0.15)",color:"white",border:"1px solid rgba(255,255,255,0.3)",padding:"6px 12px",borderRadius:20,cursor:"pointer" },
  banner: { background:"#fff7ed",border:"1px solid #f97316",borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:13 },
  tabRow: { display:"flex",gap:8,marginBottom:16,flexWrap:"wrap" },
  tab: { padding:"7px 16px",borderRadius:6,border:"none",cursor:"pointer",fontSize:13,fontWeight:600,background:"#e2e8f0",color:"#475569" },
  tabActive: { background:"#1e3a5f",color:"white" },
  addBtn: { marginLeft:"auto",padding:"7px 16px",borderRadius:6,border:"none",cursor:"pointer",fontSize:13,fontWeight:600,background:"#2563eb",color:"white" },
  formBox: { background:"#f8fafc",border:"1px solid #cbd5e1",borderRadius:8,padding:16,marginBottom:16 },
  grid2: { display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 },
  label: { fontSize:12,color:"#64748b",display:"block",marginBottom:3 },
  input: { width:"100%",padding:"6px 8px",borderRadius:5,border:"1px solid #cbd5e1",fontSize:13,boxSizing:"border-box" },
  saveBtn: { marginTop:12,padding:"8px 20px",background:"#1e3a5f",color:"white",border:"none",borderRadius:6,cursor:"pointer",fontWeight:600 },
  catRow: { display:"flex",gap:8,marginBottom:12,flexWrap:"wrap" },
  catBtn: { padding:"4px 10px",borderRadius:20,border:"1px solid #cbd5e1",cursor:"pointer",fontSize:12,background:"white",color:"#475569" },
  catBtnActive: { background:"#1e3a5f",color:"white" },
  table: { width:"100%",borderCollapse:"collapse",fontSize:13 },
  th: { padding:"8px 10px",textAlign:"left",fontWeight:600,color:"#475569",whiteSpace:"nowrap" },
  td: { padding:"8px 10px" },
  badge: { color:"white",borderRadius:4,padding:"2px 7px",fontSize:11,fontWeight:700 },
  qtyBtn: { width:24,height:24,border:"1px solid #cbd5e1",borderRadius:4,cursor:"pointer",background:"white",fontSize:15,lineHeight:1 },
  editBtn: { padding:"3px 8px",fontSize:11,border:"1px solid #cbd5e1",borderRadius:4,cursor:"pointer",background:"white",marginRight:4 },
  delBtn: { padding:"3px 8px",fontSize:11,border:"1px solid #fca5a5",borderRadius:4,cursor:"pointer",background:"white",color:"#ef4444" },
  orderBtn: { padding:"4px 12px",background:"#f97316",color:"white",border:"none",borderRadius:5,cursor:"pointer",fontSize:12,fontWeight:600 },
  center: { textAlign:"center",padding:40,color:"#64748b" }
};
