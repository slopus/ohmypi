import type { ServiceTier } from "../../providers/types.js";
import { modelProfiles } from "./modelProfiles.js";
import type { ProfileProviderType } from "./types.js";

export function serviceTiersForProfileProviderType(
    providerType: ProfileProviderType,
): readonly ServiceTier[] {
    return [
        ...new Set(
            modelProfiles
                .filter((profile) => profile.providerType === providerType)
                .flatMap((profile) => profile.parameters.serviceTiers),
        ),
    ];
}
