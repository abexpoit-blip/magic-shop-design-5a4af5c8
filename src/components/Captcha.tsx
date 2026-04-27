import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";

export const Captcha = ({ value, onChange, onValidChange }: {
  value: string;
  onChange: (v: string) => void;
  onValidChange?: (ok: boolean) => void;
}) => {
  const [a, setA] = useState(0);
  const [b, setB] = useState(0);
  const [op, setOp] = useState<"+" | "-" | "*">("+");

  const refresh = () => {
    setA(Math.floor(Math.random() * 9) + 1);
    setB(Math.floor(Math.random() * 9) + 1);
    setOp((["+", "-", "*"] as const)[Math.floor(Math.random() * 3)]);
    onChange("");
  };

  useEffect(() => { refresh(); }, []);

  const expected = op === "+" ? a + b : op === "-" ? a - b : a * b;

  useEffect(() => {
    onValidChange?.(value.trim() !== "" && Number(value) === expected);
  }, [value, expected, onValidChange]);

  return (
    <div className="flex items-center gap-2">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="verification code"
        className="bg-input/60 border-border/60 backdrop-blur"
      />
      <button
        type="button"
        onClick={refresh}
        className="font-display text-sm px-3 py-2 rounded-md glass-neon text-primary-glow hover:scale-[1.03] transition-transform flex items-center gap-2 min-w-[88px] justify-center"
      >
        {a}{op}{b}=?
        <RefreshCw className="h-3 w-3 opacity-60" />
      </button>
    </div>
  );
};
