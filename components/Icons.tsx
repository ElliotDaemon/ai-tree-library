// Inline 1.5px line icons. One family, drawn on a 20px grid.
type P = { size?: number };
const S = ({ size = 18, children }: P & { children: React.ReactNode }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {children}
  </svg>
);
export const SearchIcon = (p: P) => <S {...p}><circle cx="9" cy="9" r="5.5" /><path d="m13 13 3.5 3.5" /></S>;
export const ArrowIcon = (p: P) => <S {...p}><path d="M6 14 14 6M7.5 6H14v6.5" /></S>;
export const PlusIcon = (p: P) => <S {...p}><path d="M10 4.5v11M4.5 10h11" /></S>;
export const SunIcon = (p: P) => <S {...p}><circle cx="10" cy="10" r="3.2" /><path d="M10 2.5v1.8M10 15.7v1.8M2.5 10h1.8M15.7 10h1.8M4.7 4.7l1.3 1.3M14 14l1.3 1.3M4.7 15.3 6 14M14 6l1.3-1.3" /></S>;
export const MoonIcon = (p: P) => <S {...p}><path d="M15.5 12.2A6 6 0 0 1 7.8 4.5a6 6 0 1 0 7.7 7.7Z" /></S>;
export const GitIcon = (p: P) => <S {...p}><circle cx="6" cy="5" r="1.8" /><circle cx="6" cy="15" r="1.8" /><circle cx="14" cy="8" r="1.8" /><path d="M6 6.8v6.4M14 9.8c0 2.4-3 2.2-6.6 3.8" /></S>;
export const CheckIcon = (p: P) => <S {...p}><path d="m4.5 10.5 3.5 3.5 7.5-8" /></S>;
export const XIcon = (p: P) => <S {...p}><path d="m5.5 5.5 9 9M14.5 5.5l-9 9" /></S>;

/** The library's own mark: a trunk splitting into a crown of nodes. */
export const Mark = ({ size = 22 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden className="brand-mark">
    <path d="M12 21v-7m0 0-4.5-4.5M12 14l4.5-4.5M12 14V7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity=".55" />
    <circle cx="12" cy="5.5" r="2" fill="currentColor" />
    <circle cx="6.5" cy="8.5" r="1.6" fill="var(--accent)" />
    <circle cx="17.5" cy="8.5" r="1.6" fill="currentColor" opacity=".8" />
    <circle cx="12" cy="21" r="1.1" fill="currentColor" opacity=".5" />
  </svg>
);
