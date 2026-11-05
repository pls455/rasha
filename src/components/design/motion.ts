import type { Transition, Variants } from "framer-motion";

export const rashaMotion = {
  enter: { duration: 0.48, ease: [0.22, 1, 0.36, 1] } satisfies Transition,
  exit: { duration: 0.22, ease: [0.4, 0, 1, 1] } satisfies Transition,
  stagger: 0.065,
  page: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } satisfies Transition,
} as const;

// Small offsets and near-opaque starting values keep SSR content readable if JS fails.
export const revealVariants: Variants = {
  hidden: { opacity: 0.94, y: 12 },
  visible: { opacity: 1, y: 0, transition: rashaMotion.enter },
};

export const staggerVariants: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: rashaMotion.stagger, delayChildren: 0.04 },
  },
};

export const cardVariants: Variants = {
  hidden: { opacity: 0.96, y: 10 },
  visible: { opacity: 1, y: 0, transition: rashaMotion.enter },
};

export const cardHover = {
  y: -3,
  scale: 1.008,
  transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] } satisfies Transition,
};
