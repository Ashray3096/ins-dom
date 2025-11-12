/**
 * Selector Generation Utilities
 *
 * Generate CSS selectors and XPath for DOM elements
 * Used by visual template builder
 */

/**
 * Generate a unique CSS selector for an element
 * Tries to use IDs, classes, and structural information
 */
export function generateCssSelector(element: Element): string {
  // If element has an ID, use it (most specific)
  if (element.id) {
    return `#${element.id}`;
  }

  // Build selector from parent chain
  const path: string[] = [];
  let current: Element | null = element;

  while (current && current.nodeType === Node.ELEMENT_NODE) {
    let selector = current.tagName.toLowerCase();

    // Add class if available
    if (current.className && typeof current.className === 'string') {
      const classes = current.className.trim().split(/\s+/)
        .filter(c => c && !c.startsWith('inspector-dom-')); // Exclude our internal classes

      if (classes.length > 0) {
        selector += '.' + classes.join('.');
      }
    }

    // Add nth-child if no classes
    if (!current.className || typeof current.className !== 'string') {
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(
          child => child.tagName === current!.tagName
        );

        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          selector += `:nth-child(${index})`;
        }
      }
    }

    path.unshift(selector);

    // Stop at a unique element or at the body
    if (current.id || current.tagName.toLowerCase() === 'body') {
      break;
    }

    current = current.parentElement;
  }

  return path.join(' > ');
}

/**
 * Generate XPath for an element
 */
export function generateXPath(element: Element): string {
  if (element.id) {
    return `//*[@id="${element.id}"]`;
  }

  const paths: string[] = [];
  let current: Element | null = element;

  while (current && current.nodeType === Node.ELEMENT_NODE) {
    let index = 0;
    let sibling: Element | null = current.previousElementSibling;

    // Count preceding siblings with same tag name
    while (sibling) {
      if (sibling.tagName === current.tagName) {
        index++;
      }
      sibling = sibling.previousElementSibling;
    }

    const tagName = current.tagName.toLowerCase();
    const pathIndex = index > 0 ? `[${index + 1}]` : '';
    paths.unshift(`${tagName}${pathIndex}`);

    // Stop at body or element with ID
    if (current.tagName.toLowerCase() === 'body' || current.id) {
      break;
    }

    current = current.parentElement;
  }

  return '/' + paths.join('/');
}

/**
 * Generate a selector with fallback options
 * Returns an object with multiple selector strategies
 */
export function generateMultipleSelectors(element: Element): {
  cssSelector: string;
  xpath: string;
  dataAttributes: Record<string, string>;
  textContent: string;
} {
  const cssSelector = generateCssSelector(element);
  const xpath = generateXPath(element);

  // Collect data attributes
  const dataAttributes: Record<string, string> = {};
  if (element.hasAttributes()) {
    for (const attr of Array.from(element.attributes)) {
      if (attr.name.startsWith('data-')) {
        dataAttributes[attr.name] = attr.value;
      }
    }
  }

  const textContent = element.textContent?.trim() || '';

  return {
    cssSelector,
    xpath,
    dataAttributes,
    textContent
  };
}

/**
 * Test if a selector is valid and unique
 */
export function testSelector(
  selector: string,
  expectedElement: Element,
  root: Document | Element = document
): {
  valid: boolean;
  unique: boolean;
  matchCount: number;
} {
  try {
    const matches = root.querySelectorAll(selector);
    const matchCount = matches.length;
    const valid = matchCount > 0;
    const unique = matchCount === 1;
    const matchesExpected = Array.from(matches).includes(expectedElement);

    return {
      valid: valid && matchesExpected,
      unique,
      matchCount
    };
  } catch (error) {
    return {
      valid: false,
      unique: false,
      matchCount: 0
    };
  }
}

/**
 * Optimize selector by removing unnecessary parts
 */
export function optimizeSelector(selector: string, element: Element): string {
  const parts = selector.split(' > ');

  // Try removing parts from the beginning
  for (let i = 0; i < parts.length - 1; i++) {
    const shorterSelector = parts.slice(i).join(' > ');

    try {
      const matches = document.querySelectorAll(shorterSelector);
      if (matches.length === 1 && matches[0] === element) {
        return shorterSelector;
      }
    } catch (error) {
      continue;
    }
  }

  return selector;
}

/**
 * Generate a human-readable description of the selector
 */
export function describeSelectorElement(element: Element): string {
  const tag = element.tagName.toLowerCase();
  const id = element.id ? `#${element.id}` : '';
  const classes = element.className
    ? `.${element.className.toString().split(/\s+/).join('.')}`
    : '';
  const text = element.textContent?.trim().substring(0, 30) || '';

  return `${tag}${id}${classes}${text ? ` "${text}..."` : ''}`;
}
