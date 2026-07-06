import { SelectGroup, SelectItem, SelectLabel } from "@/components/ui/select";
import { humanizeModelId } from "@/humanizeModelId";
import type { ModelCatalog } from "@/protocol";

/**
 * Model catalog rendered as Select options — the single grouping rule shared
 * by every model picker: grouped by provider when there is more than one
 * provider, a flat list otherwise.
 */
export function ModelCatalogOptions(props: { catalog: ModelCatalog }) {
    if (props.catalog.providers.length > 1) {
        return (
            <>
                {props.catalog.providers.map((provider) => (
                    <SelectGroup key={provider.providerId}>
                        <SelectLabel>{humanizeModelId(provider.providerId)}</SelectLabel>
                        {provider.models.map((model) => (
                            <SelectItem key={model.id} value={model.id}>
                                {model.name}
                            </SelectItem>
                        ))}
                    </SelectGroup>
                ))}
            </>
        );
    }
    return (
        <>
            {props.catalog.models.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                    {model.name}
                </SelectItem>
            ))}
        </>
    );
}
