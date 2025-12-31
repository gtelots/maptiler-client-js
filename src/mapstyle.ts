/**
 * Expand the map style provided as argument of the Map constructor
 * @param style
 * @returns
 */
export function expandMapStyle(style): string {
  // testing if the style provided is of form "gtelmaps://some-style"
  const gtelmapsDomainRegex = /^maps.ots.vn:\/\/(.*)/;
  let match;
  const trimmed = style.trim();
  let expandedStyle;

  // The style was possibly already given as expanded URL
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    expandedStyle = trimmed;
  } else if ((match = gtelmapsDomainRegex.exec(trimmed)) !== null) {
    expandedStyle = `https://maps.ots.vn/api/styles/v1/${match[1]}/style.json`;
  } else {
    // The style could also possibly just be the name of the style without any URI style
    expandedStyle = `https://maps.ots.vn/api/styles/v1/${trimmed}/style.json`;
  }

  return expandedStyle;
}

/**
 * Type for object containing style details
 */
export type MapStylePreset = {
  referenceStyleID: string;
  name: string;
  description: string;
  variants: Array<{
    deprecated?: boolean;
    deprecationMessage?: string;
    id: string;
    name: string;
    variantType: string;
    description: string;
    imageURL: string;
  }>;
};

/**
 * An instance of MapStyleVariant contains information about a style to use that belong to a reference style
 */
export class MapStyleVariant {
  constructor(
    /**
     * Human-friendly name
     */
    private name: string,

    /**
     * Variant name the variant is addressed to from its reference style: `MapStyle.REFERNCE_STYLE_NAME.VARIANT_TYPE`
     */
    private variantType: string,

    /**
     * GTEL Maps Cloud id
     */
    private id: string,

    /**
     * Reference map style, used to retrieve sibling variants
     */
    private referenceStyle: ReferenceMapStyle,

    /**
     * Human-friendly description
     */
    private description: string,

    /**
     * URL to an image describing the style variant
     */
    private imageURL: string,

    /**
     * Whether this variant is deprecated or not
     */
    public deprecated: boolean = false,

    /**
     * Message to display when the variant is deprecated
     */
    public deprecationMessage?: string,
  ) {}

  /**
   * Get the human-friendly name
   * @returns
   */
  getName(): string {
    return this.name;
  }

  getFullName(): string {
    return `${this.referenceStyle.getName()} ${this.name}`;
  }

  /**
   * Get the variant type (eg. "DEFAULT", "DARK", "LIGHT", etc.)
   * @returns
   */
  getType(): string {
    return this.variantType;
  }

  /**
   * Get the GTEL Maps Cloud id
   * @returns
   */
  getId(): string {
    return this.id;
  }

  /**
   * Get the human-friendly description
   */
  getDescription(): string {
    return this.description;
  }

  /**
   * Get the reference style this variant belongs to
   * @returns
   */
  getReferenceStyle(): ReferenceMapStyle {
    return this.referenceStyle;
  }

  /**
   * Check if a variant of a given type exists for _this_ variants
   * (eg. if this is a "DARK", then we can check if there is a "LIGHT" variant of it)
   * @param variantType
   * @returns
   */
  hasVariant(variantType: string): boolean {
    return this.referenceStyle.hasVariant(variantType);
  }

  /**
   * Retrieve the variant of a given type. If not found, will return the "DEFAULT" variant.
   * (eg. _this_ "DARK" variant does not have any "LIGHT" variant, then the "DEFAULT" is returned)
   * @param variantType
   * @returns
   */
  getVariant(variantType: string): MapStyleVariant {
    const variant = this.referenceStyle.getVariant(variantType);
    this.warnIfDeprecated(variant);
    return variant;
  }

  /**
   * Get all the variants for _this_ variants, except _this_ current one
   * @returns
   */
  getVariants(): Array<MapStyleVariant> {
    return this.referenceStyle
      .getVariants()
      .filter((v) => v !== this)
      .map((v) => {
        this.warnIfDeprecated(v);
        return v;
      });
  }

  /**
   * Get the image URL that represent _this_ variant
   * @returns
   */
  getImageURL(): string {
    return this.imageURL;
  }

  /**
   * Get the style as usable by MapLibre, a string (URL) or a plain style description (StyleSpecification)
   * @returns
   */
  getExpandedStyleURL(): string {
    return expandMapStyle(this.getId());
  }

  warnIfDeprecated(variant: MapStyleVariant = this): MapStyleVariant {
    if (!variant.deprecated) return variant;

    if (variant.deprecationMessage) {
      console.warn(variant.deprecationMessage);
    } else {
      const name = variant.getFullName();
      console.warn(
        `Style "${name}" is deprecated and will be removed in a future version.`,
      );
    }

    return variant;
  }
}

/**
 * An instance of reference style contains a list of StyleVariants ordered by relevance
 */
export class ReferenceMapStyle {
  /**
   * Variants that belong to this reference style, key being the reference type
   */
  private variants: { [key: string]: MapStyleVariant } = {};

  /**
   * Variants that belong to this reference style, ordered by relevance
   */
  private orderedVariants: Array<MapStyleVariant> = [];

  constructor(
    /**
     * Human-friendly name of this reference style
     */
    private name: string,

    /**
     * ID of this reference style
     */
    private id: string,
  ) {}

  /**
   * Get the human-friendly name of this reference style
   * @returns
   */
  getName(): string {
    return this.name;
  }

  /**
   * Get the id of _this_ reference style
   * @returns
   */
  getId(): string {
    return this.id;
  }

  /**
   * Add a variant to _this_ reference style
   * @param v
   */
  addVariant(v: MapStyleVariant) {
    this.variants[v.getType()] = v;
    this.orderedVariants.push(v);
  }

  /**
   * Check if a given variant type exists for this reference style
   * @param variantType
   * @returns
   */
  hasVariant(variantType: string): boolean {
    return variantType in this.variants;
  }

  /**
   * Get a given variant. If the given type of variant does not exist for this reference style,
   * then the most relevant default variant is returned instead
   * @param variantType
   * @returns
   */
  getVariant(variantType: string): MapStyleVariant {
    return variantType in this.variants
      ? this.variants[variantType]
      : this.orderedVariants[0];
  }

  /**
   * Get the list of variants for this reference style
   * @returns
   */
  getVariants(): Array<MapStyleVariant> {
    return Object.values(this.variants);
  }

  /**
   * Get the defualt variant for this reference style
   * @returns
   */
  getDefaultVariant(): MapStyleVariant {
    return this.orderedVariants[0].warnIfDeprecated();
  }
}

/**
 * All the styles and variants maintained by GTEL Maps.
 */
export type MapStyleType = {
  /**
   * Suitable for navigation, with high level of detail on urban areas, plenty of POIs and 3D buildings
   */
  STREETS_V1: ReferenceMapStyle & {
    /**
     * Suitable for navigation, with high level of detail on urban areas, plenty of POIs and 3D buildings.
     */
    DEFAULT: MapStyleVariant;
    /**
     * Suitable for navigation, with high level of detail on urban areas, plenty of POIs and 3D buildings, in dark mode.
     */
    NIGHT: MapStyleVariant;
  };
  /**
   * Suitable for navigation, with high level of detail on urban areas, plenty of POIs and 3D buildings
   */
  NAVIGATION_V1: ReferenceMapStyle & {
    /**
     * Suitable for navigation, with high level of detail on urban areas, plenty of POIs and 3D buildings.
     */
    DEFAULT: MapStyleVariant;
    /**
     * Suitable for navigation, with high level of detail on urban areas, plenty of POIs and 3D buildings, in dark mode.
     */
    NIGHT: MapStyleVariant;
  };

  /**
   * A minimalist street-oriented style without POI
   */
  BASIC_V1: ReferenceMapStyle & {
    /**
     * A minimalist street-oriented style without POI
     */
    DEFAULT: MapStyleVariant;
    /**
     * A minimalist street-oriented style without POI, in dark mode
     */
    DARK: MapStyleVariant;
    /**
     * A minimalist street-oriented style without POI, in light mode
     */
    LIGHT: MapStyleVariant;
  };

  /**
   * High resolution imagery only, without any label.
   */
  SATELLITE_V1: ReferenceMapStyle & {
    /**
     * High resolution imagery only, without any label.
     */
    DEFAULT: MapStyleVariant;
    /**
     * High resolution imagery with labels, political borders and roads.
     */
    HYBRID: MapStyleVariant;
  };
};

export const mapStylePresetList: Array<MapStylePreset> = [
  {
    referenceStyleID: "STREETS_V1",
    name: "Streets",
    description: "",
    variants: [
      {
        id: "gtelmaps-streets-v1",
        name: "Default",
        variantType: "DEFAULT",
        description: "",
        imageURL: "",
      },
      {
        id: "gtelmaps-streets-night-v1",
        name: "Night",
        variantType: "NIGHT",
        description: "",
        imageURL: "",
      },
    ],
  },
  {
    referenceStyleID: "NAVIGATION_V1",
    name: "Navigation",
    description: "",
    variants: [
      {
        id: "gtelmaps-navigation-day-v1",
        name: "Default",
        variantType: "DEFAULT",
        description: "",
        imageURL: "",
      },
      {
        id: "gtelmaps-navigation-night-v1",
        name: "Night",
        variantType: "NIGHT",
        description: "",
        imageURL: "",
      },
    ],
  },
  {
    referenceStyleID: "BASIC_V1",
    name: "Basic",
    description: "",
    variants: [
      {
        id: "gtelmaps-basic-v1",
        name: "Default",
        variantType: "DEFAULT",
        description: "",
        imageURL: "",
      },
      {
        id: "gtelmaps-dark-v1",
        name: "Dark",
        variantType: "DARK",
        description: "",
        imageURL: "",
      },
      {
        id: "gtelmaps-light-v1",
        name: "Light",
        variantType: "LIGHT",
        description: "",
        imageURL: "",
      },
    ],
  },

  {
    referenceStyleID: "SATELLITE_V1",
    name: "Satellite",
    description: "",
    variants: [
      {
        id: "gtelmaps-satellite-v1",
        name: "Default",
        variantType: "DEFAULT",
        description: "",
        imageURL: "",
      },
      {
        id: "gtelmaps-satellite-streets-v1",
        name: "Hybrid",
        variantType: "HYBRID",
        description: "",
        imageURL: "",
      },
    ],
  },
];

/**
 * Map of default reference styles to their versioned counterparts.
 * This is make it easier to version the default reference styles.
 * Note: the type definition `MapStyleType` will need to be updated to reflect this.
 */
const defaultReferenceStyleMap = {
  STREETS: "STREETS_V1",
  BASIC: "BASIC_V1",
};

function applyVersionToDefaultReferenceStyle(
  defaultKey: string,
  referenceKey: string,
) {
  if (
    mapStylePresetList.find((style) => style.referenceStyleID === defaultKey)
  ) {
    console.warn(
      `Default reference style ${defaultKey} already exists, it will be overwritten...`,
    );
  }

  const versionedMapStyle = mapStylePresetList.find(
    (style) => style.referenceStyleID === referenceKey,
  );
  if (!versionedMapStyle) {
    throw new Error(
      `Versioned map style not found for reference style: ${referenceKey}`,
    );
  }
  const defaultStyle = {
    ...versionedMapStyle,
    referenceStyleID: defaultKey,
  };
  mapStylePresetList.push(defaultStyle);
}

Object.entries(defaultReferenceStyleMap).forEach(
  ([defaultKey, referenceKey]) => {
    applyVersionToDefaultReferenceStyle(defaultKey, referenceKey);
  },
);

function makeReferenceStyleProxy(referenceStyle: ReferenceMapStyle) {
  return new Proxy(referenceStyle, {
    get(target, prop, receiver) {
      if (target.hasVariant(prop as string)) {
        return target.getVariant(prop as string);
      }

      // This variant does not exist for this style, but since it's full uppercase
      // we guess that the dev tries to access a style variant. So instead of
      // returning the default (STREETS_V1.DEFAULT), we return the non-variant of the current style
      if (prop.toString().toUpperCase() === (prop as string)) {
        return referenceStyle.getDefaultVariant();
      }

      const style = Reflect.get(target, prop, receiver);

      return style;
    },
  });
}

function buildMapStyles(): MapStyleType {
  const mapStyle = {};

  for (let i = 0; i < mapStylePresetList.length; i += 1) {
    const refStyleInfo = mapStylePresetList[i];

    const refStyle = makeReferenceStyleProxy(
      new ReferenceMapStyle(refStyleInfo.name, refStyleInfo.referenceStyleID),
    );

    for (let j = 0; j < refStyleInfo.variants.length; j += 1) {
      const variantInfo = refStyleInfo.variants[j];
      const variant = new MapStyleVariant(
        variantInfo.name, // name
        variantInfo.variantType, // variantType
        variantInfo.id, // id
        refStyle, // referenceStyle
        variantInfo.description,
        variantInfo.imageURL, // imageURL
        variantInfo.deprecated, // deprecated
      );

      refStyle.addVariant(variant);
    }
    mapStyle[refStyleInfo.referenceStyleID] = refStyle;
  }
  return mapStyle as MapStyleType;
}

export function styleToStyle(
  style: string | ReferenceMapStyle | MapStyleVariant | null | undefined,
): string {
  if (!style) {
    return MapStyle[mapStylePresetList[0].referenceStyleID]
      .getDefaultVariant()
      .getId();
  }

  // If the provided style is a shorthand (eg. "gtelmaps-streets-v1") then we make sure it's trimmed and lowercase
  if (typeof style === "string" || style instanceof String) {
    return style.trim().toLowerCase();
  }

  if (style instanceof MapStyleVariant) {
    return style.getId();
  }

  if (style instanceof ReferenceMapStyle) {
    return style.getDefaultVariant().getId();
  }
}

/**
 * Contains all the reference map style created by GTEL Maps team as well as all the variants.
 * For example, `MapStyle.STREETS_V1` and the variants:
 * - `MapStyle.STREETS_V1.DEFAULT`
 * - `MapStyle.STREETS_V1.NIGHT`
 *
 */
export const MapStyle: MapStyleType = buildMapStyles();
