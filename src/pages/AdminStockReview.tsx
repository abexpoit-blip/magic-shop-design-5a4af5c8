import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { buildApiUrl, getToken } from "@/lib/api";
import { RefreshCw, Package, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface StockEntry {
  base: string;
  brand: string;
  country: string;
  count: number;
  created_at: string;
  seller_username?: string;
}

interface AllBaseRow {
  base: string;
  total: number;
  available: number;
  expired: number;
  sold: number;
}

export default function AdminStockReview() {
  const [recentStock, setRecentStock] = useState<StockEntry[]>([]);
  const [allBases, setAllBases] = useState<AllBaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [discounting, setDiscounting] = useState(false);

  const headers = () => ({ Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [recentRes, basesRes] = await Promise.all([
        fetch(buildApiUrl("/cards/recent-stock"), { headers: headers() }),
        fetch(buildApiUrl("/cards/stock-summary"), { headers: headers() }),
      ]);
      const recent = await recentRes.json();
      const bases = await basesRes.json();
      setRecentStock(recent.stock || []);
      setAllBases(bases.summary || []);
    } catch {
      toast.error("Failed to load stock data");
    } finally {
      setLoading(false);
    }
  };

  const runAutoDiscount = async () => {
    setDiscounting(true);
    try {
      const res = await fetch(buildApiUrl("/cards/auto-discount-expiring"), {
        method: "POST",
        headers: headers(),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(`Discounted ${data.updated} cards expiring this month to $0.20`);
        fetchData();
      } else {
        toast.error(data.error || "Failed");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setDiscounting(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  return (
    <AdminLayout title="Stock Review">
      <div className="space-y-6">
        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          <Button onClick={fetchData} variant="outline" size="sm" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={runAutoDiscount} variant="destructive" size="sm" disabled={discounting}>
            <TrendingUp className="h-4 w-4 mr-2" />
            {discounting ? "Discounting…" : "Auto-discount expiring cards → $0.20"}
          </Button>
        </div>

        {/* Recent Stock Feed (last 7 days) */}
        <div className="glass-neon rounded-2xl p-6">
          <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <Package className="h-5 w-5 text-primary-glow" />
            Recent Stock Additions (Last 7 Days)
          </h2>
          {recentStock.length === 0 ? (
            <p className="text-muted-foreground text-sm">No recent uploads</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-muted-foreground">
                    <th className="text-left py-2 px-3">Base</th>
                    <th className="text-left py-2 px-3">Brand</th>
                    <th className="text-left py-2 px-3">Country</th>
                    <th className="text-right py-2 px-3">Count</th>
                    <th className="text-left py-2 px-3">Last Upload</th>
                  </tr>
                </thead>
                <tbody>
                  {recentStock.map((s, i) => (
                    <tr key={i} className="border-b border-border/20 hover:bg-secondary/30">
                      <td className="py-2 px-3 font-mono text-primary-glow">{s.base || "—"}</td>
                      <td className="py-2 px-3">{s.brand}</td>
                      <td className="py-2 px-3">{s.country}</td>
                      <td className="py-2 px-3 text-right font-bold text-green-400">+{s.count}</td>
                      <td className="py-2 px-3 text-muted-foreground">{new Date(s.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Full Stock Summary by Base */}
        <div className="glass-neon rounded-2xl p-6">
          <h2 className="text-lg font-bold text-foreground mb-4">All Bases — Stock Summary</h2>
          {allBases.length === 0 ? (
            <p className="text-muted-foreground text-sm">No cards in database</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-muted-foreground">
                    <th className="text-left py-2 px-3">Base</th>
                    <th className="text-right py-2 px-3">Total</th>
                    <th className="text-right py-2 px-3">Available</th>
                    <th className="text-right py-2 px-3">Sold</th>
                    <th className="text-right py-2 px-3">Expired</th>
                  </tr>
                </thead>
                <tbody>
                  {allBases.map((b, i) => (
                    <tr key={i} className="border-b border-border/20 hover:bg-secondary/30">
                      <td className="py-2 px-3 font-mono text-primary-glow">{b.base || "—"}</td>
                      <td className="py-2 px-3 text-right">{b.total}</td>
                      <td className="py-2 px-3 text-right text-green-400 font-bold">{b.available}</td>
                      <td className="py-2 px-3 text-right text-yellow-400">{b.sold}</td>
                      <td className="py-2 px-3 text-right text-red-400">{b.expired}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
