/** Shared SVG gradients, patterns and filters for the cabinet render. Ids are prefixed with `p`. */

type Stop = [number, string, number?];
function Lin({ id, stops, x2 = 0, y2 = 1, x1 = 0, y1 = 0 }: { id: string; stops: Stop[]; x1?: number; y1?: number; x2?: number; y2?: number }) {
  return (
    <linearGradient id={id} x1={x1} y1={y1} x2={x2} y2={y2}>
      {stops.map(([o, c, op], i) => <stop key={i} offset={o} stopColor={c} stopOpacity={op ?? 1} />)}
    </linearGradient>
  );
}
function Rad({ id, stops, cx = 0.5, cy = 0.5, r = 0.5, fx, fy }: { id: string; stops: Stop[]; cx?: number; cy?: number; r?: number; fx?: number; fy?: number }) {
  return (
    <radialGradient id={id} cx={cx} cy={cy} r={r} fx={fx ?? cx} fy={fy ?? cy}>
      {stops.map(([o, c, op], i) => <stop key={i} offset={o} stopColor={c} stopOpacity={op ?? 1} />)}
    </radialGradient>
  );
}

export function RenderDefs({ p, encColor }: { p: string; encColor: string }) {
  return (
    <defs>
      {/* studio backdrop */}
      <Rad id={`${p}-backdrop`} cx={0.45} cy={0.35} r={0.9} stops={[[0, '#fbfbfc'], [0.6, '#eceef1'], [1, '#d9dce1']]} />
      {/* painted steel */}
      <Lin id={`${p}-steel`} x2={1} y2={1} stops={[[0, '#e4e6e2'], [0.35, encColor], [1, '#b7bab5']]} />
      <Lin id={`${p}-steelV`} stops={[[0, '#e2e4e0'], [0.5, encColor], [1, '#b9bcb7']]} />
      <Lin id={`${p}-doorFace`} x2={1} y2={1} stops={[[0, '#e6e8e4'], [0.45, encColor], [1, '#bcbfba']]} />
      <Rad id={`${p}-doorSheen`} cx={0.3} cy={0.2} r={0.75} stops={[[0, '#ffffff', 0.35], [0.5, '#ffffff', 0.06], [1, '#ffffff', 0]]} />
      <Lin id={`${p}-wallL`} x2={1} y2={0} stops={[[0, '#c9ccc7'], [1, '#a8aba6']]} />
      <Lin id={`${p}-wallR`} x2={1} y2={0} stops={[[0, '#8f928d'], [1, '#b2b5b0']]} />
      <Lin id={`${p}-wallT`} stops={[[0, '#a2a5a0'], [1, '#7f827d']]} />
      <Lin id={`${p}-wallB`} stops={[[0, '#c3c6c1'], [1, '#d7d9d5']]} />
      <Lin id={`${p}-cavity`} stops={[[0, '#a9aca7'], [1, '#c2c5c0']]} />
      {/* back panel */}
      <Lin id={`${p}-bp-white`} x2={1} y2={1} stops={[[0, '#fdfdfb'], [0.55, '#f1f2ee'], [1, '#dfe0db']]} />
      <Lin id={`${p}-bp-galvanized`} x2={1} y2={1} stops={[[0, '#e9ecee'], [0.3, '#cfd5d9'], [0.6, '#e1e5e8'], [1, '#b9c0c5']]} />
      <Lin id={`${p}-bp-orange`} x2={1} y2={1} stops={[[0, '#f6a05a'], [1, '#d9772f']]} />
      {/* DIN rail (zinc plated) */}
      <Lin id={`${p}-rail`} stops={[[0, '#9ea4a9'], [0.1, '#eef1f3'], [0.2, '#b8bec3'], [0.24, '#7f868c'], [0.3, '#e4e8eb'], [0.55, '#c9ced2'], [0.7, '#f2f4f5'], [0.76, '#868d93'], [0.8, '#b8bec3'], [0.9, '#eef1f3'], [1, '#8f969b']]} />
      {/* wire duct */}
      <Lin id={`${p}-ductCoverH`} stops={[[0, '#b9bdbf'], [0.15, '#a8acae'], [0.5, '#9fa3a5'], [0.85, '#94989a'], [1, '#7f8385']]} />
      <Lin id={`${p}-ductCoverV`} x2={1} y2={0} stops={[[0, '#b9bdbf'], [0.15, '#a8acae'], [0.5, '#9fa3a5'], [0.85, '#94989a'], [1, '#7f8385']]} />
      <Lin id={`${p}-finger`} stops={[[0, '#a3a7a9'], [1, '#8a8e90']]} />
      {/* device plastics / metals */}
      <Lin id={`${p}-devLight`} x2={1} y2={1} stops={[[0, '#f4f5f2'], [0.5, '#e3e5e1'], [1, '#c9ccc7']]} />
      <Lin id={`${p}-devLightV`} stops={[[0, '#f6f7f4'], [1, '#d3d6d1']]} />
      <Lin id={`${p}-devMid`} x2={1} y2={1} stops={[[0, '#9a9fa4'], [0.5, '#7d8287'], [1, '#62666b']]} />
      <Lin id={`${p}-devDark`} x2={1} y2={1} stops={[[0, '#4c5157'], [0.5, '#363a3f'], [1, '#24272b']]} />
      <Lin id={`${p}-devBlack`} stops={[[0, '#3a3c40'], [1, '#17181a']]} />
      <Lin id={`${p}-alu`} x2={1} y2={0} stops={[[0, '#b5bbc0'], [0.15, '#e3e7ea'], [0.5, '#cfd4d8'], [0.85, '#e9ecef'], [1, '#a4abb1']]} />
      <Lin id={`${p}-copper`} stops={[[0, '#f0b583'], [0.45, '#cf8150'], [1, '#9c5a31']]} />
      <Lin id={`${p}-tin`} stops={[[0, '#f2f2ec'], [0.45, '#c9cac2'], [1, '#9c9d96']]} />
      <Lin id={`${p}-coil`} x2={1} y2={0} stops={[[0, '#8a4a1e'], [0.3, '#d98a4b'], [0.5, '#f0b07a'], [0.7, '#d98a4b'], [1, '#7a3f17']]} />
      <Lin id={`${p}-lam`} x2={1} y2={0} stops={[[0, '#3b3e42'], [0.5, '#5a5e63'], [1, '#2e3134']]} />
      <Lin id={`${p}-tbGreen`} stops={[[0, '#3f9a5a'], [1, '#22673a']]} />
      <Lin id={`${p}-tbGrey`} x2={1} y2={0} stops={[[0, '#b9bcbd'], [0.3, '#d3d6d7'], [1, '#a2a6a8']]} />
      <Lin id={`${p}-tbPE`} x2={1} y2={0} stops={[[0, '#2f9a45'], [0.3, '#41b358'], [1, '#257a37']]} />
      <Lin id={`${p}-shaft`} x2={1} y2={1} stops={[[0, '#f1f3f4'], [0.5, '#a9b0b5'], [1, '#6d747a']]} />
      <Lin id={`${p}-clear`} x2={1} y2={1} stops={[[0, '#e9f2f6', 0.85], [0.5, '#c9d9e2', 0.7], [1, '#9fb4c0', 0.8]]} />
      <Lin id={`${p}-gloss`} stops={[[0, '#ffffff', 0.55], [0.45, '#ffffff', 0.08], [1, '#ffffff', 0]]} />
      <Lin id={`${p}-glossDiag`} x2={1} y2={1} stops={[[0, '#ffffff', 0.22], [0.45, '#ffffff', 0.05], [0.46, '#ffffff', 0], [1, '#ffffff', 0]]} />
      <Rad id={`${p}-screw`} cx={0.38} cy={0.35} r={0.65} stops={[[0, '#ffffff'], [0.4, '#c9cdd0'], [1, '#6f767c']]} />
      <Rad id={`${p}-chrome`} cx={0.4} cy={0.35} r={0.7} stops={[[0, '#ffffff'], [0.35, '#d6dadd'], [0.7, '#8c9398'], [1, '#e2e5e7']]} />
      <Lin id={`${p}-brushed`} x2={1} y2={0.2} stops={[[0, '#d9dcdf'], [0.2, '#eef0f2'], [0.4, '#cfd3d6'], [0.6, '#e8eaec'], [0.8, '#c8ccd0'], [1, '#e1e4e6']]} />
      <Lin id={`${p}-hmiBezel`} x2={0.6} y2={1} stops={[[0, '#4a4e54'], [0.12, '#2c2f33'], [1, '#17191c']]} />
      <Lin id={`${p}-screen`} stops={[[0, '#d5dbe1'], [1, '#bcc4cc']]} />
      <Lin id={`${p}-hinge`} x2={1} y2={0} stops={[[0, '#7b7f7a'], [0.35, '#e8eae6'], [0.6, '#b4b7b2'], [1, '#6b6e69']]} />
      <Lin id={`${p}-gasket`} stops={[[0, '#2b2c2e'], [1, '#121314']]} />
      <Lin id={`${p}-yellow`} x2={1} y2={1} stops={[[0, '#ffe066'], [1, '#e8b100']]} />

      <filter id={`${p}-shadow`} x="-20%" y="-20%" width="150%" height="150%">
        <feDropShadow dx="1.6" dy="2.4" stdDeviation="1.8" floodColor="#1a1c1f" floodOpacity="0.38" />
      </filter>
      <filter id={`${p}-shadowSoft`} x="-10%" y="-10%" width="130%" height="130%">
        <feDropShadow dx="4" dy="7" stdDeviation="7" floodColor="#1a1c1f" floodOpacity="0.32" />
      </filter>
      <filter id={`${p}-shadowSmall`} x="-30%" y="-30%" width="180%" height="180%">
        <feDropShadow dx="0.5" dy="0.9" stdDeviation="0.6" floodColor="#000" floodOpacity="0.45" />
      </filter>
      <filter id={`${p}-blur`} x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="12" />
      </filter>
      <filter id={`${p}-glow`} x="-100%" y="-100%" width="300%" height="300%">
        <feGaussianBlur stdDeviation="3.2" result="b" />
        <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
      <filter id={`${p}-ledGlow`} x="-200%" y="-200%" width="500%" height="500%">
        <feGaussianBlur stdDeviation="0.9" result="b" />
        <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
      <pattern id={`${p}-lamPattern`} width="4" height="1.6" patternUnits="userSpaceOnUse">
        <rect width="4" height="1.6" fill={`url(#${p}-lam)`} />
        <line x1="0" y1="1.5" x2="4" y2="1.5" stroke="#1d1f22" strokeWidth="0.35" />
      </pattern>
      <pattern id={`${p}-windings`} width="2" height="1.4" patternUnits="userSpaceOnUse">
        <rect width="2" height="1.4" fill="none" />
        <line x1="0" y1="0.7" x2="2" y2="0.7" stroke="#6b3412" strokeWidth="0.25" strokeOpacity="0.6" />
      </pattern>
      <pattern id={`${p}-brushLines`} width="40" height="1.2" patternUnits="userSpaceOnUse">
        <line x1="0" y1="0.3" x2="40" y2="0.3" stroke="#ffffff" strokeOpacity="0.25" strokeWidth="0.25" />
        <line x1="0" y1="0.9" x2="40" y2="0.9" stroke="#7a8086" strokeOpacity="0.12" strokeWidth="0.2" />
      </pattern>
    </defs>
  );
}
