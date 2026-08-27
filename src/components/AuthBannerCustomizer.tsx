import { useEffect } from 'react';

function applyTeaLoginBanner(): void {
  const image = document.querySelector<HTMLImageElement>('img[alt="Giáo viên giảng dạy"], img[alt="Học sinh hái chè"]');
  if (!image) return;

  const card = image.parentElement as HTMLElement | null;
  const contentWrapper = card?.parentElement as HTMLElement | null;
  const panel = contentWrapper?.parentElement as HTMLElement | null;
  if (!card || !contentWrapper || !panel) return;

  // Use a real static asset instead of a large data URI. This is more reliable
  // on GitHub Pages and allows the browser to cache/decode the image normally.
  const bannerUrl = `${import.meta.env.BASE_URL}login-tea-banner.jpg`;
  Object.assign(panel.style, {
    backgroundImage: `linear-gradient(180deg, rgba(15,23,42,0.28) 0%, rgba(15,23,42,0.12) 42%, rgba(15,23,42,0.72) 100%), url("${bannerUrl}")`,
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
