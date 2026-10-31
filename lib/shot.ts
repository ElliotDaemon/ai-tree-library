/** The free capture service (WordPress mShots). A real capture returns at the requested width. */
export const shotUrl = (url: string, w = 1200, h = 750) => `https://s0.wp.com/mshots/v1/${encodeURIComponent(url)}?w=${w}&h=${h}`;
