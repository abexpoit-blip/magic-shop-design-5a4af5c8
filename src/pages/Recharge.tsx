import { useEffect, useState, useRef, useCallback } from "react";
import { AppShell } from "@/components/AppShell";
import { depositsApi, plisioApi } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Bitcoin, Wallet, CheckCircle2, Copy, Clock, XCircle, Loader2, QrCode, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";

interface Deposit { id: string; amount: number; method: string; txid: string | null; status: string; created_at: string; crypto_currency?: string; plisio_wallet?: string; confirmations?: number; }
interface PlisioCurrency { id: string; name: string; icon: string; min: string; }

const CRYPTO_URI_PREFIX: Record<string, string> = {
  BTC: "bitcoin",
  LTC: "litecoin",
  ETH: "ethereum",
  USDT: "tether",
  TRX: "tron",
  DOGE: "dogecoin",
  BCH: "bitcoincash",
};

const Recharge = () => {
  const { profile } = useAuth();
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("LTC");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<Deposit[]>([]);
  const [currencies, setCurrencies] = useState<PlisioCurrency[]>([]);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Active invoice state
  const [activeInvoice, setActiveInvoice] = useState<{
    deposit_id: string; wallet_address: string; crypto_amount: string;
    currency: string; invoice_url: string; qr_data: string; status: string; confirmations: number;
    usd_amount: number;
  } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadHistory = async () => {
    try {
      const d = await depositsApi.mine();
      setHistory((d.deposits ?? []) as unknown as Deposit[]);
    } catch { /* ignore */ }
  };

  const loadCurrencies = async () => {
    try {
      const c = await plisioApi.currencies();
      if (c.currencies?.length) setCurrencies(c.currencies);
      else setCurrencies([
        { id: "LTC", name: "Litecoin", icon: "", min: "0" },
        { id: "BTC", name: "Bitcoin", icon: "", min: "0" },
        { id: "USDT", name: "Tether", icon: "", min: "0" },
        { id: "TRX", name: "Tron", icon: "", min: "0" },
      ]);
    } catch {
      setCurrencies([
        { id: "LTC", name: "Litecoin", icon: "", min: "0" },
        { id: "BTC", name: "Bitcoin", icon: "", min: "0" },
        { id: "USDT", name: "Tether", icon: "", min: "0" },
      ]);
    }
  };

  useEffect(() => { loadHistory(); loadCurrencies(); }, []);

  // Poll for active invoice status
  const startPolling = useCallback((depositId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const s = await plisioApi.status(depositId);
        setActiveInvoice(prev => prev ? { ...prev, status: s.status, confirmations: s.confirmations ?? 0 } : prev);
        if (s.status === "approved") {
          toast.success(`$${s.amount} credited to your balance!`);
          setActiveInvoice(null);
          if (pollRef.current) clearInterval(pollRef.current);
          loadHistory();
        } else if (s.status === "rejected") {
          toast.error("Deposit expired or cancelled.");
          setActiveInvoice(null);
          if (pollRef.current) clearInterval(pollRef.current);
          loadHistory();
        }
      } catch { /* continue polling */ }
    }, 10_000);
  }, []);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const createInvoice = async () => {
    const amt = Number(amount);
    if (!amt || amt < 5) return toast.error("Minimum deposit is $5");
    setBusy(true);
    try {
      const inv = await plisioApi.createInvoice({ amount: amt, currency });
      setActiveInvoice({
        deposit_id: inv.deposit_id,
        wallet_address: inv.wallet_address || inv.qr_data || "",
        crypto_amount: inv.crypto_amount,
        currency: inv.currency || currency,
        invoice_url: inv.invoice_url,
        qr_data: inv.qr_data || inv.wallet_address || "",
        status: "pending",
        confirmations: 0,
        usd_amount: amt,
      });
      startPolling(inv.deposit_id);
      toast.success("Invoice created! Send crypto to the address below.");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to create invoice");
    } finally {
      setBusy(false);
    }
  };

  const copyField = (txt: string, field: string) => {
    navigator.clipboard.writeText(txt);
    setCopiedField(field);
    toast.success("Copied!");
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Build crypto URI for QR (e.g. litecoin:LXyz...?amount=0.09)
  const buildQrValue = () => {
    if (!activeInvoice) return "";
    const prefix = CRYPTO_URI_PREFIX[activeInvoice.currency.toUpperCase()] || "";
    const addr = activeInvoice.qr_data || activeInvoice.wallet_address;
    if (prefix && activeInvoice.crypto_amount) {
      return `${prefix}:${addr}?amount=${activeInvoice.crypto_amount}`;
    }
    return addr;
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-5xl">
        <h1 className="font-display text-3xl font-black neon-text">RECHARGE CENTER</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Deposit form or active invoice */}
          <section className="glass-neon rounded-2xl p-6">
            <div className="flex items-center gap-2 text-primary-glow mb-3">
              <Wallet className="h-5 w-5" />
              <h2 className="font-display tracking-wider">YOUR BALANCE</h2>
            </div>
            <p className="font-display text-5xl font-black neon-text mb-6">
              ${Number(profile?.balance ?? 0).toFixed(2)}
            </p>

            {activeInvoice ? (
              /* ─── Active Invoice: Show everything on this page ─── */
              <div className="space-y-5">
                {/* Amount summary */}
                <div className="text-center p-3 rounded-xl bg-primary/10 border border-primary/30">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">You are depositing</p>
                  <p className="font-display text-2xl font-black text-primary-glow mt-1">
                    ${activeInvoice.usd_amount.toFixed(2)}
                  </p>
                </div>

                {/* QR Code - large and centered */}
                <div className="flex justify-center">
                  <div className="p-4 bg-white rounded-2xl shadow-lg">
                    <QRCodeSVG
                      value={buildQrValue()}
                      size={200}
                      level="M"
                      includeMargin={false}
                    />
                  </div>
                </div>
                <p className="text-[10px] text-center text-muted-foreground">
                  Scan with your {activeInvoice.currency} wallet app
                </p>

                {/* Crypto amount - copyable */}
                <div className="p-4 rounded-xl bg-background/60 border border-primary/40 space-y-1">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Send exactly
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-lg font-bold text-primary-glow flex-1 break-all">
                      {activeInvoice.crypto_amount} {activeInvoice.currency}
                    </span>
                    <button
                      onClick={() => copyField(activeInvoice.crypto_amount, "amount")}
                      className="shrink-0 p-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary-glow transition"
                    >
                      {copiedField === "amount" ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Wallet address - copyable */}
                <div className="p-4 rounded-xl bg-background/60 border border-border/40 space-y-1">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    To this {activeInvoice.currency} address
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs text-foreground/90 break-all flex-1 font-mono leading-relaxed">
                      {activeInvoice.wallet_address}
                    </code>
                    <button
                      onClick={() => copyField(activeInvoice.wallet_address, "address")}
                      className="shrink-0 p-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary-glow transition"
                    >
                      {copiedField === "address" ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Warning */}
                <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/30">
                  <AlertCircle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                  <p className="text-xs text-warning/90">
                    Send <strong>only {activeInvoice.currency}</strong> to this address.
                    Sending any other coin will result in permanent loss.
                  </p>
                </div>

                {/* Status */}
                <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-secondary/40 border border-border/40">
                  <Loader2 className="h-4 w-4 animate-spin text-primary-glow" />
                  <span className="text-sm text-foreground/80">
                    {activeInvoice.status === "pending" ? "Waiting for payment..." :
                     `Status: ${activeInvoice.status} (${activeInvoice.confirmations} confirmations)`}
                  </span>
                </div>

                <Button variant="outline" size="sm" className="w-full" onClick={() => {
                  setActiveInvoice(null);
                  if (pollRef.current) clearInterval(pollRef.current);
                }}>
                  Cancel
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  ✅ Your balance is credited <strong>automatically</strong> once payment is confirmed on the blockchain (~2-10 min).
                </p>
              </div>
            ) : (
              /* New Deposit Form */
              <div className="space-y-4">
                <div className="grid grid-cols-4 gap-2">
                  {(currencies.length ? currencies : [{ id: "LTC" }, { id: "BTC" }, { id: "USDT" }, { id: "TRX" }]).map((c) => (
                    <button key={c.id} onClick={() => setCurrency(c.id)}
                      className={`px-2 py-2 rounded-lg border text-xs font-display tracking-wider transition ${
                        currency === c.id
                          ? "bg-primary/20 border-primary text-primary-glow"
                          : "bg-secondary/40 border-border/50 text-foreground/70 hover:border-primary/40"
                      }`}>
                      {c.id}
                    </button>
                  ))}
                </div>

                <div>
                  <label className="text-xs uppercase tracking-wider text-muted-foreground">Amount (USD)</label>
                  <Input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min={5}
                    placeholder="50" className="mt-1.5 bg-input/60 text-2xl font-display h-14" />
                </div>

                <Button onClick={createInvoice} disabled={busy} className="w-full bg-gradient-primary shadow-neon h-12">
                  {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Bitcoin className="h-4 w-4 mr-2" />}
                  Generate Payment Address
                </Button>
                <p className="text-xs text-muted-foreground">
                  A unique {currency} address will be generated. Send crypto → balance is credited <strong>automatically</strong> after blockchain confirmation.
                </p>
              </div>
            )}
          </section>

          {/* Right: Bonus table */}
          <section className="glass rounded-2xl p-6">
            <h2 className="font-display tracking-wider mb-3 text-primary-glow">TOP-UP BONUS</h2>
            <ul className="space-y-2.5">
              {[["$500", "$35 bonus"], ["$1,000", "$100 bonus"], ["$2,000", "$240 bonus"], ["$5,000", "$750 bonus"]].map(([a, b]) => (
                <li key={a} className="flex items-center justify-between p-3 rounded-lg bg-secondary/40 border border-border/40">
                  <span className="font-display text-foreground">{a}</span>
                  <span className="text-primary-glow font-medium flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" />{b}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground mt-4">Bonus credited automatically after deposit confirmation.</p>

            <div className="mt-6 p-4 rounded-xl bg-background/40 border border-border/40">
              <h3 className="font-display text-sm tracking-wider text-foreground/80 mb-2 flex items-center gap-2">
                <QrCode className="h-4 w-4 text-primary-glow" /> HOW IT WORKS
              </h3>
              <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                <li>Enter USD amount and choose crypto</li>
                <li>Click "Generate Payment Address"</li>
                <li>Send the exact crypto amount shown</li>
                <li>Wait for blockchain confirmation (~2-10 min)</li>
                <li>Balance credited automatically ✅</li>
              </ol>
            </div>
          </section>
        </div>

        {/* Recent deposits */}
        <section className="glass rounded-2xl p-6">
          <h3 className="font-display tracking-wider mb-3 text-primary-glow">RECENT DEPOSITS</h3>
          <div className="space-y-2">
            {history.length === 0 && <p className="text-sm text-muted-foreground">No deposits yet.</p>}
            {history.map((d) => (
              <div key={d.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/40 border border-border/40">
                <div>
                  <p className="font-display text-foreground">
                    ${Number(d.amount).toFixed(2)}
                    <span className="text-xs text-muted-foreground ml-2">· {d.crypto_currency || d.method}</span>
                  </p>
                  {d.txid && <p className="text-[10px] font-mono text-muted-foreground truncate max-w-[260px] sm:max-w-md">{d.txid}</p>}
                </div>
                <span className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${
                  d.status === "approved" ? "bg-success/20 text-success" :
                  d.status === "rejected" ? "bg-destructive/20 text-destructive" : "bg-warning/20 text-warning"
                }`}>
                  {d.status === "approved" ? <CheckCircle2 className="h-3 w-3" /> :
                   d.status === "rejected" ? <XCircle className="h-3 w-3" /> :
                   <Clock className="h-3 w-3" />}
                  {d.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
};

export default Recharge;
