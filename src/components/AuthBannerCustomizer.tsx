import { useEffect } from 'react';

const TEA_BANNER_URL = 'https://raw.githubusercontent.com/trungtuyen/4.0/78b8537ab57f7258a7169d3b299547d5bf19cf87/public/login-tea-banner.jpg';

function applyTeaLoginBanner(): void {
  const image = document.querySelector<HTMLImageElement>('img[alt="Giáo viên giảng dạy"], img[alt="Học sinh hái chè"]');
  if (!image) return;

  const card = image.parentElement as HTMLElement | null;
  const contentWrapper = card?.parentElement as HTMLElement | null;
  const panel = contentWrapper?.parentElement as HTMLElement | null;
  if (!card || !contentWrapper || !panel) return;

  Object.assign(panel.style, {
    backgroundImage: 'none',
    backgroundColor: '#0f172a',
  });

  Object.assign(contentWrapper.style, {
    position: 'absolute',
    inset: '0',
    marginTop: '0',
    width: '100%',
    height: '100%',
    zIndex: '0',
  });

  Object.assign(card.style, {
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
    maxWidth: 'none',
    aspectRatio: 'auto',
    borderRadius: '0',
    boxShadow: 'none',
    overflow: 'hidden',
  });

  image.src = TEA_BANNER_URL;
  image.alt = 'Học sinh hái chè';
  image.referrerPolicy = 'no-referrer';
  Object.assign(image.style, {
    display: 'block',
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: 'center center',
    zIndex: '0',
  });

  const overlay = card.children[1] as HTMLElement | undefined;
  if (overlay) {
    Object.assign(overlay.style, {
      position: 'absolute',
      inset: '0',
      zIndex: '1',
      background: 'linear-gradient(180deg, rgba(15,23,42,0.22) 0%, rgba(15,23,42,0.08) 44%, rgba(15,23,42,0.72) 100%)',
    });
  }

  const caption = card.children[2] as HTMLElement | undefined;
  if (caption) {
    Object.assign(caption.style, {
      position: 'absolute',
      left: '0',
      right: '0',
      bottom: '0',
      zIndex: '2',
      padding: '3rem',
      paddingBottom: '4.5rem',
    });
  }

  panel.dataset.teaLoginBanner = 'ready-image';
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
