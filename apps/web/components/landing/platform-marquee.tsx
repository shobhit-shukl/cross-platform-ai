import {
  FacebookIcon,
  InstagramIcon,
  LinkedInIcon,
  SnapchatIcon,
  TikTokIcon,
  XIcon,
  YouTubeIcon,
} from './platform-icons';

const LOGOS = [
  { Icon: YouTubeIcon, name: 'YouTube' },
  { Icon: InstagramIcon, name: 'Instagram' },
  { Icon: LinkedInIcon, name: 'LinkedIn' },
  { Icon: TikTokIcon, name: 'TikTok' },
  { Icon: SnapchatIcon, name: 'Snapchat' },
  { Icon: XIcon, name: 'X' },
  { Icon: FacebookIcon, name: 'Facebook' },
];

/** Duplicated once so the CSS `translateX(-50%)` loop is seamless. */
function Track() {
  return (
    <>
      {LOGOS.map(({ Icon, name }, i) => (
        <span
          key={`${name}-${i}`}
          className="flex shrink-0 items-center gap-2.5 px-8 text-ink-faint"
        >
          <Icon className="h-5 w-5" />
          <span className="text-sm font-medium">{name}</span>
        </span>
      ))}
    </>
  );
}

export function PlatformMarquee() {
  return (
    <div className="relative overflow-hidden border-y border-border bg-surface/40 py-5">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-canvas to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-canvas to-transparent"
      />
      <div className="motion-safe:animate-marquee flex w-max">
        <Track />
        <Track />
      </div>
    </div>
  );
}
