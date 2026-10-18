import type { ReactNode } from 'react';

const paths = {
  refresh: 'M20 7v5h-5M4 17v-5h5M6.1 7a7 7 0 0 1 11.6-2L20 8M4 16l2.3 3A7 7 0 0 0 18 17',
  exit: 'M9 4H4v16h5M14 8l4 4-4 4M8 12h10',
  check: 'm5 12 4 4L19 6',
  copy: 'M9 9h11v11H9zM15 5V3H3v12h2',
  wallet: 'M20 8H5a2 2 0 0 1 0-4h13v4M4 6v14h16V8M16 12h4v4h-4z',
  target: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 11v2',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 11v6M12 7v1',
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  people: 'M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8M18 4a4 4 0 0 1 0 8M22 21v-3a4 4 0 0 0-3-3.9',
  settings: 'M4 7h16M4 17h16M8 4v6M16 14v6',
  chevron: 'm6 9 6 6 6-6',
  trophy: 'M8 3h8v6a4 4 0 0 1-8 0V3ZM8 5H4v3a4 4 0 0 0 4 4M16 5h4v3a4 4 0 0 1-4 4M12 13v6M8 21h8',
  pause: 'M8 5v14M16 5v14',
  play: 'm8 4 12 8-12 8V4Z',
} as const;
export function Icon({ name }: { name: keyof typeof paths }) {
  return <svg className="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]}/></svg>;
}
export function BrandMark() {
  return <a className="brand" href="/" aria-label="GDG Bingo home"><img src="/brand/gdg-mark.png" width="40" height="40" alt=""/><span>GDG Bingo</span></a>;
}
export function BrandHeader({ children }: { children?: ReactNode }) {
  return <header className="site-header"><div className="shell header-inner"><BrandMark/><div className="header-actions">{children}<label className="motion-control" title="Pause decorative animations"><input className="sr-only" type="checkbox" data-pause-motion defaultChecked={false}/><span className="sr-only">Pause animations</span><span className="motion-pause"><Icon name="pause"/></span><span className="motion-play"><Icon name="play"/></span></label></div></div></header>;
}
export function BrandFooter() {
  return <footer className="shell site-footer"><img src="/brand/gdg-pup.svg" width="248" height="40" alt="Google Developer Groups on Campus, Polytechnic University of the Philippines"/><p>Two codes. New conversations.<br/><span>Your next team starts here.</span></p></footer>;
}
export function Decorations() {
  return <div className="decorations" aria-hidden="true"><i className="shape shape-blue"/><i className="shape shape-yellow"/><i className="shape shape-red"/><i className="shape shape-green"/></div>;
}
