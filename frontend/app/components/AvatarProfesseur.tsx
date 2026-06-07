"use client";
import { useEffect, useRef } from "react";

export type AvatarState = "idle" | "talking" | "listening" | "thinking";

interface AvatarProps {
  state: AvatarState;
  minimized?: boolean;
  onToggle?: () => void;
}

export default function AvatarProfesseur({ state, minimized = false, onToggle }: AvatarProps) {
  const mouthRef = useRef<SVGPathElement>(null);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    if (animRef.current) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }

    if (state === "talking") {
      let t = 0;
      const loop = () => {
        t += 0.22;
        if (mouthRef.current) {
          const open = Math.abs(Math.sin(t)) * 9 + Math.abs(Math.sin(t * 1.9)) * 4;
          const cy = 118 + open;
          mouthRef.current.setAttribute("d", `M 62 112 Q 80 ${cy} 98 112`);
        }
        animRef.current = requestAnimationFrame(loop);
      };
      animRef.current = requestAnimationFrame(loop);
    } else {
      if (mouthRef.current) {
        if (state === "listening") {
          mouthRef.current.setAttribute("d", "M 66 114 Q 80 117 94 114");
        } else if (state === "thinking") {
          mouthRef.current.setAttribute("d", "M 68 114 L 92 114");
        } else {
          mouthRef.current.setAttribute("d", "M 62 112 Q 80 120 98 112");
        }
      }
    }

    return () => {
      if (animRef.current) {
        cancelAnimationFrame(animRef.current);
        animRef.current = null;
      }
    };
  }, [state]);

  const ringColor =
    state === "talking" ? "#CC0000" :
    state === "listening" ? "#3b82f6" :
    state === "thinking" ? "#a855f7" : "#444";

  const label = {
    idle: "En attente",
    talking: "Parle",
    listening: "Écoute",
    thinking: "Réfléchit"
  }[state];

  if (minimized) {
    return (
      <button onClick={onToggle}
        className="fixed bottom-24 right-4 z-50"
        style={{ filter: "drop-shadow(0 4px 16px rgba(204,0,0,0.5))" }}
        title="Afficher le formateur">
        <svg viewBox="0 0 80 80" width="56" height="56">
          <circle cx="40" cy="40" r="38" fill="#111" stroke="#CC0000" strokeWidth="2"/>
          <ellipse cx="40" cy="38" rx="20" ry="22" fill="#c8825a"/>
          <ellipse cx="40" cy="18" rx="19" ry="9" fill="#2c1810"/>
          <ellipse cx="28" cy="37" rx="5" ry="5" fill="white"/>
          <ellipse cx="52" cy="37" rx="5" ry="5" fill="white"/>
          <ellipse cx="29" cy="38" rx="3" ry="3" fill="#1a1a1a"/>
          <ellipse cx="53" cy="38" rx="3" ry="3" fill="#1a1a1a"/>
          <path d="M 28 48 Q 40 54 52 48" stroke="#7a3520" strokeWidth="2" fill="#d97060" strokeLinecap="round"/>
          {state === "talking" && (
            <circle cx="40" cy="40" r="36" fill="none" stroke="#CC0000" strokeWidth="2">
              <animate attributeName="r" values="36;48" dur="1s" repeatCount="indefinite"/>
              <animate attributeName="opacity" values="0.7;0" dur="1s" repeatCount="indefinite"/>
            </circle>
          )}
        </svg>
      </button>
    );
  }

  return (
    <div className="fixed bottom-20 right-3 z-50 flex flex-col items-center"
      style={{ filter: "drop-shadow(0 8px 24px rgba(204,0,0,0.3))" }}>
      <style>{`
        @keyframes av-idle { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-5px)} }
        @keyframes av-talk { 0%,100%{transform:translateY(0px) rotate(0deg)} 30%{transform:translateY(-3px) rotate(-1.5deg)} 70%{transform:translateY(1px) rotate(1deg)} }
        @keyframes av-listen { 0%,100%{transform:translateY(0px) rotate(0deg)} 40%{transform:translateY(-2px) rotate(-2deg)} 80%{transform:translateY(1px) rotate(1.5deg)} }
        @keyframes blink { 0%,85%,100%{transform:scaleY(1)} 90%{transform:scaleY(0.05)} }
        @keyframes wave { 0%,100%{transform:rotate(0deg)} 25%{transform:rotate(-24deg)} 55%{transform:rotate(16deg)} 80%{transform:rotate(-10deg)} }
        @keyframes pointr { 0%,100%{transform:rotate(0deg)} 50%{transform:rotate(-14deg)} }
        @keyframes eq { 0%,100%{scaleY:1} 50%{scaleY:2} }
        .eye-l { transform-origin:74px 97px; animation:blink 4s ease-in-out infinite; }
        .eye-r { transform-origin:106px 97px; animation:blink 4s ease-in-out infinite 0.25s; }
        .arm-l { transform-origin:44px 168px; }
        .arm-r { transform-origin:116px 168px; }
      `}</style>

      {/* Bulle dialogue */}
      {state !== "idle" && (
        <div className="mb-2 px-3 py-2 rounded-2xl rounded-br-none text-xs max-w-44 text-center transition-all"
          style={{ background: "#0f0f0f", border: `1px solid ${ringColor}66`, color: ringColor }}>
          {state === "talking" && (
            <div className="flex items-end justify-center gap-1 h-5">
              {[0,1,2,3].map(i => (
                <div key={i} className="w-1.5 rounded-full" style={{
                  backgroundColor: ringColor,
                  height: "8px",
                  animation: `eq 0.45s ease-in-out infinite`,
                  animationDelay: `${i * 0.11}s`
                }}/>
              ))}
            </div>
          )}
          {state === "listening" && <span className="font-medium">J'écoute...</span>}
          {state === "thinking" && (
            <div className="flex justify-center gap-1.5">
              {[0,1,2].map(i => (
                <div key={i} className="w-2 h-2 rounded-full animate-bounce"
                  style={{ backgroundColor: ringColor, animationDelay: `${i * 0.18}s` }}/>
              ))}
            </div>
          )}
        </div>
      )}

      <button onClick={onToggle} title="Cliquer pour réduire">
        <svg viewBox="0 0 160 240" width="120" height="180"
          style={{
            animation: `${
              state === "talking" ? "av-talk 1.3s" :
              state === "listening" ? "av-listen 1.1s" :
              "av-idle 3s"
            } ease-in-out infinite`
          }}>

          {/* Halo état */}
          <circle cx="80" cy="105" r="70" fill="none" stroke={ringColor} strokeWidth="1.5" opacity="0.5"/>
          {state !== "idle" && (
            <circle cx="80" cy="105" r="70" fill="none" stroke={ringColor} strokeWidth="1.5">
              <animate attributeName="r" values="70;86" dur="1.4s" repeatCount="indefinite"/>
              <animate attributeName="opacity" values="0.5;0" dur="1.4s" repeatCount="indefinite"/>
            </circle>
          )}

          {/* Corps / Veste */}
          <rect x="44" y="162" width="72" height="72" rx="10" fill="#1e3a6e"/>
          <rect x="71" y="162" width="18" height="72" fill="#f0f0f0" opacity="0.92"/>
          <polygon points="71,162 80,175 89,162 89,173 80,185 71,173" fill="#CC0000"/>
          {/* Badge */}
          <rect x="95" y="172" width="17" height="9" rx="2" fill="#CC0000"/>
          <text x="103.5" y="179" textAnchor="middle" fill="white" fontSize="4.5" fontWeight="500">SGCI</text>

          {/* Bras gauche */}
          <g className="arm-l" style={{ animation: state === "talking" ? "wave 1.1s ease-in-out infinite" : "none" }}>
            <rect x="20" y="164" width="26" height="52" rx="11" fill="#1e3a6e"/>
            <ellipse cx="33" cy="220" rx="13" ry="11" fill="#c8825a"/>
            <rect x="24" y="212" width="8" height="14" rx="4" fill="#c8825a"/>
            <rect x="33" y="210" width="8" height="15" rx="4" fill="#c8825a"/>
          </g>

          {/* Bras droit */}
          <g className="arm-r" style={{ animation: state === "talking" ? "pointr 1.7s ease-in-out infinite" : "none" }}>
            <rect x="114" y="164" width="26" height="52" rx="11" fill="#1e3a6e"/>
            <ellipse cx="127" cy="220" rx="13" ry="11" fill="#c8825a"/>
            {state === "talking" && <rect x="128" y="213" width="20" height="7" rx="3" fill="#c8825a"/>}
          </g>

          {/* Cou */}
          <rect x="71" y="142" width="18" height="24" rx="6" fill="#c8825a"/>

          {/* Tête */}
          <ellipse cx="80" cy="104" rx="46" ry="50" fill="#c8825a"/>

          {/* Cheveux */}
          <ellipse cx="80" cy="57" rx="44" ry="18" fill="#2c1810"/>
          <ellipse cx="36" cy="76" rx="13" ry="26" fill="#2c1810"/>
          <ellipse cx="124" cy="76" rx="13" ry="26" fill="#2c1810"/>
          <rect x="36" y="52" width="88" height="20" fill="#2c1810"/>

          {/* Oreilles */}
          <ellipse cx="34" cy="104" rx="9" ry="13" fill="#c8825a"/>
          <ellipse cx="126" cy="104" rx="9" ry="13" fill="#c8825a"/>
          <circle cx="34" cy="113" r="3.5" fill="none" stroke="#CC0000" strokeWidth="1.5"/>

          {/* Lunettes */}
          <rect x="52" y="88" width="26" height="18" rx="5" fill="none" stroke="#222" strokeWidth="2.5"/>
          <rect x="82" y="88" width="26" height="18" rx="5" fill="none" stroke="#222" strokeWidth="2.5"/>
          <line x1="78" y1="97" x2="82" y2="97" stroke="#222" strokeWidth="2"/>
          <line x1="52" y1="97" x2="36" y2="101" stroke="#222" strokeWidth="2"/>
          <line x1="108" y1="97" x2="124" y2="101" stroke="#222" strokeWidth="2"/>

          {/* Yeux */}
          <g className="eye-l">
            <ellipse cx="65" cy="97" rx="7" ry="7" fill="white"/>
            <ellipse cx="66" cy="98" rx="4" ry="4" fill="#1a1a1a"/>
            <ellipse cx="67" cy="96" rx="1.5" ry="1.5" fill="white"/>
          </g>
          <g className="eye-r">
            <ellipse cx="95" cy="97" rx="7" ry="7" fill="white"/>
            <ellipse cx="96" cy="98" rx="4" ry="4" fill="#1a1a1a"/>
            <ellipse cx="97" cy="96" rx="1.5" ry="1.5" fill="white"/>
          </g>

          {/* Sourcils */}
          <path
            d={state === "thinking" ? "M 56 82 Q 65 77 74 82" : "M 56 84 Q 65 80 74 84"}
            stroke="#2c1810" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
          <path
            d={state === "thinking" ? "M 86 82 Q 95 77 105 82" : "M 86 84 Q 95 80 105 84"}
            stroke="#2c1810" strokeWidth="2.5" fill="none" strokeLinecap="round"/>

          {/* Nez */}
          <path d="M 80 108 L 77 117 Q 80 120 83 117 Z" fill="#b0704a" opacity="0.55"/>

          {/* BOUCHE — coordonnees corrigees dans le viewBox 160x240, centree sur cx=80 cy=~118 */}
          <path
            ref={mouthRef}
            d="M 62 112 Q 80 120 98 112"
            stroke="#7a3520"
            strokeWidth="2.5"
            fill="#d97060"
            strokeLinecap="round"
          />

          {/* Equalizer lateral quand talking */}
          {state === "talking" && [0,1,2,3].map(i => (
            <rect key={i} x={8 + i*5} y={95} width="3" height="10" rx="1.5" fill="#CC0000" opacity="0.75">
              <animate
                attributeName="height"
                values={`${8+i*2};${18+i*3};${5+i};${12+i*2};${8+i*2}`}
                dur={`${0.36 + i*0.09}s`}
                repeatCount="indefinite"/>
              <animate
                attributeName="y"
                values={`${95};${85};${98};${91};${95}`}
                dur={`${0.36 + i*0.09}s`}
                repeatCount="indefinite"/>
            </rect>
          ))}
        </svg>

        {/* Badge état */}
        <div className="flex justify-center mt-1">
          <span className="text-xs px-2 py-0.5 rounded-full font-medium transition-all"
            style={{
              background: ringColor + "18",
              color: ringColor,
              border: `1px solid ${ringColor}40`
            }}>
            {label}
          </span>
        </div>
      </button>
    </div>
  );
}
