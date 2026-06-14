/**
 * Room Link DOM Processor
 *
 * Post-processes rendered Markdown to add clickable room links
 * Works by traversing DOM text nodes after Streamdown renders
 */

import { ROOM_NAME_PATTERNS } from "./roomLinks";

/**
 * Process a DOM container to add clickable room links
 *
 * @param container - The DOM element containing rendered Markdown
 * @param onRoomClick - Callback when a room link is clicked
 */
export function processRoomLinksInDOM(
  container: HTMLElement,
  onRoomClick: (roomId: string) => void
): void {
  // Get all text nodes
  const textNodes = getTextNodes(container);

  for (const textNode of textNodes) {
    const text = textNode.textContent || "";
    const matches = findRoomMatchesInText(text);

    if (matches.length === 0) continue;

    // Create document fragment with text + links
    const fragment = document.createDocumentFragment();
    let lastIndex = 0;

    for (const match of matches) {
      // Add text before match
      if (match.start > lastIndex) {
        fragment.appendChild(
          document.createTextNode(text.slice(lastIndex, match.start))
        );
      }

      // Create clickable link
      const link = document.createElement("button");
      link.textContent = match.text;
      link.className =
        "text-blue-600 hover:text-blue-800 underline decoration-dotted hover:decoration-solid transition-colors cursor-pointer font-medium inline";
      link.type = "button";
      link.title = `导航到 ${match.text}`;
      link.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        onRoomClick(match.roomId);
      };

      fragment.appendChild(link);
      lastIndex = match.end;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
    }

    // Replace text node with fragment
    textNode.parentNode?.replaceChild(fragment, textNode);
  }
}

/**
 * Get all text nodes in a container (excluding script/style tags)
 */
function getTextNodes(node: Node): Text[] {
  const textNodes: Text[] = [];
  const walker = document.createTreeWalker(
    node,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        // Skip empty text nodes
        if (!node.textContent?.trim()) {
          return NodeFilter.FILTER_REJECT;
        }

        // Skip script and style tags
        const parent = node.parentElement;
        if (
          parent?.tagName === "SCRIPT" ||
          parent?.tagName === "STYLE" ||
          parent?.tagName === "BUTTON"
        ) {
          return NodeFilter.FILTER_REJECT;
        }

        return NodeFilter.FILTER_ACCEPT;
      },
    }
  );

  let currentNode: Node | null;
  while ((currentNode = walker.nextNode())) {
    textNodes.push(currentNode as Text);
  }

  return textNodes;
}

interface RoomMatch {
  roomId: string;
  start: number;
  end: number;
  text: string;
}

/**
 * Find all room name matches in text
 */
function findRoomMatchesInText(text: string): RoomMatch[] {
  const matches: RoomMatch[] = [];

  for (const [roomId, patterns] of Object.entries(ROOM_NAME_PATTERNS)) {
    for (const pattern of patterns) {
      pattern.lastIndex = 0;

      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text)) !== null) {
        matches.push({
          roomId,
          start: match.index,
          end: match.index + match[0].length,
          text: match[0],
        });
      }
    }
  }

  // Sort by position
  matches.sort((a, b) => a.start - b.start);

  // Remove overlapping matches (keep longest)
  const filtered: RoomMatch[] = [];
  for (const match of matches) {
    const hasOverlap = filtered.some(
      (existing) =>
        (match.start >= existing.start && match.start < existing.end) ||
        (match.end > existing.start && match.end <= existing.end)
    );

    if (!hasOverlap) {
      filtered.push(match);
    } else {
      const overlapping = filtered.findIndex(
        (existing) =>
          (match.start >= existing.start && match.start < existing.end) ||
          (match.end > existing.start && match.end <= existing.end)
      );

      if (overlapping !== -1 && match.text.length > filtered[overlapping].text.length) {
        filtered[overlapping] = match;
      }
    }
  }

  return filtered;
}
