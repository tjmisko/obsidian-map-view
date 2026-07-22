import * as leaflet from 'leaflet';
import 'leaflet-extra-markers';
import 'leaflet-extra-markers/dist/css/leaflet.extra-markers.min.css';
import {
    App,
    TFile,
    getAllTags,
    type HeadingCache,
    type BlockCache,
    type LinkCache,
    parseLinktext,
    resolveSubpath,
    type FrontmatterLinkCache,
    type ReferenceCache,
} from 'obsidian';
import * as path from 'path';

import { BaseGeoLayer, verifyLocation, addTagsToLayer } from 'src/baseGeoLayer';
import { type IconOptions } from 'src/markerIcons';
import {
    djb2Hash,
    getHeadingAndBlockForFilePosition,
    appendGeolocationToNote,
} from 'src/utils';
import { type PluginSettings } from 'src/settings';
import * as regex from 'src/regex';
import * as consts from 'src/consts';
import * as utils from 'src/utils';
import { GeoJsonLayer } from './geojsonLayer';
import type MapViewPlugin from './main';
import { getIconFromRules } from 'src/markerIcons';

/** An object that represents a single marker in a file, which is either a complete note with a geolocation, or an inline geolocation inside a note */
export class FileMarker extends BaseGeoLayer {
    public geoLayers: Map<number, leaflet.Marker> = new Map();
    public location: leaflet.LatLng;
    public icon?: leaflet.Icon<IconOptions>;
    public opacity: number = 1.0;

    /**
     * Construct a new FileMarker object
     * @param file The file the pin comes from
     * @param location The geolocation
     */
    constructor(file: TFile, location: leaflet.LatLng) {
        super(file);
        this.layerType = 'fileMarker';
        this.location = location;
        this.generateId();
    }

    get isFrontmatterMarker(): boolean {
        return !this.fileLine;
    }

    isSame(other: BaseGeoLayer): boolean {
        return (
            other instanceof FileMarker &&
            this.file.name === other.file.name &&
            this.location.toString() === other.location.toString() &&
            this.fileLocation === other.fileLocation &&
            this.fileLine === other.fileLine &&
            this.extraName === other.extraName &&
            this.icon?.options?.iconUrl === other.icon?.options?.iconUrl &&
            // @ts-ignore
            this.icon?.options?.icon === other.icon?.options?.icon &&
            // @ts-ignore
            this.icon?.options?.iconColor === other.icon?.options?.iconColor &&
            // @ts-ignore
            this.icon?.options?.markerColor ===
                other.icon?.options?.markerColor &&
            this.opacity === other.opacity
        );
    }

    generateId() {
        this.id = generateMarkerId(
            this.file.name,
            this.location.lat.toString(),
            this.location.lng.toString(),
            this.fileLocation,
            this.fileLine,
        );
    }

    getBounds(): leaflet.LatLng[] {
        return [this.location];
    }

    runDisplayRules(plugin: MapViewPlugin) {
        [this.icon, this.opacity] = getIconFromRules(
            this,
            plugin.displayRulesCache,
            plugin.iconFactory,
        );
    }
}

export function generateMarkerId(
    fileName: string,
    lat: string,
    lng: string,
    fileLocation?: number,
    fileLine?: number,
): string {
    return (
        djb2Hash(fileName) +
        lat +
        lng +
        'loc-' +
        (fileLocation
            ? fileLocation
            : fileLine
              ? 'nofileloc' + fileLine
              : 'nofileline')
    );
}

/**
 * Build markers from inline locations in the file body.
 * Properties non-essential for filtering, e.g. the marker icon, are not built here yet.
 * @param file The file object to load
 * @param settings The plugin settings
 * @param app The Obsidian App instance
 */
export async function getMarkersFromFileContent(
    file: TFile,
    settings: PluginSettings,
    app: App,
): Promise<FileMarker[]> {
    let markers: FileMarker[] = [];
    // Get the tags of the file, to these we will add the tags associated with each individual marker (inline tags)
    const metadata = app.metadataCache.getFileCache(file);
    const fileTags = getAllTags(metadata);
    const content = await app.vault.read(file);
    const matches = matchInlineLocation(content);
    for (const match of matches) {
        try {
            const location = new leaflet.LatLng(
                parseFloat(match.groups.lat),
                parseFloat(match.groups.lng),
            );
            verifyLocation(location);
            const marker = new FileMarker(file, location);
            if (match.groups.name && match.groups.name.length > 0)
                marker.extraName = match.groups.name;
            if (match.groups.tags) addTagsToLayer(marker, match.groups.tags);
            marker.tags = marker.tags.concat(fileTags);
            marker.fileLocation = match.index;
            marker.geolocationMatch = match;
            marker.fileLine =
                content.substring(0, marker.fileLocation).split('\n').length -
                1;
            const [heading, block] = getHeadingAndBlockForFilePosition(
                metadata,
                marker.fileLocation,
            );
            marker.fileHeading = heading;
            marker.fileBlock = block;
            // Regenerate the ID because the marker details changed since it was generated
            marker.generateId();
            markers.push(marker);
        } catch (e) {
            console.log(
                `Error converting location in file ${file.name}: could not parse ${match[0]}`,
                e,
            );
        }
    }
    return markers;
}

/**
 * Find all inline geolocations in a string
 * @param content The file contents to find the coordinates in
 */
export function matchInlineLocation(content: string): RegExpMatchArray[] {
    // Old syntax of ` `location: ... ` `. This syntax doesn't support a name so we leave an empty capture group
    const locationRegex1 = regex.INLINE_LOCATION_OLD_SYNTAX;
    // New syntax of `[name](geo:...)` and an optional tags as `tag:tagName` separated by whitespaces
    const locationRegex2 = regex.INLINE_LOCATION_WITH_TAGS;
    const matches1 = content.matchAll(locationRegex1);
    const matches2 = content.matchAll(locationRegex2);
    return Array.from(matches1).concat(Array.from(matches2));
}

/**
 * Get the geolocation stored in the front matter of a file
 * @param file The file to load the front matter from
 * @param app The Obsidian App instance
 */
export function getFrontMatterLocation(
    file: TFile,
    app: App,
    settings: PluginSettings,
): leaflet.LatLng {
    const fileCache = app.metadataCache.getFileCache(file);
    const frontMatter = fileCache?.frontmatter;
    if (frontMatter && settings.frontMatterKey in frontMatter) {
        try {
            const frontMatterLocation = frontMatter[settings.frontMatterKey];
            // V1 format: an array in the format of `location: [lat,lng]`
            if (frontMatterLocation?.length == 2) {
                // Allow arrays of either strings or numbers
                const lat = parseFloat(frontMatterLocation[0]);
                const lng = parseFloat(frontMatterLocation[1]);
                if (Number.isNaN(lat) || Number.isNaN(lng)) {
                    console.log(
                        'Unknown location format:',
                        frontMatterLocation,
                    );
                    return null;
                }
                const location = new leaflet.LatLng(
                    frontMatterLocation[0],
                    frontMatterLocation[1],
                );
                verifyLocation(location);
                return location;
            } else if (frontMatterLocation && frontMatterLocation?.length > 0) {
                // V2 format: a string in the format of `location: "lat,lng"` or `location: ["lat,lng"]`
                // (which is more compatible with Obsidian's property editor)
                let locationToUse = frontMatterLocation;
                if (
                    locationToUse.length === 1 &&
                    typeof locationToUse === 'object' &&
                    locationToUse[0].length > 0
                ) {
                    // What we have seems like the case of `location: ["lat,lng"]`
                    locationToUse = frontMatterLocation[0];
                }
                const locationV2 = locationToUse.match(regex.COORDINATES);
                if (
                    locationV2 &&
                    locationV2.groups &&
                    locationV2.groups.lat &&
                    locationV2.groups.lng
                ) {
                    const location = new leaflet.LatLng(
                        locationV2.groups.lat,
                        locationV2.groups.lng,
                    );
                    verifyLocation(location);
                    return location;
                } else
                    console.log(
                        `Unknown front matter location format: `,
                        frontMatterLocation,
                    );
            }
        } catch (e) {
            console.log(`Error converting location in file ${file.name}:`, e);
        }
    }
    return null;
}

/**
 * Returns true if the marker is linked from the given link reference.
 * If the link includes a header or a block reference and the marker is an inline marker, 'true' is returned
 * only if the marker is in that header/block. A front-matter marker is considered link regardless of the block/header.
 */
export function isLayerLinkedFrom(
    marker: BaseGeoLayer,
    linkCache: LinkCache | FrontmatterLinkCache | ReferenceCache,
    app: App,
) {
    const parsedLink = parseLinktext(linkCache.link);
    const fileMatches =
        parsedLink.path.toLowerCase() === marker.file.basename.toLowerCase() ||
        parsedLink.path === marker.file.name ||
        linkCache.displayText.toLowerCase() ===
            marker.file.basename.toLowerCase();
    // If the link is not pointing at the marker's file at all, there's nothing more to talk about
    if (!fileMatches) return false;

    // Now if it's a front matter marker, being the right file is all we need
    if (marker instanceof FileMarker && marker.isFrontmatterMarker) return true;
    // Also if it's a GeoJSON marker
    if (marker instanceof GeoJsonLayer) return true;
    // If the link doesn't have a subpath, being the right file is all we need too
    if (!parsedLink.subpath) return true;

    // If we get here, the link we received has a subpath (meaning it links to a header/block) and the marker
    // is an inline one. We will therefore return true only if the marker itself has a header/block and it matches
    // the link
    if (!marker.fileBlock && !marker.fileHeading) {
        return false;
    }

    const markerFileCache = app.metadataCache.getFileCache(marker.file);
    const subpath = resolveSubpath(markerFileCache, parsedLink?.subpath);
    if (subpath) {
        if (
            marker.fileBlock &&
            subpath.type === 'block' &&
            subpath.block.id == marker.fileBlock.id
        )
            return true;
        if (
            marker.fileHeading &&
            subpath.type === 'heading' &&
            subpath.current.heading == marker.fileHeading.heading &&
            subpath.current.level == marker.fileHeading.level
        )
            return true;
    }
    return false;
}

/**
 * Create a FileMarker for every front matter and inline geolocation in the given file.
 * Properties that are not essential for filtering, e.g. marker icons, are not created here yet.
 * @param mapToAppendTo The list of markers to append to
 * @param file The file object to parse
 * @param settings The plugin settings
 * @param app The Obsidian App instance
 * @param skipMetadata If true will not find markers in the front matter
 */
export async function buildAndAppendFileMarkers(
    files: TFile[],
    settings: PluginSettings,
    app: App,
    plugin: MapViewPlugin,
    skipMetadata?: boolean,
): Promise<FileMarker[]> {
    let layers: FileMarker[] = [];
    for (const file of files) {
        const fileCache = app.metadataCache.getFileCache(file);
        const frontMatter = fileCache?.frontmatter;
        const tagNameToSearch = settings.tagForGeolocationNotes?.trim();
        if (frontMatter || tagNameToSearch?.length > 0) {
            if (frontMatter && !skipMetadata) {
                const location = getFrontMatterLocation(file, app, settings);
                if (location) {
                    verifyLocation(location);
                    let marker = new FileMarker(file, location);
                    marker.tags = getAllTags(fileCache);
                    layers.push(marker);
                }
            }
            if (
                utils.hasFrontMatterLocations(frontMatter, fileCache, settings)
            ) {
                const markersFromFile = await getMarkersFromFileContent(
                    file,
                    settings,
                    app,
                );
                layers.push(...markersFromFile);
            }
        }
    }

    for (const layer of layers) {
        layer.runDisplayRules(plugin);
    }

    return layers;
}

export async function moveFileMarker(
    marker: FileMarker,
    newLocation: leaflet.LatLng,
    settings: PluginSettings,
    app: App,
) {
    marker.location = newLocation;
    let newLat = marker.location.lat;
    // If the user drags the marker too far, the longitude will exceed the threshold, an
    // exception will be thrown, and the marker will disappear.
    // If the threshold is exceeded, set the longitude back to the max (back in bounds).
    // leaflet seems to protect against drags beyond the latitude threshold.
    let newLng = marker.location.lng;
    if (newLng < consts.LNG_LIMITS[0]) {
        newLng = consts.LNG_LIMITS[0];
    }
    if (newLng > consts.LNG_LIMITS[1]) {
        newLng = consts.LNG_LIMITS[1];
    }
    // We will now change the content of the note containing the marker. This will trigger Map View to rebuild
    // the marker, causing the actual marker object to be replaced.
    if (marker.isFrontmatterMarker) {
        await utils.verifyOrAddFrontMatter(
            app,
            marker.file,
            settings.frontMatterKey,
            `${newLat},${newLng}`,
            false,
        );
    } else if (marker.geolocationMatch?.groups) {
        await utils.updateInlineGeolocation(
            app,
            marker.file,
            marker.fileLocation,
            marker.geolocationMatch,
            marker.location,
            null,
        );
    }
}
