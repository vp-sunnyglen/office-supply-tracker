// app/api/alert/route.js
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(req) {
  const { supply } = await req.json();

  // Get all alert subscribers from DB
  const { data: subscribers } = await supabase.from("alert_subscribers").select("email");
  const emails = (subscribers || []).map(s => s.email);
  if (!emails.length) return Response.json({ ok: true });

  // Send email via Gmail SMTP
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: `"Office Supply Tracker" <${process.env.GMAIL_USER}>`,
    to: emails.join(", "),
    subject: `⚠️ Low Stock Alert: ${supply.name}`,
    html: `
      <div style="font-family:sans-serif;max-width:500px;margin:0 auto">
        <div style="background:#1e3a5f;color:white;padding:20px;border-radius:8px 8px 0 0">
          <h2 style="margin:0">📦 Office Supply Alert</h2>
          <p style="margin:4px 0 0;opacity:0.8">Sunnyglen.org Supply Tracker</p>
        </div>
        <div style="border:1px solid #e2e8f0;border-top:none;padding:20px;border-radius:0 0 8px 8px">
          <p><strong>${supply.name}</strong> has reached its reorder point.</p>
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <tr style="background:#f8fafc"><td style="padding:8px;border:1px solid #e2e8f0"><strong>Current Stock</strong></td><td style="padding:8px;border:1px solid #e2e8f0;color:#ef4444"><strong>${supply.on_hand} remaining</strong></td></tr>
            <tr><td style="padding:8px;border:1px solid #e2e8f0"><strong>Reorder Point</strong></td><td style="padding:8px;border:1px solid #e2e8f0">${supply.reorder_at}</td></tr>
            <tr style="background:#f8fafc"><td style="padding:8px;border:1px solid #e2e8f0"><strong>Vendor</strong></td><td style="padding:8px;border:1px solid #e2e8f0">${supply.vendor || "N/A"}</td></tr>
            <tr><td style="padding:8px;border:1px solid #e2e8f0"><strong>Est. Unit Cost</strong></td><td style="padding:8px;border:1px solid #e2e8f0">$${Number(supply.unit_cost).toFixed(2)}</td></tr>
          </table>
          <p style="margin-top:20px;color:#64748b;font-size:13px">Log in to the supply tracker to place the order and mark it as ordered.</p>
        </div>
      </div>
    `,
  });

  return Response.json({ ok: true });
}
