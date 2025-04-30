import { BubbleIcon } from "@/ui/placeholders/bubble-icon";
import { ButtonLink } from "@/ui/placeholders/button-link";
import { CTA } from "@/ui/placeholders/cta";
import { FeaturesSection } from "@/ui/placeholders/features-section";
import { Hero } from "@/ui/placeholders/hero";
import { GlobeSearch, Wordmark } from "@dub/ui";
import { cn, constructMetadata, createHref } from "@dub/utils";

export const runtime = "edge";

export const metadata = constructMetadata({
  title: "RefList",
  description:
    "This link does not exist on RefList. Please check the URL and try again.",
  image: "https://assets.dub.co/misc/notfoundlink.jpg",
  noIndex: true,
});

const UTM_PARAMS = {
  utm_source: "Expired Link",
  utm_medium: "Expired Link Page",
};

export default function NotFoundLinkPage({
  params,
}: {
  params: { domain: string };
}) {
  return (
    <>
      <div className="relative mx-auto mt-24 flex max-w-sm flex-col items-center px-3 text-center md:mt-32 md:px-8 lg:mt-48">
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
        <h1 className="animate-slide-up-fade mt-10 text-2xl font-medium [--offset:10px] [animation-delay:250ms] [animation-duration:1s] [animation-fill-mode:both]">
          Welcome to RefList
        </h1>
        <p className="animate-slide-up-fade mt-2 text-neutral-500 [--offset:10px] [animation-delay:500ms] [animation-duration:1s] [animation-fill-mode:both]">
          Never shop the same again.
        </p>
      </div>
    </>
    // <main className="flex min-h-screen flex-col justify-between">
    //   <Hero>
    //     <div className="relative mx-auto flex w-full max-w-md flex-col items-center">
    //       <BubbleIcon>
    //         <GlobeSearch className="size-12" />
    //       </BubbleIcon>
    //       <h1
    //         className={cn(
    //           "font-display mt-10 text-center text-4xl font-medium text-neutral-900 sm:text-5xl sm:leading-[1.15]",
    //           "animate-slide-up-fade motion-reduce:animate-fade-in [--offset:20px] [animation-duration:1s] [animation-fill-mode:both]",
    //         )}
    //       >
    //         Link not found
    //       </h1>
    //       <p
    //         className={cn(
    //           "mt-5 text-pretty text-base text-neutral-700 sm:text-xl",
    //           "animate-slide-up-fade motion-reduce:animate-fade-in [--offset:10px] [animation-delay:200ms] [animation-duration:1s] [animation-fill-mode:both]",
    //         )}
    //       >
    //         This link has expired. Please contact the owner of this link to get
    //         a new one.
    //       </p>
    //     </div>

    //     <div
    //       className={cn(
    //         "xs:flex-row relative mx-auto mt-8 flex max-w-fit flex-col items-center gap-4",
    //         "animate-slide-up-fade motion-reduce:animate-fade-in [--offset:5px] [animation-delay:300ms] [animation-duration:1s] [animation-fill-mode:both]",
    //       )}
    //     >
    //       <ButtonLink variant="primary" href="https://app.thereflist.com/register">
    //         Try Dub today
    //       </ButtonLink>
    //       <ButtonLink
    //         variant="secondary"
    //         href={createHref("/", params.domain, {
    //           ...UTM_PARAMS,
    //           utm_campaign: params.domain,
    //           utm_content: "Learn more",
    //         })}
    //       >
    //         Learn more
    //       </ButtonLink>
    //     </div>
    //   </Hero>
    //   <div className="mt-20">
    //     <FeaturesSection domain={params.domain} utmParams={UTM_PARAMS} />
    //   </div>
    //   <div className="mt-32">
    //     <CTA domain={params.domain} utmParams={UTM_PARAMS} />
    //   </div>
    // </main>
  );
}
