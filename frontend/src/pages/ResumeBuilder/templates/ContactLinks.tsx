import type { ContactItem } from './contactLinkUtils';

interface ContactLinksProps {
    items: ContactItem[];
    /** `inline` renders a wrapped row; `stack` renders one item per line. */
    layout?: 'inline' | 'stack';
    /** Glyph placed between items in inline layout (e.g. '|' or '•'). */
    separator?: string;
    showIcons?: boolean;
    /** When true with showIcons, show compact platform name instead of full URL. */
    compactNames?: boolean;
    /** Tailwind gap classes for the row; defaults adapt to layout/separator. */
    gap?: string;
    className?: string;
    itemClassName?: string;
    linkClassName?: string;
    separatorClassName?: string;
    iconClassName?: string;
}

/**
 * Renders resume contact details as real anchors so they stay clickable in the
 * web preview and survive browser print-to-PDF as link annotations.
 *
 * Items arrive pre-filtered by buildContactItems(), so separators are only
 * emitted between entries that actually render.
 */
export function ContactLinks({
    items,
    layout = 'inline',
    separator,
    showIcons = false,
    compactNames = false,
    gap,
    className = '',
    itemClassName = '',
    linkClassName = '',
    separatorClassName = '',
    iconClassName = '',
}: ContactLinksProps) {
    if (items.length === 0) return null;

    const defaultGap = layout === 'stack' ? 'gap-1' : separator ? 'gap-x-2 gap-y-1' : 'gap-x-4 gap-y-1';
    const containerClass = [
        layout === 'stack' ? 'flex flex-col' : 'flex flex-wrap items-center',
        gap || defaultGap,
        className,
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <div className={containerClass}>
            {items.map((item, index) => (
                <span key={item.kind} className={`inline-flex items-center min-w-0 max-w-full ${itemClassName || 'gap-1'}`}>
                    {separator && index > 0 && (
                        <span aria-hidden="true" className={`flex-shrink-0 ${separatorClassName}`}>
                            {separator}
                        </span>
                    )}
                    {showIcons && item.icon && (
                        // `flex` + `leading-none` gives the icon wrapper an exact
                        // line-box height, so it stays optically centred with the
                        // label at every font size instead of sitting on the
                        // text baseline.
                        <span aria-hidden="true" className={`flex items-center justify-center flex-shrink-0 leading-none ${iconClassName}`}>
                            <item.icon className="w-3.5 h-3.5" />
                        </span>
                    )}
                    {item.href ? (
                        <a
                            href={item.href}
                            aria-label={item.ariaLabel}
                            // Link annotations are preserved by print-to-PDF; the
                            // preview opens them in a new tab like a real document.
                            target={item.href.startsWith('http') ? '_blank' : undefined}
                            rel={item.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                            className={`min-w-0 break-words [overflow-wrap:anywhere] hover:underline ${linkClassName}`}
                        >
                            {compactNames && item.platformName ? item.platformName : item.label}
                        </a>
                    ) : (
                        <span className={`min-w-0 break-words [overflow-wrap:anywhere] ${linkClassName}`}>{item.label}</span>
                    )}
                </span>
            ))}
        </div>
    );
}
