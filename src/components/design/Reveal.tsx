"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cardHover, cardVariants, revealVariants, rashaMotion, staggerVariants } from "./motion";

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "section";
};

export function Reveal({ children, className, delay = 0, as = "div" }: RevealProps) {
  const reduceMotion = useReducedMotion();
  const Component = as === "section" ? motion.section : motion.div;

  return (
    <Component
      className={className}
      initial={reduceMotion ? false : "hidden"}
      whileInView="visible"
      viewport={{ once: true, amount: 0.18 }}
      variants={revealVariants}
      transition={{ ...rashaMotion.enter, delay }}
    >
      {children}
    </Component>
  );
}

export function RevealGroup({ children, className }: Omit<RevealProps, "delay" | "as">) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : "hidden"}
      whileInView="visible"
      viewport={{ once: true, amount: 0.12 }}
      variants={staggerVariants}
    >
      {children}
    </motion.div>
  );
}

// Use as a child of RevealGroup to inherit the stagger. Hover motion is intentionally subtle.
export function RevealItem({ children, className }: Omit<RevealProps, "delay" | "as">) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      variants={cardVariants}
      whileHover={reduceMotion ? undefined : cardHover}
      whileTap={reduceMotion ? undefined : { scale: 0.995 }}
    >
      {children}
    </motion.div>
  );
}
