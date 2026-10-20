import type { CSSProperties } from 'react';
import type { CustomSectionItem } from '../types';

interface CustomSectionBlockProps {
    entry: CustomSectionItem;
    wrapperClass?: string;
    headingClass?: string;
    headingStyle?: CSSProperties;
    bodyClass?: string;
}

/**
 * Shared renderer for user-created sections. Each template passes its own
 * heading/body conventions so custom sections inherit the template's visual
 * identity instead of looking bolted on.
 */
export function CustomSectionBlock({ entry, wrapperClass = 'mb-6', headingClass, headingStyle, bodyClass }: CustomSectionBlockProps) {
    return (
        <div className={wrapperClass}>
            <h2 className={headingClass} style={headingStyle}>{entry.title}</h2>
            <p className={bodyClass} style={{ whiteSpace: 'pre-wrap' }}>{entry.content}</p>
        </div>
    );
}
