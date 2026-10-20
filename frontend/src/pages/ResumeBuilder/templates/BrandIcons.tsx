import type { SVGProps } from 'react';
import { HACKERRANK_PATH, KAGGLE_PATH, LEETCODE_PATH } from './brandIconPaths';

/**
 * Brand marks for platforms that lucide-react does not ship.
 *
 * Paths come from the CC0 Simple Icons set so résumé headers show the actual
 * platform mark instead of a generic code/trophy/database glyph. They inherit
 * `currentColor` and accept the same `className` contract as lucide icons.
 */

type IconProps = SVGProps<SVGSVGElement> & { className?: string };

function BrandIcon({ className, children, ...props }: IconProps) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
            focusable="false"
            className={className}
            {...props}
        >
            {children}
        </svg>
    );
}

export function LeetCodeIcon({ className, ...props }: IconProps) {
    return (
        <BrandIcon className={className} {...props}>
            <path d={LEETCODE_PATH} />
        </BrandIcon>
    );
}

export function HackerRankIcon({ className, ...props }: IconProps) {
    return (
        <BrandIcon className={className} {...props}>
            <path d={HACKERRANK_PATH} />
        </BrandIcon>
    );
}

export function KaggleIcon({ className, ...props }: IconProps) {
    return (
        <BrandIcon className={className} {...props}>
            <path d={KAGGLE_PATH} />
        </BrandIcon>
    );
}
