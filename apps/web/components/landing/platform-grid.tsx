import type { ComponentType, SVGProps } from 'react';
import {
  FacebookIcon,
  InstagramIcon,
  LinkedInIcon,
  SnapchatIcon,
  TikTokIcon,
  XIcon,
  YouTubeIcon,
} from './platform-icons';

interface PlatformEntry {
  name: string;
  status: 'live' | 'soon';
  color: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
}

/**
 * Single source of truth for what the landing page claims. Flipping a platform to
 * 'live' when its integration ships is a one-word edit.
 */
const PLATFORMS: PlatformEntry[] = [
  { name: 'YouTube', status: 'live', color: 'text-red-600', Icon: YouTubeIcon },
  { name: 'Instagram', status: 'soon', color: 'text-pink-600', Icon: InstagramIcon },
  { name: 'LinkedIn', status: 'soon', color: 'text-sky-700', Icon: LinkedInIcon },
  { name: 'TikTok', status: 'soon', color: 'text-slate-900', Icon: TikTokIcon },
  { name: 'Snapchat', status: 'soon', color: 'text-yellow-500', Icon: SnapchatIcon },
  { name: 'X', status: 'soon', color: 'text-slate-900', Icon: XIcon },
  { name: 'Facebook', status: 'soon', color: 'text-blue-600', Icon: FacebookIcon },
];

export function PlatformGrid() {
  return (
    <section
      id="platforms"
      className="scroll-mt-20 border-y border-slate-200 bg-slate-50/60 py-20"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            One place for every platform
          </h2>
          <p className="mt-4 text-slate-600">
            Connect each account once through its official OAuth flow. YouTube is live
            today — the rest are on the way.
          </p>
        </div>

        <ul className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {PLATFORMS.map(({ name, status, color, Icon }) => {
            const isLive = status === 'live';
            return (
              <li
                key={name}
                className={`flex flex-col items-center gap-3 rounded-xl border bg-white p-6 text-center transition ${
                  isLive
                    ? 'border-slate-200 shadow-sm hover:shadow-md'
                    : 'border-slate-200/70 opacity-60'
                }`}
              >
                <Icon className={`h-9 w-9 ${color}`} />
                <span className="text-sm font-semibold text-slate-900">{name}</span>
                {isLive ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Live
                  </span>
                ) : (
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
                    Coming soon
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
