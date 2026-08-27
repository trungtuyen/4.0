import { useEffect } from 'react';
import { LOGIN_TEA_BANNER } from '../lib/loginTeaBanner';

function applyTeaLoginBanner(): void {
  const image = document.querySelector<HTMLImageElement>('img[alt="Giáo viên giảng dạy"], img[alt="Học sinh hái chè"]');
  if (!image) return;

  const card = image.parentElement as HTMLElement | null;
  const contentWrapper = card?.parentElement as HTMLElement | null;
  const panel = contentWrapper?.parentElement as HTMLElement | null;
  if (!card || !contentWrapper || !panel) return;

  // Render the teacher-provided tea photo as the panel background itself.
  // This avoids relying on an absolutely positioned <img> after React mounts.
  Object.assign(panel.style, {
    backgroundImage: `linear-gradient(180deg, rgba(15,23,42,0.34) 0%, rgba(15,23,42,0.18) 42%, rgba(15,23,42,0.78) 100%), url("${LOGIN_TEA_BANNER}")`,
    backgroundSize: 'cover',
    backgroundPosition: 'center center',
    backgroundRepeat: 'no-repeat',
    backgroundColor: '#0f172a',
  });

  image.alt = 'Học sinh hái chè';
  image.style.display = 'none';

  Object.assign(contentWrapper.style, {
    position: 'absolute',
    inset: '0',
    marginTop: '0',
    width: '100%',
    height: '100%',
    zIndex: '1',
  });

  Object.assign(card.style, {
    width: '100%',
    height: '100%',
    maxWidth: 'none',
    aspectRatio: 'auto',
    borderRadius: '0',
    boxShadow: 'none',
    background: 'transparent',
  });

  const overlay = card.children[1] as HTMLElement | undefined;
  if (overlay) {
    // The panel already owns the dark gradient; keep this layer transparent.
    overlay.style.background = 'transparent';
  }

  const caption = card.children[2] as HTMLElement | undefined;
  if (caption) {
    caption.style.padding = '3rem';
    caption.style.paddingBottom = '4.5rem';
  }

  panel.dataset.teaLoginBanner = 'ready';
}

export default function AuthBannerCustomizer() {
  useEffect(() => {
    applyTeaLoginBanner();
    const root = document.getElementById('root');
    if (!root) return;

    const observer = new MutationObserver(() => applyTeaLoginBanner());
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
