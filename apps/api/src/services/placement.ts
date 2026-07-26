import { generateJitteredKeyBetween } from "fractional-indexing-jittered";
import { InvalidPlacementError } from "./errors";

export type Placement =
  | { kind: "first" }
  | { kind: "last" }
  | { kind: "before"; anchorId: string }
  | { kind: "after"; anchorId: string };

export interface OrderedEntity {
  id: string;
  orderToken: string;
}

function anchorIndex<T extends OrderedEntity>(
  entities: T[],
  placement: Extract<Placement, { anchorId: string }>,
): number {
  const index = entities.findIndex(
    (entity) => entity.id === placement.anchorId,
  );
  if (index === -1) {
    throw new InvalidPlacementError(
      "Placement anchor must be an entity in the destination collection",
    );
  }
  return index;
}

export function resolveCreatePosition<T extends OrderedEntity>({
  entities,
  placement,
}: {
  entities: T[];
  placement: Placement;
}): "prepend" | "append" | [T | null, T | null] {
  if (placement.kind === "first") return "prepend";
  if (placement.kind === "last") return "append";

  const index = anchorIndex(entities, placement);
  if (placement.kind === "before") {
    return [entities[index - 1] ?? null, entities[index]];
  }
  return [entities[index], entities[index + 1] ?? null];
}

export function resolveOrderToken<T extends OrderedEntity>({
  entities,
  placement,
}: {
  entities: T[];
  placement: Placement;
}): string {
  const position = resolveCreatePosition({ entities, placement });
  const [preceding, following] =
    position === "prepend"
      ? [null, entities[0] ?? null]
      : position === "append"
        ? [entities[entities.length - 1] ?? null, null]
        : position;

  return generateJitteredKeyBetween(
    preceding?.orderToken ?? null,
    following?.orderToken ?? null,
  );
}
