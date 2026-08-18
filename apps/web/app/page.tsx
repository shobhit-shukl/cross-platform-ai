import { Faq } from '@/components/landing/faq';
import { Features } from '@/components/landing/features';
import { FinalCta } from '@/components/landing/final-cta';
import { Hero } from '@/components/landing/hero';
import { HowItWorks } from '@/components/landing/how-it-works';
import { PlatformGrid } from '@/components/landing/platform-grid';
import { SiteFooter } from '@/components/landing/site-footer';
import { SiteNav } from '@/components/landing/site-nav';

// Server component: every section below is static. Only the nav/hero CTA hydrates,
// to swap "Sign up" for "Go to Dashboard" once it knows whether you're signed in.
export default function LandingPage() {
  return (
    // bg-white overrides the app-wide `body { background-color: #f8fafc }` set in
    // globals.css for the dashboard, so the landing's white sections stay crisp.
    <div className="bg-white">
      <SiteNav />
      <main>
        <Hero />
        <PlatformGrid />
        <Features />
        <HowItWorks />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}
