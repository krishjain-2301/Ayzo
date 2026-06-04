"use client";

import { useEffect, useState } from "react";
import { Metaballs } from "@paper-design/shaders-react";

export function WaveBackground({ opacity = 1 }: { opacity?: number }) {
  const [dimensions, setDimensions] = useState({ width: 1280, height: 720 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const updateDimensions = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    
    // Initial size
    updateDimensions();

    // Listen to resize
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  if (!mounted) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 0,
        pointerEvents: "none",
        opacity: opacity,
        overflow: "hidden",
      }}
    >
      <Metaballs
        width={dimensions.width}
        height={dimensions.height}
        colors={["#6e33cc", "#ff5500", "#ffc105", "#ffc800", "#f585ff"]}
        colorBack="#000000"
        count={10}
        size={0.83}
        speed={1}
      />
    </div>
  );
}
