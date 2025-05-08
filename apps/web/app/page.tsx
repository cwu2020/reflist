import { constructMetadata } from "@dub/utils";
import { BubbleIcon } from "@/ui/placeholders/bubble-icon";
import { ButtonLink } from "@/ui/placeholders/button-link";
import { Footer, MaxWidthWrapper, Nav, NavMobile, Wordmark } from "@dub/ui";
import { cn } from "@dub/utils";
import Toolbar from "@/ui/layout/toolbar/toolbar";
import { NewBackground } from "@/ui/shared/new-background";

export const runtime = "edge";

export const metadata = constructMetadata({
  title: "RefList - A curated circle where shopping gets you paid",
  description: "Share what you love, earn when others buy. Join RefList to start earning from your recommendations.",
});

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col justify-between bg-neutral-50/80">
      <NavMobile />
      <NewBackground />

      <Nav maxWidthWrapperClassName="max-w-screen-lg lg:px-4 xl:px-0" />
      
      <main className="grow">
        <div className="relative mx-auto mt-24 flex max-w-4xl flex-col items-center px-3 text-center md:mt-32 md:px-8 lg:mt-48">
          <div className="animate-slide-up-fade relative flex w-auto items-center justify-center px-6 py-2 [--offset:20px] [animation-duration:1.3s] [animation-fill-mode:both]">
            <div className="absolute inset-0 opacity-10">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse-scale absolute inset-0 rounded-full mix-blend-color-burn"
                  style={{
                    animationDelay: `${i * -2}s`,
                    backgroundImage: `linear-gradient(90deg, #000, transparent, #000)`,
                  }}
                />
              ))}
            </div>
            <Wordmark className="relative h-16" />
          </div>
          <h1 className="animate-slide-up-fade mt-10 text-4xl font-bold sm:text-5xl [--offset:10px] [animation-delay:250ms] [animation-duration:1s] [animation-fill-mode:both]">
            A curated circle where shopping gets you paid
          </h1>
          <p className="animate-slide-up-fade mt-6 text-xl text-neutral-600 [--offset:10px] [animation-delay:500ms] [animation-duration:1s] [animation-fill-mode:both] max-w-2xl">
            Share what you love, earn when others buy. Join RefList to start earning from your recommendations.
          </p>
          
          <div className="animate-slide-up-fade mt-12 flex flex-col sm:flex-row gap-4 [--offset:5px] [animation-delay:700ms] [animation-duration:1s] [animation-fill-mode:both]">
            <ButtonLink variant="primary" href="https://app.thereflist.com/register" className="px-8 py-3 text-lg">
              Sign Up Now
            </ButtonLink>
            <ButtonLink variant="secondary" href="https://app.thereflist.com/login" className="px-8 py-3 text-lg">
              Log In
            </ButtonLink>
          </div>
        </div>
        
        {/* Feature section - you can expand this later */}
        <MaxWidthWrapper className="mt-32">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-lg shadow-sm border border-neutral-200">
              <h2 className="text-xl font-bold mb-3">Share Products</h2>
              <p className="text-neutral-600">Share your favorite products with your audience through personalized links.</p>
            </div>
            <div className="bg-white p-8 rounded-lg shadow-sm border border-neutral-200">
              <h2 className="text-xl font-bold mb-3">Earn Commissions</h2>
              <p className="text-neutral-600">Earn money when people purchase products through your recommendation links.</p>
            </div>
            <div className="bg-white p-8 rounded-lg shadow-sm border border-neutral-200">
              <h2 className="text-xl font-bold mb-3">Track Performance</h2>
              <p className="text-neutral-600">Get detailed analytics about your links' performance and earnings.</p>
            </div>
          </div>
        </MaxWidthWrapper>
      </main>
      
      <Toolbar show={["help"]} />
      <Footer className="max-w-screen-lg border-0 bg-transparent lg:px-4 xl:px-0" />
    </div>
  );
} 