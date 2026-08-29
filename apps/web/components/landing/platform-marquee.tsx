import {
  CalendarIcon,
  DriveIcon,
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
  { Icon: DriveIcon, name: 'Google Drive' },
  { Icon: CalendarIcon, name: 'Google Calendar' },
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
    <div className="relative overflow-hidden border-y border-white/10 py-6">
      {/* A real mask rather than two gradient overlays painted in the canvas colour.
          Overlays only look right when whatever sits behind the marquee is exactly that
          colour; a mask genuinely fades the content to transparent, so it stays correct
          over the aurora blobs and grid texture. */}
      <div
        className="motion-safe:animate-marquee flex w-max [mask-image:linear-gradient(to_right,transparent,#000_12%,#000_88%,transparent)]"
        style={{ WebkitMaskImage: 'linear-gradient(to right, transparent, #000 12%, #000 88%, transparent)' }}
      >
        <Track />
        <Track />
      </div>
    </div>
  );
}
