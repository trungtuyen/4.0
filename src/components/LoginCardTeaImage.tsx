import { useEffect } from 'react';

/**
 * Replaces only the illustration inside the original login card.
 * The original layout, navy panel, rounded card, overlay and caption stay intact.
 */
export default function LoginCardTeaImage() {
  useEffect(() => {
    const teaImageUrl = `${import.meta.env.BASE_URL}login-tea-banner.jpg?v=tea-card-20260827`;

    const apply = () => {
      const image = document.querySelector<HTMLImageElement>(
        'img[alt="Giáo viên giảng dạy"], img[alt="Học sinh hái chè"]',
      );
      if (!image) return;

      const expectedUrl = new URL(teaImageUrl, window.location.href).href;
      if (image.src !== expectedUrl) image.src = teaImageUrl;
      image.alt = 'Học sinh hái chè';
      image.referrerPolicy = 'no-referrer';
    };

    apply();
    const root = document.getElementById('root');
    if (!root) return;

    const observer = new MutationObserver(apply);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
