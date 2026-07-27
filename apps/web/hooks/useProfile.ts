import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RegistryClient, Profile } from "@trusttrove/sdk";
import { useWalletStore } from "@/store/wallet";
import { createErrorHandler } from "@/lib/errors";

const { captureError } = createErrorHandler("useProfile");

const registryContractID = process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID || "";

type ErrorWithDetails = {
  status?: unknown;
  statusCode?: unknown;
  code?: unknown;
  message?: unknown;
  response?: unknown;
  cause?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getErrorDetails(error: unknown): ErrorWithDetails | null {
  return isRecord(error) ? error : null;
}

function hasNotFoundStatus(value: unknown): boolean {
  if (typeof value === "number") return value === 404;
  if (typeof value === "string") return value === "404";
  return false;
}

function isProfileNotFoundError(error: unknown): boolean {
  const details = getErrorDetails(error);
  const response = details ? getErrorDetails(details.response) : null;
  const cause = details ? getErrorDetails(details.cause) : null;

  if (
    hasNotFoundStatus(details?.status) ||
    hasNotFoundStatus(details?.statusCode) ||
    hasNotFoundStatus(response?.status) ||
    hasNotFoundStatus(response?.statusCode) ||
    hasNotFoundStatus(cause?.status) ||
    hasNotFoundStatus(cause?.statusCode)
  ) {
    return true;
  }

  const values = [
    details?.code,
    details?.message,
    response?.message,
    cause?.message,
  ];
  return values.some(
    (value) =>
      typeof value === "string" &&
      /(?:profile[\s_-]*(?:not[\s_-]*found|does[\s_-]*not[\s_-]*exist|not[\s_-]*registered)|no[\s_-]*profile[\s_-]*found)/i.test(
        value,
      ),
  );
}

/**
 * Custom hook for interacting with the TrusTrove registry contract.
 *
 * Provides on-chain verification state, profile details, and mutations to
 * register a new issuer or buyer profile.
 *
 * @returns An object containing:
 *   - `profile` — The fetched Profile, or `null` if not registered/verified.
 *   - `isProfileLoading` — `true` while the profile is being fetched.
 *   - `profileError` — Fetch error, or `null` if none.
 *   - `isVerified` — Whether the address is verified on-chain.
 *   - `isVerifiedLoading` — `true` while verification state is being fetched.
 *   - `isVerifiedError` — Fetch error for verification, or `null` if none.
 *   - `register` — Async mutation: register as an issuer or buyer on-chain.
 *   - `isRegistering` / `registerError` — State for the register mutation.
 *   - `refetchProfile` — Function to manually refresh all profile query data.
 */
export function useProfile() {
  const queryClient = useQueryClient();
  const { address } = useWalletStore();

  const profileQuery = useQuery({
    queryKey: ["profile", address],
    queryFn: async (): Promise<Profile | null> => {
      if (!address) return null;
      const client = new RegistryClient(registryContractID);
      try {
        const profile = await client.getProfile(address, address);
        return profile;
      } catch (err) {
        // A missing profile is the only expected lookup failure. Preserve all
        // other errors so the UI can distinguish an outage from registration.
        if (isProfileNotFoundError(err)) return null;

        captureError(err);
        throw err;
      }
    },
    enabled: !!address,
  });

  const isVerifiedQuery = useQuery({
    queryKey: ["isVerified", address],
    queryFn: async (): Promise<boolean> => {
      if (!address) return false;
      const client = new RegistryClient(registryContractID);
      try {
        const verified = await client.isVerified(address, address);
        return verified;
      } catch (err) {
        captureError(err);
        return false;
      }
    },
    enabled: !!address,
  });

  const registerMutation = useMutation({
    mutationFn: async ({
      role,
      metadata,
    }: {
      role: "issuer" | "buyer";
      metadata: Record<string, string>;
    }) => {
      if (!address) throw new Error("Wallet not connected");
      const client = new RegistryClient(registryContractID);
      if (role === "issuer") {
        return client.registerIssuer(address, metadata, address);
      } else {
        return client.registerBuyer(address, metadata, address);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", address] });
      queryClient.invalidateQueries({ queryKey: ["isVerified", address] });
    },
    onError: (error) => {
      captureError(error);
    },
  });

  return {
    profile: profileQuery.data ?? null,
    isProfileLoading: profileQuery.isLoading,
    profileError: profileQuery.error,

    isVerified: isVerifiedQuery.data ?? false,
    isVerifiedLoading: isVerifiedQuery.isLoading,
    isVerifiedError: isVerifiedQuery.error,

    register: registerMutation.mutateAsync,
    isRegistering: registerMutation.isPending,
    registerError: registerMutation.error,

    refetchProfile: async () => {
      await Promise.all([profileQuery.refetch(), isVerifiedQuery.refetch()]);
    },
  };
}
