"use client";

import { motion } from "framer-motion";

/**
 * AnimatedText — reveals text word-by-word with a staggered fade+slide-up.
 * Used for the tagline + headings on the auth page.
 */

interface AnimatedTextProps {
  text: string;
  className?: string;
  delay?: number;
  stagger?: number;
}

const EASE = [0.22, 1, 0.36, 1] as const;

export function AnimatedText({ text, className = "", delay = 0, stagger = 0.06 }: AnimatedTextProps) {
  const words = text.split(" ");

  return (
    <motion.span
      className={className}
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: stagger, delayChildren: delay } } }}
    >
      {words.map((word, i) => (
        <motion.span
          key={i}
          className="inline-block"
          variants={{
            hidden: { opacity: 0, y: 12, filter: "blur(4px)" },
            show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.5, ease: EASE } },
          }}
        >
          {word}&nbsp;
        </motion.span>
      ))}
    </motion.span>
  );
}
