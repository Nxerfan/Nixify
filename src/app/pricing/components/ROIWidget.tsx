"use client";

import { useState, useMemo } from "react";
import { motion, useSpring, useTransform } from "framer-motion";
import { Slider } from "@/components/ui/slider";
import { TrendingDown, Users } from "lucide-react";
import { ROI_CONSTANTS } from "@/lib/pricingData";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * ROI Calculator — interactive widget showing annual savings with Pro vs
 * building in-house. User drags a slider for team size; savings update live.
 */
export function ROIWidget() {
  const [users, setUsers] = useState(10);

  // Assume each user triggers ~20 OTPs/month
  const monthlyOtps = users * 20;
  const annualOtps = monthlyOtps * 12;

  const inHouseCost = useMemo(() => annualOtps * ROI_CONSTANTS.inHouseCostPerOtp, [annualOtps]);
  const proCost = useMemo(
    () => ROI_CONSTANTS.proMonthlyBase * 12 + annualOtps * ROI_CONSTANTS.proCostPerOtp,
    [annualOtps],
  );
  const savings = Math.max(0, inHouseCost - proCost);

  const spring = useSpring(0, { stiffness: 50, damping: 18 });
  const display = useTransform(spring, (v) => `$${Math.round(v).toLocaleString()}`);

  // React to savings changes
  useMemo(() => {
    spring.set(savings);
  }, [savings, spring]);

  return (
    <motion.div
      className="relative overflow-hidden rounded-2xl border border-emerald-500/15 bg-gradient-to-br from-emerald-950/20 to-gray-950/40 p-6 backdrop-blur-xl"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, ease: EASE }}
    >
      <div className="pointer-events-none absolute -top-20 right-0 h-40 w-40 rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="relative flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/15">
          <TrendingDown className="h-4 w-4 text-emerald-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-100">ROI Calculator</h3>
          <p className="text-xs text-gray-600">See how much you save with Pro vs. building in-house</p>
        </div>
      </div>

      {/* Slider */}
      <div className="relative mt-6">
        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs text-gray-400">
            <Users className="h-3.5 w-3.5" /> Team size
          </span>
          <span className="text-sm font-semibold text-gray-100">{users} users</span>
        </div>
        <Slider
          value={[users]}
          onValueChange={(v) => setUsers(v[0])}
          min={1}
          max={50}
          step={1}
          className="[&_[role=slider]]:bg-emerald-500 [&_[role=slider]]:border-emerald-400"
        />
        <div className="mt-1 flex justify-between text-xs text-gray-700">
          <span>1</span>
          <span>~{monthlyOtps.toLocaleString()} OTPs/mo</span>
          <span>50</span>
        </div>
      </div>

      {/* Results */}
      <div className="relative mt-6 grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-gray-800/40 bg-gray-900/20 p-3 text-center">
          <p className="text-xs text-gray-600">In-house</p>
          <p className="mt-1 text-lg font-bold text-gray-300">${Math.round(inHouseCost).toLocaleString()}</p>
          <p className="text-xs text-gray-700">/year</p>
        </div>
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-center">
          <p className="text-xs text-emerald-400/70">Nixify Pro</p>
          <p className="mt-1 text-lg font-bold text-emerald-400">${Math.round(proCost).toLocaleString()}</p>
          <p className="text-xs text-emerald-700">/year</p>
        </div>
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-center">
          <p className="text-xs text-emerald-300/80">You save</p>
          <motion.p className="mt-1 text-lg font-bold text-emerald-300" style={{ y: 0 }}>
            <motion.span>{display}</motion.span>
          </motion.p>
          <p className="text-xs text-emerald-700">/year</p>
        </div>
      </div>
    </motion.div>
  );
}
