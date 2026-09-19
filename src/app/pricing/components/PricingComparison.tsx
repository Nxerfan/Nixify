"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Check, Minus, HelpCircle } from "lucide-react";
import type { ComparisonRow } from "@/lib/pricingData";
import { useTranslations } from "@/lib/i18n/LocaleProvider";

const EASE = [0.22, 1, 0.36, 1] as const;

interface Props {
  rows: ComparisonRow[];
  loading: boolean;
}

export function PricingComparison({ rows, loading }: Props) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });
  const t = useTranslations();

  if (loading)
    return (
      <div className="h-64 animate-pulse rounded-xl border border-gray-800/40 bg-gray-950/30" />
    );

  return (
    <TooltipProvider delayDuration={200}>
      <motion.div
        ref={ref}
        className="overflow-hidden rounded-2xl border border-gray-800/40 bg-gray-950/40 backdrop-blur-xl"
        initial={{ opacity: 0, y: 20 }}
        animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.5, ease: EASE }}
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-gray-800/50 hover:bg-transparent">
                <TableHead className="px-4 py-4 text-xs font-medium uppercase tracking-wider text-gray-600">
                  {t("pricing.compare.columnFeature")}
                </TableHead>
                <TableHead className="px-4 py-4 text-center text-xs font-medium uppercase tracking-wider text-gray-600">
                  Free
                </TableHead>
                <TableHead className="px-4 py-4 text-center text-xs font-medium uppercase tracking-wider text-emerald-400">
                  Pro
                </TableHead>
                <TableHead className="px-4 py-4 text-center text-xs font-medium uppercase tracking-wider text-gray-600">
                  Max
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, i) => (
                <motion.tr
                  key={row.feature}
                  className="border-b border-gray-800/30 last:border-0 transition-colors hover:bg-emerald-500/[0.02]"
                  initial={{ opacity: 0 }}
                  animate={inView ? { opacity: 1 } : { opacity: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.3 }}
                >
                  <TableCell className="px-4 py-4">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm text-gray-300">
                        {row.feature}
                      </span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            className="text-gray-600 transition-colors hover:text-emerald-400"
                            aria-label={`${t("pricing.compare.infoAbout")} ${row.feature}`}
                          >
                            <HelpCircle className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          className="max-w-xs border-emerald-500/20 bg-[#060907] text-xs text-gray-300"
                        >
                          {row.tooltip}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-4 text-center">
                    <Cell v={row.free} />
                  </TableCell>
                  <TableCell className="px-4 py-4 text-center bg-emerald-500/[0.03]">
                    <Cell v={row.pro} />
                  </TableCell>
                  <TableCell className="px-4 py-4 text-center">
                    <Cell v={row.max} />
                  </TableCell>
                </motion.tr>
              ))}
            </TableBody>
          </Table>
        </div>
      </motion.div>
    </TooltipProvider>
  );
}

function Cell({ v }: { v: boolean | string }) {
  if (v === true) return <Check className="mx-auto h-4 w-4 text-emerald-400" />;
  if (v === false) return <Minus className="mx-auto h-4 w-4 text-gray-700" />;
  return <span className="text-xs text-gray-400">{v}</span>;
}
