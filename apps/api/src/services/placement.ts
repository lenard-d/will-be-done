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
  if (placement.kind === "first") {
    return generateJitteredKeyBetween(null, entities[0]?.orderToken ?? null);
  }
  if (placement.kind === "last") {
    return generateJitteredKeyBetween(
      entities[entities.length - 1]?.orderToken ?? null,
      null,
    );
  }

  const index = anchorIndex(entities, placement);
  const anchor = entities[index];
  if (placement.kind === "before") {
    return generateJitteredKeyBetween(
      entities[index - 1]?.orderToken ?? null,
      anchor.orderToken,
    );
  }
  return generateJitteredKeyBetween(
    anchor.orderToken,
    entities[index + 1]?.orderToken ?? null,
  );
}
