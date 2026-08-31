"use client";
import { useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from "lucide-react";

export type AlertType = "success" | "error" | "warning" | "info";

interface AlertProps {
  type: AlertType;
  message: string;
  onClose: () => void;
  duration?: number;
}

const styles: Record<AlertType, { border: string; Icon: typeof CheckCircle }> = {
  success: { border: "rgb(34,197,94)", Icon: CheckCircle },
  error: { border: "rgb(239,68,68)", Icon: AlertCircle },
  warning: { border: "rgb(234,179,8)", Icon: AlertTriangle },
  info: { border: "var(--accent-primary)", Icon: Info },
};

export default function Alert({ type, message, onClose, duration = 4000 }: AlertProps) {
  const { border, Icon } = styles[type];

  useEffect(() => {
    if (duration <= 0) return;
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [duration, onClose, message, type]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      role={type === "error" || type === "warning" ? "alert" : "status"}
      aria-live={type === "error" || type === "warning" ? "assertive" : "polite"}
      className="fixed right-6 top-6 z-[10050] flex min-w-[300px] max-w-[400px] items-center gap-3 rounded-md p-4 shadow-lg backdrop-blur-md"
      style={{ backgroundColor: "var(--bg-surface, #ffffff)", borderLeft: `4px solid ${border}` }}
    >
      <div className="flex items-center justify-center" style={{ color: border }}>
        <Icon size={24} />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-text-primary">{message}</p>
      </div>
      <button onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-text-muted hover:text-text-primary" aria-label="Close alert">
        <X size={18} />
      </button>
    </motion.div>
  );
}
