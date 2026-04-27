import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { BRANDS, COUNTRIES, BrandLogo, countryFlag } from "@/lib/brands";
import { Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

interface CardRow { id: string; bin: string; brand: string; country: string; price: number; status: string; base: string; created_at: string; }

const SellerPanel = () => {
  const { user } = useAuth();
  const [cards, setCards] = useState<CardRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [bulk, setBulk] = useState("");
  const [form, setForm] = useState({
    bin: "", brand: "VISA", country: "US", state: "", city: "", zip: "",
    exp_month: "", exp_year: "", price: "1.5", base: "", refundable: false, has_phone: true, has_email: true,
  });

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("cards").select("*").eq("seller_id", user.id).order("created_at", { ascending: false });
    setCards((data ?? []) as CardRow[]);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);

  const submit = async () => {
    if (!user || !form.bin || !form.price) return toast.error("BIN and price required");
    const { error } = await supabase.from("cards").insert({
      seller_id: user.id, ...form, price: Number(form.price), base: form.base || `${new Date().toISOString().slice(0,10)}_${form.country}_${form.brand}_$${form.price}`,
    });
    if (error) return toast.error(error.message);
    toast.success("Card listed"); setShowForm(false); load();
    setForm({ ...form, bin: "" });
  };

  const bulkUpload = async () => {
    if (!user || !bulk) return;
    const lines = bulk.trim().split("\n").filter(Boolean);
    const rows = lines.map((line) => {
      const [bin, brand, country, state, city, zip, exp_month, exp_year, price] = line.split(",").map((s) => s.trim());
      return {
        seller_id: user.id, bin, brand: (brand || "VISA").toUpperCase(), country: (country || "US").toUpperCase(),
        state, city, zip, exp_month, exp_year, price: Number(price || 1.5),
        base: `${new Date().toISOString().slice(0,10)}_${country}_${brand}_$${price}`,
        refundable: false, has_phone: true, has_email: true,
      };
    });
    const { error } = await supabase.from("cards").insert(rows);
    if (error) return toast.error(error.message);
    toast.success(`Uploaded ${rows.length} cards`); setBulk(""); load();
  };

  const remove = async (id: string) => {
    await supabase.from("cards").delete().eq("id", id);
    load();
  };

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-display text-3xl font-black neon-text">SELLER PANEL</h1>
            <p className="text-sm text-muted-foreground mt-1">{cards.length} listed · {cards.filter((c) => c.status === "sold").length} sold</p>
          </div>
          <Button onClick={() => setShowForm(!showForm)} className="bg-gradient-primary shadow-neon">
            <Plus className="h-4 w-4 mr-1" />List new card
          </Button>
        </div>

        {showForm && (
          <section className="glass-neon rounded-2xl p-6">
            <h2 className="font-display tracking-wider text-primary-glow mb-4">NEW CARD</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Field label="BIN"><Input value={form.bin} onChange={(e) => setForm({ ...form, bin: e.target.value })} className="bg-input/60" /></Field>
              <Field label="Brand">
                <Select value={form.brand} onValueChange={(v) => setForm({ ...form, brand: v })}>
                  <SelectTrigger className="bg-input/60"><SelectValue /></SelectTrigger>
                  <SelectContent>{BRANDS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Country">
                <Select value={form.country} onValueChange={(v) => setForm({ ...form, country: v })}>
                  <SelectTrigger className="bg-input/60"><SelectValue /></SelectTrigger>
                  <SelectContent>{COUNTRIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.flag} {c.name}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Price (USD)"><Input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="bg-input/60" /></Field>
              <Field label="State"><Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} className="bg-input/60" /></Field>
              <Field label="City"><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="bg-input/60" /></Field>
              <Field label="ZIP"><Input value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} className="bg-input/60" /></Field>
              <Field label="Exp MM/YY">
                <div className="flex gap-2">
                  <Input value={form.exp_month} onChange={(e) => setForm({ ...form, exp_month: e.target.value })} placeholder="MM" className="bg-input/60" />
                  <Input value={form.exp_year} onChange={(e) => setForm({ ...form, exp_year: e.target.value })} placeholder="YY" className="bg-input/60" />
                </div>
              </Field>
            </div>
            <Button onClick={submit} className="mt-4 bg-gradient-primary shadow-neon">Publish</Button>
          </section>
        )}

        <section className="glass rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <Upload className="h-4 w-4 text-primary-glow" />
            <h2 className="font-display tracking-wider text-primary-glow">BULK UPLOAD</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-2">CSV format: <code className="text-primary-glow">bin,brand,country,state,city,zip,exp_month,exp_year,price</code></p>
          <Textarea rows={6} value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder="411111,VISA,US,NY,New York,10001,12,28,1.5" className="bg-input/60 font-mono text-xs" />
          <Button onClick={bulkUpload} className="mt-3 bg-gradient-primary shadow-neon">Upload all</Button>
        </section>

        <div className="glass rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-3 text-left">Brand</th>
                <th className="p-3 text-left">BIN</th>
                <th className="p-3 text-left">Country</th>
                <th className="p-3 text-right">Price</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {cards.map((c) => (
                <tr key={c.id} className="border-t border-border/40 hover:bg-secondary/30">
                  <td className="p-3"><BrandLogo brand={c.brand} /></td>
                  <td className="p-3 font-mono">{c.bin}</td>
                  <td className="p-3">{countryFlag(c.country)} {c.country}</td>
                  <td className="p-3 text-right font-display text-primary-glow">${Number(c.price).toFixed(2)}</td>
                  <td className="p-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      c.status === "available" ? "bg-success/20 text-success" :
                      c.status === "sold" ? "bg-muted text-muted-foreground" : "bg-warning/20 text-warning"
                    }`}>{c.status}</span>
                  </td>
                  <td className="p-3 text-right">
                    <button onClick={() => remove(c.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {cards.length === 0 && (
                <tr><td colSpan={6} className="p-12 text-center text-muted-foreground">No cards listed yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</label>
    <div className="mt-1">{children}</div>
  </div>
);

export default SellerPanel;
