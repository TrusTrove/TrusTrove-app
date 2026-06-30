import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RegistryClient, Profile } from "@trusttrove/sdk";
import { useWalletStore } from "@/store/wallet";

const registryContractID = process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID || "";

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
        // getProfile throws a simulation error if profile doesn't exist.
        // We return null to indicate the profile is not registered.
        return null;
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
