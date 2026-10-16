"use client";

/**
 * AgentOrb.tsx — Sphère vocale + anneaux pointillés contre-rotatifs
 * États : idle, listening, thinking, speaking (mêmes props qu'avant)
 * Synchro voix : le parent met pulseRef.current = 1 à chaque mot (onboundary).
 */

import * as React from "react";
import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";

export type OrbState = "idle" | "listening" | "thinking" | "speaking";

interface AgentOrbProps {
  orbState: OrbState;
  size?: number;
  centerText?: string;
  pulseRef?: React.MutableRefObject<number>;
}

// h1 = sphère, h2 = anneaux/particules, spin = vitesse des anneaux
const TARGETS: Record<OrbState, { h1: number; h2: number; spin: number }> = {
  idle:      { h1: 240, h2: 215, spin: 0.6 },
  listening: { h1: 214, h2: 190, spin: 1.0 },
  thinking:  { h1: 274, h2: 300, spin: 2.2 },
  speaking:  { h1: 226, h2: 196, spin: 1.3 },
};

// Anneaux : rayon (x rayon sphère), nombre de traits, longueur, épaisseur, vitesse de base
const RINGS = [
  { rad: 1.45, count: 48,  len: 0.055, w: 1.2, base: 0.35,  ph: 0.0, tick: false },
  { rad: 1.75, count: 90,  len: 0.02,  w: 1.1, base: -0.25, ph: 1.7, tick: false },
  { rad: 2.05, count: 36,  len: 0.09,  w: 1.6, base: 0.2,   ph: 3.1, tick: false },
  { rad: 2.35, count: 120, len: 0,     w: 1.0, base: -0.15, ph: 4.4, tick: true  },
];

interface Particle {
  a: number; r: number; vr: number; va: number;
  life: number; max: number; s: number; hue: number;
}

const MAX_PARTICLES = 200;

export default function AgentOrb({ orbState, size = 320, centerText, pulseRef }: AgentOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<OrbState>(orbState);
  stateRef.current = orbState;

  const box = Math.round(size * 1.7);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = box * dpr;
    canvas.height = box * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    const sc = size / 320;
    const cx = box / 2;
    const cy = box / 2;
    const r0 = size * 0.2; // rayon de la sphère

    const cur = { ...TARGETS.idle };
    const ringAngles = RINGS.map((_, i) => i * 1.3);
    let level = 0;
    let last = performance.now();
    let acc = 0;
    let raf = 0;
    const parts: Particle[] = [];

    const spawn = (st: OrbState, lvl: number) => {
      if (parts.length >= MAX_PARTICLES) return;
      const a = Math.random() * Math.PI * 2;
      const hue = cur.h2 + (Math.random() - 0.5) * 30;
      const s = (0.8 + Math.random() * 1.8) * sc;
      if (st === "speaking") {
        parts.push({ a, r: r0 * 1.5, vr: (30 + Math.random() * 55 + lvl * 90) * sc,
          va: (Math.random() - 0.5) * 0.6, life: 0, max: 1.2 + Math.random() * 1.2, s, hue });
      } else if (st === "listening") {
        parts.push({ a, r: r0 * (3.0 + Math.random() * 0.8), vr: -(45 + Math.random() * 45) * sc,
          va: (Math.random() - 0.5) * 0.3, life: 0, max: 2.4, s, hue });
      } else if (st === "thinking") {
        parts.push({ a, r: r0 * (1.5 + Math.random() * 0.9), vr: (Math.random() - 0.5) * 6 * sc,
          va: 0.9 + Math.random() * 0.6, life: 0, max: 1.6 + Math.random() * 1.2, s, hue });
      } else {
        parts.push({ a, r: r0 * (1.5 + Math.random() * 0.8), vr: 6 * sc,
          va: 0.1, life: 0, max: 2.5, s, hue });
      }
    };

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const t = now / 1000;
      const st = stateRef.current;
      const tg = TARGETS[st];

      const k = 1 - Math.exp(-dt * 3);
      cur.h1 += (tg.h1 - cur.h1) * k;
      cur.h2 += (tg.h2 - cur.h2) * k;
      cur.spin += (tg.spin - cur.spin) * k;

      // Niveau (voix / ambiance)
      let pulse = 0;
      if (pulseRef) {
        pulse = pulseRef.current;
        pulseRef.current = pulse * Math.exp(-dt * 5);
      }
      let target = 0;
      if (st === "speaking") {
        const sim = 0.4 + 0.2 * Math.sin(t * 9) + 0.15 * Math.sin(t * 5.3 + 1);
        target = Math.max(sim, pulse);
      } else if (st === "listening") {
        target = 0.2 + 0.12 * Math.sin(t * 4);
      } else if (st === "thinking") {
        target = 0.15 + 0.1 * Math.sin(t * 2.2);
      }
      level += (target - level) * (1 - Math.exp(-dt * 10));

      ctx.clearRect(0, 0, box, box);

      // ── Halo doux derrière la sphère
      ctx.globalCompositeOperation = "lighter";
      const halo = ctx.createRadialGradient(cx, cy, r0 * 0.8, cx, cy, r0 * 3);
      halo.addColorStop(0, `hsla(${cur.h1},90%,60%,${0.16 + level * 0.14})`);
      halo.addColorStop(1, `hsla(${cur.h1},90%,60%,0)`);
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, r0 * 3, 0, Math.PI * 2);
      ctx.fill();

      // ── Anneaux pointillés contre-rotatifs (le sens s'inverse lentement)
      RINGS.forEach((ring, idx) => {
        const dir = Math.sin(t * 0.11 + ring.ph) * 1.6;
        ringAngles[idx] += ring.base * dir * cur.spin * dt * (reduced ? 0.3 : 1);
        const rr = r0 * ring.rad * (1 + level * 0.04 * (idx + 1));
        ctx.lineWidth = ring.w * Math.max(0.7, sc);
        ctx.lineCap = "round";

        for (let i = 0; i < ring.count; i++) {
          const a = ringAngles[idx] + (i / ring.count) * Math.PI * 2;
          const tw = 0.5 + 0.5 * Math.sin(i * 0.9 + t * 1.5 + ring.ph);
          const alpha = Math.min(1, 0.22 + 0.5 * tw + level * 0.25);
          ctx.strokeStyle = `hsla(${cur.h2},90%,72%,${alpha})`;
          ctx.beginPath();
          if (ring.tick) {
            const len = (4 + 3 * tw) * sc;
            ctx.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
            ctx.lineTo(cx + Math.cos(a) * (rr + len), cy + Math.sin(a) * (rr + len));
          } else {
            ctx.arc(cx, cy, rr, a, a + ring.len * Math.PI * 2);
          }
          ctx.stroke();
        }
      });

      // ── Particules
      if (!reduced) {
        let rate = 3;
        if (st === "speaking") rate = 40 * (0.3 + level * 2);
        else if (st === "listening") rate = 22 + level * 40;
        else if (st === "thinking") rate = 16;
        acc += rate * dt;
        while (acc >= 1) { spawn(st, level); acc -= 1; }
      }
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.life += dt;
        p.r += p.vr * dt;
        p.a += p.va * dt;
        if (p.life > p.max || (p.vr < 0 && p.r < r0 * 1.4)) { parts.splice(i, 1); continue; }
        const f = p.life / p.max;
        ctx.fillStyle = `hsla(${p.hue},100%,75%,${Math.sin(Math.min(f, 1) * Math.PI) * 0.9})`;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(p.a) * p.r, cy + Math.sin(p.a) * p.r, p.s * (1 - f * 0.4), 0, Math.PI * 2);
        ctx.fill();
      }

      // ── Sphère pleine avec reflet
      ctx.globalCompositeOperation = "source-over";
      const breath = 0.02 * Math.sin(t * 1.3);
      const sr = r0 * (1 + breath + level * 0.12);
      const sg = ctx.createRadialGradient(cx - sr * 0.32, cy - sr * 0.36, sr * 0.05, cx, cy, sr);
      sg.addColorStop(0, `hsl(${cur.h1},90%,90%)`);
      sg.addColorStop(0.3, `hsl(${cur.h1},85%,70%)`);
      sg.addColorStop(1, `hsl(${cur.h1},75%,48%)`);
      ctx.shadowColor = `hsla(${cur.h1},95%,62%,0.85)`;
      ctx.shadowBlur = (26 + level * 30) * sc;
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(cx, cy, sr, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [size, box, pulseRef]);

  return (
    <div style={{ position: "relative", width: box, height: box, maxWidth: "100%" }}>
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        aria-hidden
      />
      {/* Texte sous les anneaux */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: `calc(50% + ${Math.round(size * 0.5)}px)`,
          display: "flex",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <AnimatePresence mode="wait">
          {centerText ? (
            <motion.span
              key={centerText}
              initial={{ opacity: 0, filter: "blur(6px)" }}
              animate={{
                opacity: orbState === "thinking" ? [0.55, 1, 0.55] : 1,
                filter: "blur(0px)",
              }}
              exit={{ opacity: 0, filter: "blur(6px)" }}
              transition={
                orbState === "thinking"
                  ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" }
                  : { duration: 0.4 }
              }
              style={{
                color: "rgba(205,220,255,0.9)",
                fontWeight: 300,
                fontSize: Math.max(13, Math.round(size * 0.05)),
                letterSpacing: "0.03em",
                textAlign: "center",
                maxWidth: size,
              }}
            >
              {centerText}
            </motion.span>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
