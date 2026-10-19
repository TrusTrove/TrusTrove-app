import { useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { RegistryClient, Profile } from "@trusttrove/sdk";
import { useWalletStore } from "@/store/wallet";
import { createErrorHandler } from "@/lib/errors";
import { useAppError } from "./useAppError";

const { captureError } = createErrorHandler("useProfile");

const registryContractID = process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID || "";

type ErrorWithResponse = {
  status?: number;
  statusCode?: number;
  response?: {
    status?: number;
    statusCode?: number;
  };
};

function getErrorStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;

  const errorWithResponse = error as ErrorWithResponse;
  return (
    errorWithResponse.status ??
    errorWithResponse.statusCode ??
    errorWithResponse.response?.status ??
    errorWithResponse.response?.statusCode
  );
}

function isProfileNotFoundError(error: unknown): boolean {
  if (getErrorStatus(error) === 404) return true;

  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  return (
    message.includes("profile not found") ||
    message.includes("profile does not exist") ||
    message.includes("no profile found") ||
    message.includes("profile is not registered") ||
    message.includes("profile not registered")
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
 *     Rejects without sending a transaction when the wallet already has a
 *     profile, since the registry's registration is one-time.
 *   - `isRegistering` / `registerError` — State for the register mutation.
 *   - `refetchProfile` — Function to manually refresh all profile query data.
 */
export function useProfile() {
  const queryClient = useQueryClient();
  const address = useWalletStore((s) => s.address);
  const { error: appError, handleError, clearError } = useAppError();

  // The Navbar calls this hook on every route, so the SDK import and client
  // construction are deferred until a query/mutation actually needs them. A
  // single promise is cached per mount so refetches/polls don't churn new
  // client objects (#995).
  const registryClientPromise = useRef<Promise<RegistryClient> | null>(null);
  const getRegistryClient = useCallback(() => {
    if (!registryClientPromise.current) {
      registryClientPromise.current = import("@trusttrove/sdk").then(
        ({ RegistryClient }) => new RegistryClient(registryContractID),
      );
    }
    return registryClientPromise.current;
  }, []);

  const profileQuery = useQuery({
    queryKey: ["profile", address],
    queryFn: async (): Promise<Profile | null> => {
      if (!address) return null;
      const registryClient = await getRegistryClient();
      try {
        const profile = await registryClient.getProfile(address, address);
        return profile;
      } catch (err) {
        if (isProfileNotFoundError(err)) {
          return null;
        }

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
      const registryClient = await getRegistryClient();
      try {
        const verified = await registryClient.isVerified(address, address);
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
      // `register_issuer` / `register_buyer` panic with AlreadyRegistered for an
      // address that is already on the registry, so a second call for this
      // wallet can only ever build a transaction that reverts. Refuse it here
      // instead of asking the user to sign it.
      if (profileQuery.data) {
        throw new Error(
          `This wallet is already registered as ${profileQuery.data.role}. Registration is one-time, so profile metadata cannot be updated.`,
        );
      }
      const registryClient = await getRegistryClient();
      if (role === "issuer") {
        return registryClient.registerIssuer(address, metadata, address);
      } else {
        return registryClient.registerBuyer(address, metadata, address);
      }
    },
    onSuccess: () => {
      clearError();
      queryClient.invalidateQueries({ queryKey: ["profile", address] });
      queryClient.invalidateQueries({ queryKey: ["isVerified", address] });
    },
    onError: (error) => {
      captureError(error);
      handleError(error, "Profile registration failed");
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
    appError,

    refetchProfile: async () => {
      await Promise.all([profileQuery.refetch(), isVerifiedQuery.refetch()]);
    },
  };
}
