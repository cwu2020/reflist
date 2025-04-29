import { ExpandedLinkProps } from "@/lib/types";
import { DEFAULT_LINK_PROPS, PLANS } from "@dub/utils";
import {
  createContext,
  Dispatch,
  PropsWithChildren,
  SetStateAction,
  useContext,
  useState,
} from "react";
import { FormProvider, useForm } from "react-hook-form";
import { LinkFormData } from "./link-form-data";

export type LinkBuilderProps = {
  props?: ExpandedLinkProps;
  duplicateProps?: ExpandedLinkProps;
  workspace: {
    id?: string;
    slug?: string;
    plan?: string;
    nextPlan?: (typeof PLANS)[number];
    conversionEnabled?: boolean;
  };
  modal: boolean;
};

const LinkBuilderContext = createContext<
  | (LinkBuilderProps & {
      generatingMetatags: boolean;
      setGeneratingMetatags: Dispatch<SetStateAction<boolean>>;
    })
  | null
>(null);

export function useLinkBuilderContext() {
  const context = useContext(LinkBuilderContext);
  if (!context)
    throw new Error(
      "useLinkBuilderContext must be used within a LinkBuilderProvider",
    );

  return context;
}

export function LinkBuilderProvider({
  children,
  ...rest
}: PropsWithChildren<LinkBuilderProps>) {
  const { plan, conversionEnabled } = rest.workspace || {};

  const [generatingMetatags, setGeneratingMetatags] = useState(
    Boolean(rest.props),
  );

  // Get initial values from props or defaults
  const initialValues = rest.props || rest.duplicateProps || {
    ...DEFAULT_LINK_PROPS,
    trackConversion: conversionEnabled || false,
  };

  // Initialize productUrl with originalUrl if available, otherwise use url
  // This is important for edit mode where we want to show the original product URL
  const defaultValues = {
    ...initialValues,
    productUrl: initialValues.originalUrl || initialValues.url || '', // First try originalUrl (product URL), then fall back to url
  };

  const form = useForm<LinkFormData>({
    defaultValues,
  });

  return (
    <LinkBuilderContext.Provider
      value={{ ...rest, generatingMetatags, setGeneratingMetatags }}
    >
      <FormProvider {...form}>{children}</FormProvider>
    </LinkBuilderContext.Provider>
  );
}
