"use client";

import React from "react";

export function GridBackground() {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none bg-black">
      {/* Grid Pattern with pulse animation */}
      <div 
        className="absolute inset-0 bg-grid-pattern opacity-30 animate-grid-pulse"
        style={{
          maskImage: "radial-gradient(ellipse at center, black 10%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 10%, transparent 80%)",
        }}
      />
      
      {/* Drifting Orbs - Uniform Violet */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-violet-600/30 blur-[120px] rounded-full animate-drift-1" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-violet-600/30 blur-[120px] rounded-full animate-drift-2" />
      <div className="absolute top-1/2 right-1/3 w-[450px] h-[450px] bg-violet-600/20 blur-[120px] rounded-full animate-drift-3" />
    </div>
  );
}
