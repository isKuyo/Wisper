// ═══════════════════════════════════════════════════════════════
// ROBLOX API UTILITIES
// ═══════════════════════════════════════════════════════════════

/**
 * Get game/universe info from Roblox API
 * @param {number|string} placeId - The place ID
 * @returns {Promise<{universeId: number, name: string, iconUrl: string}|null>}
 */
async function getGameInfo(placeId) {
  try {
    // First, get universe ID from place ID
    const universeResponse = await fetch(
      `https://apis.roblox.com/universes/v1/places/${placeId}/universe`
    );
    
    if (!universeResponse.ok) {
      console.log(`[Roblox] Failed to get universe for place ${placeId}`);
      return null;
    }
    
    const universeData = await universeResponse.json();
    const universeId = universeData.universeId;
    
    if (!universeId) {
      return null;
    }

    // Get game details
    const [detailsResponse, iconResponse] = await Promise.all([
      fetch(`https://games.roblox.com/v1/games?universeIds=${universeId}`),
      fetch(`https://thumbnails.roblox.com/v1/games/icons?universeIds=${universeId}&returnPolicy=PlaceHolder&size=128x128&format=Png&isCircular=false`)
    ]);

    let name = `Game ${placeId}`;
    let iconUrl = null;

    if (detailsResponse.ok) {
      const detailsData = await detailsResponse.json();
      if (detailsData.data && detailsData.data[0]) {
        name = detailsData.data[0].name;
      }
    }

    if (iconResponse.ok) {
      const iconData = await iconResponse.json();
      if (iconData.data && iconData.data[0]) {
        iconUrl = iconData.data[0].imageUrl;
      }
    }

    return {
      universeId,
      name,
      iconUrl
    };
  } catch (error) {
    console.error('[Roblox] Error fetching game info:', error);
    return null;
  }
}

/**
 * Get game icon URL from place ID
 * @param {number|string} placeId - The place ID
 * @returns {Promise<string|null>}
 */
async function getGameIcon(placeId) {
  const info = await getGameInfo(placeId);
  return info?.iconUrl || null;
}

module.exports = { getGameInfo, getGameIcon };
