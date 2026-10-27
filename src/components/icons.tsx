import type { ReactNode } from 'react';

export type IconName =
  | 'activity'
  | 'alert'
  | 'arrowRight'
  | 'bell'
  | 'book'
  | 'bulb'
  | 'calendar'
  | 'check'
  | 'chevronDown'
  | 'clipboard'
  | 'clock'
  | 'close'
  | 'cpu'
  | 'heart'
  | 'logout'
  | 'mic'
  | 'moon'
  | 'music'
  | 'octagon'
  | 'palette'
  | 'plus'
  | 'refresh'
  | 'save'
  | 'school'
  | 'send'
  | 'sparkles'
  | 'speech'
  | 'star'
  | 'sun'
  | 'target'
  | 'trash'
  | 'user';

const SHAPES: Record<IconName, ReactNode> = {
  activity: <path d="M3 12.5h4l2.6-6.2 4 11.4 2.4-5.2H21" />,
  alert: (
    <>
      <path d="M12 3.6 20.9 19a1.2 1.2 0 0 1-1.05 1.8H4.15A1.2 1.2 0 0 1 3.1 19z" />
      <path d="M12 9.6v4.2" />
      <circle cx="12" cy="17.4" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  arrowRight: (
    <>
      <path d="M4 12h15.5" />
      <path d="M13 5.5 19.5 12 13 18.5" />
    </>
  ),
  bell: (
    <>
      <path d="M18 15.2V10a6 6 0 1 0-12 0v5.2L4.4 18h15.2z" />
      <path d="M10 20.6a2.3 2.3 0 0 0 4 0" />
    </>
  ),
  book: (
    <>
      <path d="M12 6.6V20" />
      <path d="M12 6.6C10.3 5.1 8.1 4.4 4 4.6V18.2c4.1-.2 6.3.5 8 2 1.7-1.5 3.9-2.2 8-2V4.6c-4.1-.2-6.3.5-8 2z" />
    </>
  ),
  bulb: (
    <>
      <path d="M12 2.8a5.6 5.6 0 0 0-3.4 10.1c.6.5 1 1.2 1.1 2h4.6c.1-.8.5-1.5 1.1-2A5.6 5.6 0 0 0 12 2.8z" />
      <path d="M9.7 17h4.6M10.7 19.6h2.6" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.6" y="5.2" width="16.8" height="15.2" rx="2.2" />
      <path d="M8.2 3.2v4M15.8 3.2v4M3.6 10.4h16.8" />
    </>
  ),
  check: <path d="M4.5 12.4 9.2 17 19.5 6.6" />,
  chevronDown: <path d="M6 9.5 12 15.5 18 9.5" />,
  clipboard: (
    <>
      <path d="M9 4.4H6.6A1.6 1.6 0 0 0 5 6v13.4a1.6 1.6 0 0 0 1.6 1.6h10.8a1.6 1.6 0 0 0 1.6-1.6V6a1.6 1.6 0 0 0-1.6-1.6H15" />
      <rect x="8.8" y="2.6" width="6.4" height="3.6" rx="1.3" />
      <path d="M8.6 11.4h6.8M8.6 15.4h4.6" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M12 7.4V12l3.4 2" />
    </>
  ),
  close: <path d="M6.4 6.4 17.6 17.6M17.6 6.4 6.4 17.6" />,
  cpu: (
    <>
      <rect x="6.6" y="6.6" width="10.8" height="10.8" rx="2.6" />
      <rect x="10.2" y="10.2" width="3.6" height="3.6" rx="1" />
      <path d="M12 3.2v3.4M12 17.4v3.4M3.2 12h3.4M17.4 12h3.4" />
    </>
  ),
  heart: (
    <path d="M12 20.4C7.2 16.8 3.8 14 3.8 10.4a3.9 3.9 0 0 1 6.4-2.9l1.8 1.7 1.8-1.7a3.9 3.9 0 0 1 6.4 2.9c0 3.6-3.4 6.4-8.2 10z" />
  ),
  logout: (
    <>
      <path d="M15.4 4.4h2.8A1.8 1.8 0 0 1 20 6.2v11.6a1.8 1.8 0 0 1-1.8 1.8h-2.8" />
      <path d="M10.4 8.4 6.2 12l4.2 3.6" />
      <path d="M6.2 12h8.6" />
    </>
  ),
  mic: (
    <>
      <rect x="9.4" y="3" width="5.2" height="10.4" rx="2.6" />
      <path d="M5.6 11.2a6.4 6.4 0 0 0 12.8 0" />
      <path d="M12 17.6V21M8.6 21h6.8" />
    </>
  ),
  moon: <path d="M20.4 14.6A8.8 8.8 0 1 1 9.4 3.6a7 7 0 0 0 11 11z" />,
  music: (
    <>
      <path d="M9.2 18.2V5.8l10-2.4v12.4" />
      <circle cx="6.8" cy="18.6" r="2.4" />
      <circle cx="16.8" cy="16.2" r="2.4" />
    </>
  ),
  octagon: (
    <>
      <path d="M8.6 2.9h6.8L21.1 8.6v6.8L15.4 21.1H8.6L2.9 15.4V8.6z" />
      <path d="M12 7.4v5" strokeWidth={2.2} />
      <circle cx="12" cy="16.2" r="1.15" fill="currentColor" stroke="none" />
    </>
  ),
  palette: (
    <>
      <circle cx="12" cy="12" r="8.8" />
      <circle cx="16" cy="16" r="2.4" />
      <circle cx="7.2" cy="11.4" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="9.4" cy="7.5" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="14.3" cy="7.2" r="1.15" fill="currentColor" stroke="none" />
    </>
  ),
  plus: <path d="M12 5.4v13.2M5.4 12h13.2" />,
  refresh: (
    <>
      <path d="M20.4 4.6v5.4H15" />
      <path d="M19.2 15a7.6 7.6 0 1 1-1.9-7.9l3 2.8" />
    </>
  ),
  save: (
    <>
      <path d="M5.4 4.4h10.2L19.6 8.4v11.2H5.4z" />
      <path d="M8.8 4.4v4.6h5.4V4.4" />
      <path d="M8.4 19.6v-5.4h7.2v5.4" />
    </>
  ),
  school: (
    <>
      <path d="M12 3.4 21 8.2H3z" />
      <path d="M5.4 8.2V19a1.4 1.4 0 0 0 1.4 1.4h10.4A1.4 1.4 0 0 0 18.6 19V8.2" />
      <path d="M10 20.4v-4.6h4v4.6" />
    </>
  ),
  send: (
    <>
      <path d="M21 3.4 10.6 13.8" />
      <path d="M21 3.4 15.4 21l-4.8-7.2L3.4 9z" />
    </>
  ),
  sparkles: (
    <>
      <path d="M10.8 3.4 12.6 8l4.6 1.8-4.6 1.8-1.8 4.6L9 11.6 4.4 9.8 9 8z" />
      <path d="M18.4 15.2l.9 2.5 2.5.9-2.5.9-.9 2.5-.9-2.5-2.5-.9 2.5-.9z" />
    </>
  ),
  speech: (
    <>
      <path d="M20.4 15.4a2 2 0 0 1-2 2H8.6L4 20.8V6.4a2 2 0 0 1 2-2h12.4a2 2 0 0 1 2 2z" />
      <path d="M8.4 8.4h9.2M8.4 12.2h6.2" />
    </>
  ),
  star: <path d="M12 3.8 14.6 9l5.6.8-4.1 4 .9 5.6-5-2.6-5 2.6.9-5.6-4-4L9.4 9z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 3.4v2.2M12 18.4v2.2M3.4 12h2.2M18.4 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M18 6l-1.6 1.6M7.6 16.4 6 18" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <circle cx="12" cy="12" r="4.8" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.2" r="3.8" />
      <path d="M4.8 20.6c.7-3.9 3.6-5.8 7.2-5.8s6.5 1.9 7.2 5.8" />
    </>
  ),
  trash: (
    <>
      <path d="M4.6 6.8h14.8" />
      <path d="M8.6 6.8V5.4c0-.7.5-1.2 1.2-1.2h4.4c.7 0 1.2.5 1.2 1.2v1.4" />
      <path d="M6.4 6.8l.8 12.4c.05.9.8 1.6 1.7 1.6h6.2c.9 0 1.65-.7 1.7-1.6l.8-12.4" />
      <path d="M10.4 10.4v6.4M13.6 10.4v6.4" />
    </>
  ),
};

export function Icon({
  name,
  size = 16,
  strokeWidth = 1.7,
  className,
  title,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title && <title>{title}</title>}
      {SHAPES[name]}
    </svg>
  );
}

/** BalanceEd mark — one beam, two pans, drawn so it reads clearly at 20px. */
export function BrandMark({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="3.9" r="1.3" />
      <path d="M12 5.2v14.4" />
      <path d="M4.4 7.4h15.2" />
      <path d="M2 12.2h4.8L4.4 7.4 2 12.2z" />
      <path d="M17.2 12.2H22l-2.4-4.8-2.4 4.8z" />
      <path d="M8.6 19.6h6.8" />
    </svg>
  );
}
