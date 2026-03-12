/**
 * Utility functions for parsing shortcodes consistently across editor and grid views.
 */

/**
 * Parses a string of arguments into an array, respecting quotes.
 * e.g. '[count "Arrows" max=10]' -> (inner part: "Arrows" max=10) -> ['Arrows', 'max=10']
 */
export function parseArguments(str) {
    if (!str) return [];
    // Matches "something", 'something', or non-whitespace sequences
    const regex = /"([^"]+)"|'([^']+)'|\S+/g;
    const args = [];
    let match;
    while ((match = regex.exec(str)) !== null) {
        // match[1] corresponds to double quotes content
        // match[2] corresponds to single quotes content
        // match[0] corresponds to the raw string if no quotes (like max=10)
        args.push(match[1] !== undefined ? match[1] : (match[2] !== undefined ? match[2] : match[0]));
    }
    return args;
}

/**
 * Parses key=value pairs into an object.
 * Accepts either a raw string or an array of argument strings.
 */
export function parseKeyValueArgs(input) {
    const params = {};
    if (!input) return params;

    let args = [];
    if (typeof input === 'string') {
        // If it's a raw string, we can use a more robust regex that ignores quoted equals
        const regex = /(\w+)=(?:(["'])(.*?)\2|(\S+))/g;
        let match;
        while ((match = regex.exec(input)) !== null) {
            params[match[1].toLowerCase()] = (match[3] || match[4]).replace(/^['"]|['"]$/g, '');
        }
        return params;
    } else if (Array.isArray(input)) {
        args = input;
    }

    args.forEach(arg => {
        if (typeof arg !== 'string') return;
        const parts = arg.split('=');
        if (parts.length === 2) {
            params[parts[0].toLowerCase()] = parts[1].replace(/^['"]|['"]$/g, '');
        }
    });

    return params;
}

/**
 * Unified Regexes for Shortcodes to ensure Editor and Grid View identify shortcodes identically.
 */
export const shortcodeRegexes = {
    // Matches [container ... ] ... [/container]
    container: /\[container\s+([^\]]*)\]([\s\S]*?)\[\/container\]/gi,

    // Matches [ficha] ... [/ficha]
    ficha: /\[ficha\]([\s\S]*?)\[\/ficha\]/gi,

    // Matches [money ...]
    money: /\[money\s+([^\]]+)\]/gi,

    // Matches [hp ...]
    hp: /\[hp\s+([^\]]+)\]/gi,

    // Matches [stat ...]
    stat: /\[stat\s+([^\]]+)\]/gi,

    // Matches [*count ...] or [count ...]
    count: /\[(\*|count)\s+([^\]]+)\]/gi,

    // Matches [xp ...]
    xp: /\[xp\s+([^\]]+)\]/gi,
};
