"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { rashaMotion } from "./motion";

const SEEN_KEY = "rasha-intro-seen-v1";
const INTRO_IMAGE = "/assets/optimized/intro/rasha-intro.webp";

export function CinematicIntro() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduceMotion.matches) return;

    try {
      if (window.localStorage.getItem(SEEN_KEY) === "1") return;
      window.localStorage.setItem(SEEN_KEY, "1");
    } catch {
      // If storage is unavailable, skip the intro rather than replay it on every route.
      return;
    }

    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), 1_330);
    const onMotionPreferenceChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        window.clearTimeout(timer);
        setVisible(false);
      }
    };
    reduceMotion.addEventListener("change", onMotionPreferenceChange);

    return () => {
      window.clearTimeout(timer);
      reduceMotion.removeEventListener("change", onMotionPreferenceChange);
    };
  }, []);

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          className="rasha-intro"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: rashaMotion.exit }}
          role="status"
          aria-live="polite"
          dir="rtl"
        >
          <motion.div
            className="rasha-intro__glow"
            aria-hidden="true"
            initial={{ opacity: 0.35, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
          <div className="rasha-intro__content">
            <motion.span
              className="rasha-intro__wordmark"
              initial={{ opacity: 0, y: 7, filter: "blur(5px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
              dir="ltr"
            >
              RASHA
            </motion.span>
            <motion.span
              className="rasha-gold-rule rasha-intro__rule"
              aria-hidden="true"
              initial={{ scaleX: 0.2, opacity: 0.55 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ duration: 0.45, delay: 0.18, ease: "easeOut" }}
            />
            <motion.p
              className="rasha-intro__line"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.38, delay: 0.28 }}
            >
              لكل رائحة حكاية...
            </motion.p>
            <motion.img
              className="rasha-intro__bottle"
              src={INTRO_IMAGE}
              alt=""
              aria-hidden="true"
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.48, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
          <button className="rasha-intro__skip" type="button" onClick={() => setVisible(false)}>
            تخطّي المقدمة
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
