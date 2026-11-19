import { render, RenderOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { IntlError, IntlErrorCode, NextIntlClientProvider } from "next-intl";
import { ReactElement, ReactNode } from "react";
import messages from "@/messages/en.json";

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
}

// next-intl's default is to log a missing or malformed message and render its
// "Namespace.key" path instead. In tests that must fail loudly, otherwise a
// mistyped key only shows up as a confusing text-query miss.
// ENVIRONMENT_FALLBACK (e.g. no timeZone configured) keeps the default logging.
export function onIntlTestError(error: IntlError) {
  if (error.code === IntlErrorCode.ENVIRONMENT_FALLBACK) {
    console.error(error);
    return;
  }
  throw error;
}

/**
 * Wraps `children` with the same `en` messages the root layout passes to
 * `NextIntlClientProvider`, so components using `useTranslations` render the
 * real English copy.
 */
export function IntlTestProvider({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider
      locale="en"
      messages={messages}
      onError={onIntlTestError}
    >
      {children}
    </NextIntlClientProvider>
  );
}

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
) {
  const client = createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <IntlTestProvider>{children}</IntlTestProvider>
    </QueryClientProvider>
  );
  return render(ui, { wrapper, ...options });
}
