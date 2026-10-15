// The four customer types as the owner's clay characters (public/archetypes),
// in place of their emoji. Decorative: the type's name is always beside it.
export default function AnimalArt({ id, size = 24 }: { id: string; size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/archetypes/animal-${id}.png`} alt="" aria-hidden="true" width={size} height={size}
      style={{ display: "inline-block", width: size, height: size, flexShrink: 0, verticalAlign: "middle", objectFit: "contain" }} />
  );
}
