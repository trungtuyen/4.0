import { useEffect } from 'react';
import { LOGIN_TEA_BANNER } from '../lib/loginTeaBanner';

function applyTeaLoginBanner(): void {
  const image = document.querySelector<HTMLImageElement>('img[alt="Giáo viên giảng dạy"]');
  if (!image) return;

  const card = image.parentElement as HTMLElement | null;
  const contentWrapper = card?.parentElement as HTMLElement | null;
  const panel = contentWrapper?.parentElement as HTMLElement | null;
  if (!card || !contentWrapper || !panel || panel.dataset.teaLoginBanner === 'ready') return;

  image.src = LOGIN_TEA_BANNER;
  image.alt = 'Học sinh hái chè';
  image.style.width = '100%';
  image.style.height = '100%';
  image.style.objectFit = 'cover';
  image.style.objectPosition = 'center center';

  Object.assign(contentWrapper.style, {
    position: 'absolute',
    inset: '0',
    marginTop: '0',
    width: '100%',
    height: '100%',
    zIndex: '0',
  });

  Object.assign(card.style, {
    width: '100%',
    height: '100%',
    maxWidth: 'none',
    aspectRatio: 'auto',
    borderRadius: '0',
    boxShadow: 'none',
  });

  const overlay = card.children[1] as HTMLElement | undefined;
  if (overlay) {
    overlay.style.background = 'linear-gradient(180deg, rgba(15,23,42,0.48) 0%, rgba(15,23,42,0.16) 42%, rgba(15,23,42,0.82) 100%)';
  }

  const caption = card.children[2] as HTMLElement | undefined;
  if (caption) {
    caption.style.padding = '3rem';
    caption.style.paddingBottom = '4.5rem';
  }

  panel.style.backgroundColor = '#0f172a';
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
