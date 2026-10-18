// Decorative pointer response only. Gameplay and visibility never depend on this module.
export function startMotionEffects() {
  const frame = document.querySelector<HTMLElement>('.app-frame');
  if (!frame) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = matchMedia('(hover: hover) and (pointer: fine)');
  let raf = 0;
  let x = 0;
  let y = 0;
  const allowed = () => !reduced.matches && pointer.matches && !document.hidden && !frame.querySelector<HTMLInputElement>('[data-pause-motion]')?.checked;
  function reset() {
    cancelAnimationFrame(raf); raf = 0;
    frame!.style.removeProperty('--grid-parallax-x');
    frame!.style.removeProperty('--grid-parallax-y');
  }
  function move(event: PointerEvent) {
    if (event.pointerType !== 'mouse' || !allowed()) return;
    x = -(event.clientX / innerWidth - 0.5) * 12;
    y = -(event.clientY / innerHeight - 0.5) * 10;
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      if (!allowed()) return reset();
      frame!.style.setProperty('--grid-parallax-x', `${x.toFixed(2)}px`);
      frame!.style.setProperty('--grid-parallax-y', `${y.toFixed(2)}px`);
    });
  }
  frame.addEventListener('pointermove', move, {passive:true});
  frame.addEventListener('pointerleave', reset);
  frame.addEventListener('change', event => { if(event.target instanceof HTMLInputElement && event.target.matches('[data-pause-motion]'))reset(); });
  window.addEventListener('blur', reset);
  document.addEventListener('visibilitychange', reset);
  reduced.addEventListener('change', reset);
  pointer.addEventListener('change', reset);
  // Returning from the browser back/forward cache restores these listeners normally.
  window.addEventListener('pagehide', reset);
}
